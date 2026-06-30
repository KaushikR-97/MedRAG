import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import uuid

from app.main import app
from app.db.session import Base, get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.feature_modules import Hospital, HospitalDepartment

SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

MOCK_ADMIN = User(
    id="test-admin-id",
    email="admin@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Hospital Admin",
    role="hospital_admin"
)

MOCK_DOCTOR = User(
    id="test-doc-id",
    email="doctor@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Dr. Aditi",
    role="doctor"
)

MOCK_STAFF = User(
    id="test-staff-id",
    email="staff@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Clinic Staff",
    role="doctor"
)

MOCK_OTHER_ADMIN = User(
    id="test-other-admin-id",
    email="other-admin@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Other Hospital Admin",
    role="hospital_admin"
)

current_mock_user = MOCK_ADMIN

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    return current_mock_user

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.merge(MOCK_ADMIN)
    db.merge(MOCK_DOCTOR)
    db.merge(MOCK_STAFF)
    db.merge(MOCK_OTHER_ADMIN)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def setup_overrides():
    orig_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides = orig_overrides

client = TestClient(app)

def test_hospital_admin_flow() -> None:
    global current_mock_user
    current_mock_user = MOCK_ADMIN

    # 1. Create a hospital
    hosp_res = client.post("/hospitals", json={"name": "City Clinic", "city": "Bengaluru", "state": "Karnataka", "phone": "123456"})
    assert hosp_res.status_code == 200
    hospital = hosp_res.json()
    hosp_id = hospital["id"]

    # 2. Create a department
    dept_res = client.post("/hospitals/departments", json={"hospital_id": hosp_id, "name": "Cardiology", "speciality": "Cardiology"})
    assert dept_res.status_code == 200
    department = dept_res.json()
    dept_id = department["id"]

    # 3. Register a doctor profile
    doc_payload = {
        "email": "newdoc@medrag.in",
        "password": "securepassword123",
        "full_name": "Dr. Kumar",
        "phone": "+919999988888",
        "registration_number": "MCI-9999",
        "speciality": "Cardiology",
        "hospital_id": hosp_id,
        "department_id": dept_id,
        "consultation_fee": 500.0
    }
    doc_res = client.post("/hospitals/create-doctor", json=doc_payload)
    print("CREATE DOCTOR STATUS:", doc_res.status_code)
    print("CREATE DOCTOR BODY:", doc_res.text)
    assert doc_res.status_code == 200
    doc_data = doc_res.json()
    doc_id = doc_data["doctor_user_id"]

    # 4. Doctor logs in (mock doctor) and releases slots
    # Let's override current user as the newly created doctor
    db = TestingSessionLocal()
    doctor_user = db.query(User).filter(User.id == doc_id).first()
    db.close()
    assert doctor_user is not None
    
    current_mock_user = doctor_user

    slot_payload = {
        "date": "2026-07-01",
        "start_time": "09:00",
        "end_time": "10:00",
        "consultation_mode": "video",
        "capacity": 2,
        "consultation_fee": 600.0,
        "accept_insurance": True
    }
    slot_res = client.post("/hospitals/slots", json=slot_payload)
    print("CREATE SLOT STATUS:", slot_res.status_code)
    print("CREATE SLOT BODY:", slot_res.text)
    assert slot_res.status_code == 200


def test_doctor_can_create_clinic_org_and_delegate_staff() -> None:
    global current_mock_user
    current_mock_user = MOCK_DOCTOR

    org_res = client.post("/organizations", json={"name": "Aditi Clinic", "organization_type": "clinic"})
    assert org_res.status_code == 200
    org = org_res.json()
    assert org["organization_type"] == "clinic"
    assert org["owner_user_id"] == MOCK_DOCTOR.id
    assert org["members_count"] == 1

    member_res = client.post(
        f"/organizations/{org['id']}/members",
        json={"user_id": MOCK_STAFF.id, "member_role": "front_desk", "task_scope": "appointments,billing"},
    )
    assert member_res.status_code == 200
    member = member_res.json()
    assert member["user_id"] == MOCK_STAFF.id
    assert member["member_role"] == "front_desk"
    assert member["task_scope"] == "appointments,billing"


def test_doctor_cannot_create_hospital_org() -> None:
    global current_mock_user
    current_mock_user = MOCK_DOCTOR

    response = client.post("/organizations", json={"name": "Not A Hospital", "organization_type": "hospital"})
    assert response.status_code == 403
    assert "Doctors can create clinic organizations" in response.text


def test_hospital_admin_creates_only_linked_hospital_org() -> None:
    global current_mock_user
    current_mock_user = MOCK_ADMIN

    hospital_res = client.post("/hospitals", json={"name": "Admin General Hospital", "city": "Bengaluru"})
    assert hospital_res.status_code == 200
    hospital = hospital_res.json()

    clinic_res = client.post("/organizations", json={"name": "Admin Clinic", "organization_type": "clinic"})
    assert clinic_res.status_code == 403

    missing_link_res = client.post("/organizations", json={"name": "Unlinked Hospital Org", "organization_type": "hospital"})
    assert missing_link_res.status_code == 400

    org_res = client.post(
        "/organizations",
        json={"name": "Admin General Org", "organization_type": "hospital", "linked_hospital_id": hospital["id"]},
    )
    assert org_res.status_code == 200
    org = org_res.json()
    assert org["organization_type"] == "hospital"
    assert org["linked_hospital_id"] == hospital["id"]


def test_hospital_admin_has_no_global_org_management_power() -> None:
    global current_mock_user
    current_mock_user = MOCK_DOCTOR
    org_res = client.post("/organizations", json={"name": "Doctor-Owned Clinic", "organization_type": "clinic"})
    assert org_res.status_code == 200
    org = org_res.json()

    current_mock_user = MOCK_OTHER_ADMIN
    member_res = client.post(
        f"/organizations/{org['id']}/members",
        json={"user_id": MOCK_STAFF.id, "member_role": "admin", "task_scope": "staff"},
    )
    assert member_res.status_code == 403

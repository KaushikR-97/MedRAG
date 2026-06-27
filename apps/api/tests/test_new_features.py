import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, UTC

from app.main import app
from app.db.session import Base, get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.feature_modules import MedicationReminder, IotPillboxAlert, PatientCalendarEvent, SecondOpinionRequest

# Setup test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base user to mock authentication
MOCK_USER = User(
    id="test-doctor-id",
    email="test-doctor@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Dr. Aditi Sharma",
    role="doctor",
    phone="+919876543210"
)

MOCK_PATIENT = User(
    id="test-patient-id",
    email="test-patient@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Rajesh Kumar",
    role="patient",
    phone="+919999988888"
)

current_mock_user = MOCK_USER

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
    # Add mock doctor and patient users
    db.merge(MOCK_USER)
    db.merge(MOCK_PATIENT)
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


def test_ocr_spellcheck() -> None:
    # 1. Test drug spelling checker with correct names
    response = client.post("/shared/ocr/spellcheck", json={"text": "Metformin, Aspirin"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["original"] == "Metformin"
    assert data[0]["correction"] == "Metformin"
    assert data[0]["is_typo"] is False

    # 2. Test typo corrections (Levenshtein distance <= 3)
    response = client.post("/shared/ocr/spellcheck", json={"text": "Metformn, Asprin, Amoxcillin"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    
    assert data[0]["original"] == "Metformn"
    assert data[0]["correction"] == "Metformin"
    assert data[0]["is_typo"] is True
    assert "Metformin" in data[0]["suggestions"]

    assert data[1]["original"] == "Asprin"
    assert data[1]["correction"] == "Aspirin"
    assert data[1]["is_typo"] is True

    assert data[2]["original"] == "Amoxcillin"
    assert data[2]["correction"] == "Amoxicillin"
    assert data[2]["is_typo"] is True


def test_clinical_safety_red_teaming() -> None:
    # Get initial score
    response = client.get("/compliance/red-team/score")
    assert response.status_code == 200
    data = response.json()
    assert data["drift_score"] == 100.0
    assert data["total_runs"] == 0

    # Run red-teaming simulator
    response = client.post("/compliance/red-team/run")
    assert response.status_code == 200
    runs = response.json()
    assert len(runs) == 5
    assert all(r["is_safe"] is True for r in runs)
    assert all("MedRAG Safety Block" in r["reply"] for r in runs)

    # Get updated score
    response = client.get("/compliance/red-team/score")
    assert response.status_code == 200
    data = response.json()
    assert data["drift_score"] == 100.0
    assert data["total_runs"] == 5
    assert len(data["logs"]) == 5


def test_peer_to_peer_second_opinion_board() -> None:
    global current_mock_user
    current_mock_user = MOCK_USER

    # Create a second opinion request with sensitive patient PHI
    payload = {
        "specialty": "Cardiology",
        "redacted_summary": "Patient: Rajesh Kumar. phone +919876543210, email rajesh@gmail.com, has chest pain.",
        "clinical_question": "Should we recommend coronary angiogram?"
    }
    response = client.post("/doctor/second-opinion/create", json=payload)
    assert response.status_code == 200
    req_data = response.json()
    assert req_data["specialty"] == "Cardiology"
    # Verify that the patient name, phone and email are automatically redacted
    assert "Rajesh Kumar" not in req_data["redacted_summary"]
    assert "+919876543210" not in req_data["redacted_summary"]
    assert "rajesh@gmail.com" not in req_data["redacted_summary"]
    assert "[REDACTED PHONE]" in req_data["redacted_summary"]
    assert "[REDACTED EMAIL]" in req_data["redacted_summary"]
    assert req_data["status"] == "pending"

    # Fetch second opinion board
    response = client.get("/doctor/second-opinion/board")
    assert response.status_code == 200
    board = response.json()
    assert len(board) >= 1
    assert board[0]["id"] == req_data["id"]

    # Post a recommendation response
    resp_payload = {
        "request_id": req_data["id"],
        "response_recommendation": "Recommend angiogram due to symptoms and risk factors."
    }
    response = client.post("/doctor/second-opinion/respond", json=resp_payload)
    assert response.status_code == 200
    updated_req = response.json()
    assert updated_req["status"] == "responded"
    assert updated_req["response_recommendation"] == "Recommend angiogram due to symptoms and risk factors."
    assert updated_req["responder_id"] == MOCK_USER.id


def test_smart_pillbox_iot_sync() -> None:
    global current_mock_user
    current_mock_user = MOCK_PATIENT

    # Create a pillbox ping with "taken" status
    ping_payload = {
        "reminder_id": "simulated-reminder-uuid",
        "status": "taken"
    }
    response = client.post("/patient/pillbox/ping", json=ping_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "logged"
    assert data["caregiver_notified"] is False

    # Create a pillbox ping with "missed" status
    missed_payload = {
        "reminder_id": "simulated-reminder-uuid",
        "status": "missed"
    }
    response = client.post("/patient/pillbox/ping", json=missed_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "logged"
    assert data["caregiver_notified"] is True

    # Check that pillbox alerts can be fetched
    response = client.get("/patient/pillbox/alerts")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) >= 2
    assert alerts[0]["status"] == "missed"
    assert alerts[1]["status"] == "taken"

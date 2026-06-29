import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.clinical import _direct_lab_value_answer, _is_patient_record_value_query
from app.api.routes.patient_features import register_family_member
from app.db.session import Base, get_db
from app.models.compliance import ConsentGrant
from app.models.feature_modules import FamilyMember
from app.models.patient import PatientProfile
from app.models.user import User
from app.rag.retriever import RetrievedChunk
from app.schemas.features import FamilyMemberRegisterRequest
from app.services.query_router_service import QueryRouterService


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

MOCK_PATIENT = User(
    id="123456789012",
    email="patient@example.com",
    hashed_password="mock",
    full_name="Demo Patient",
    role="patient",
    phone="+919999988888",
    city="Bengaluru",
)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.merge(MOCK_PATIENT)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


def test_register_family_member_creates_child_patient_and_consent() -> None:
    db = TestingSessionLocal()
    result = register_family_member(
        payload=FamilyMemberRegisterRequest(
            full_name="Demo Child",
            relation="child",
            age=12,
            notes="School age",
            scope="all",
        ),
        user=MOCK_PATIENT,
        db=db,
    )

    data = result
    assert data["member_user_id"]

    try:
        member = db.query(FamilyMember).filter(FamilyMember.id == data["id"]).first()
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == data["member_user_id"]).first()
        consent = db.query(ConsentGrant).filter(ConsentGrant.patient_id == data["member_user_id"]).first()
        assert member is not None
        assert profile is not None
        assert consent is not None
    finally:
        db.close()


def test_lab_value_questions_force_patient_record_route() -> None:
    decision = QueryRouterService().route(question="What is my uric acid value?", user_role="patient")

    assert decision.route == "patient_record_needed"
    assert decision.needs_rag is True


def test_direct_lab_value_answer_extracts_uric_acid_from_report_source() -> None:
    source = RetrievedChunk(
        id="doc-1",
        title="Lab report",
        score=1.0,
        text=(
            "Clinical timeline metadata:\n"
            "Clinical/report date: 2025-09-12T00:00:00+00:00\n"
            "Timeline state: current_snapshot\n\n"
            "Biochemistry\nUric Acid : 7.4 mg/dL\nCreatinine: 1.0 mg/dL"
        ),
    )

    assert _is_patient_record_value_query("what is my uric acid value")
    answer = _direct_lab_value_answer("what is my uric acid value", [source])
    assert answer is not None
    assert "7.4 mg/dL" in answer
    assert "generic answer" in answer

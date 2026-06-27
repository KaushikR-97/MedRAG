import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, UTC, date
import uuid

from app.main import app
from app.db.session import Base, get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.document import MedicalDocument
from app.models.feature_modules import SymptomEntry, GuidelineDriftAlert, PhrLedgerBlock

# Setup test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_remaining.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Mock Users
MOCK_DOCTOR = User(
    id="doc-remaining-id",
    email="doctor-rem@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Dr. Priya Patel",
    role="doctor",
    phone="+919876543210"
)

MOCK_PATIENT = User(
    id="pat-remaining-id",
    email="patient-rem@medrag.in",
    hashed_password="mockhashedpassword",
    full_name="Amit Sharma",
    role="patient",
    phone="+919999988888"
)

current_mock_user = MOCK_PATIENT

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    global current_mock_user
    print(f"DEBUG: override_get_current_user called. current_mock_user id={current_mock_user.id}, role={current_mock_user.role}")
    return current_mock_user

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Merge users to prevent unique constraint failures
    db.merge(MOCK_DOCTOR)
    db.merge(MOCK_PATIENT)
    
    # Setup Patient Profile with chronic conditions
    profile = PatientProfile(
        id="profile-rem-id",
        user_id=MOCK_PATIENT.id,
        gender="male",
        date_of_birth="1990-01-01",
        chronic_conditions="Asthma, Diabetes",
        allergies="Dust, Pollen"
    )
    db.merge(profile)
    
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

# Fixture to dynamically configure overrides before each test in this module and restore them afterwards
@pytest.fixture(autouse=True)
def setup_overrides():
    print("DEBUG: Setting dependency overrides")
    orig_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides = orig_overrides

client = TestClient(app)


def test_mental_health_screening() -> None:
    # Test positive sentiment / low risk
    response = client.post(
        "/patient/mental-health/screen-conversation",
        json={"conversation_text": "I had a wonderful day today, feeling super happy and motivated!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] in ["minimal", "mild"]
    assert data["sentiment_score"] > 0
    
    # Test negative sentiment / high risk
    response = client.post(
        "/patient/mental-health/screen-conversation",
        json={"conversation_text": "I feel so sad, hopeless, depressed, anxious, and worried all the time. I have trouble with sleep."}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] in ["moderate", "severe"]
    assert data["score"] >= 10


def test_biomedclip_image_similarity() -> None:
    db = TestingSessionLocal()
    # Create mock medical document record
    doc = MedicalDocument(
        id="doc-sim-test-id",
        patient_id=MOCK_PATIENT.id,
        original_filename="chest_xray.png",
        storage_uri="s3://medrag-documents/test_xray",
        storage_bucket="medrag-documents",
        storage_key="test_xray",
        document_type="imaging",
        status="completed",
        malware_status="clean",
        sha256="testsha256hash",
        image_modality="Chest X-Ray",
        image_review_status="verified",
        image_ai_observations="Lobar consolidation in right lower zone."
    )
    db.add(doc)
    db.commit()
    db.close()
    
    response = client.get("/documents/imagery/similar-cases/doc-sim-test-id")
    assert response.status_code == 200
    data = response.json()
    assert "similar_cases" in data
    assert len(data["similar_cases"]) == 3
    assert data["similar_cases"][0]["modality"] == "Chest X-Ray"
    assert "pneumonia" in data["similar_cases"][0]["observations"].lower()


def test_guideline_drift_alerts() -> None:
    # 1. Trigger simulated drift check
    response = client.post("/compliance/guidelines/check-drift")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert any("TB" in alert["guideline_title"] or "Hypertension" in alert["guideline_title"] for alert in data)
    
    # 2. Get active drift alerts list
    response = client.get("/compliance/guidelines/drift-alerts")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) >= 2


def test_trial_cohort_generator() -> None:
    global current_mock_user
    current_mock_user = MOCK_DOCTOR # Cohort endpoint requires doctor role
    print(f"DEBUG: test_trial_cohort_generator starting. current_mock_user id={current_mock_user.id}, role={current_mock_user.role}")
    
    response = client.post(
        "/public-health/cohorts",
        json={"chronic_condition": "diabetes", "min_age": 18, "max_age": 60}
    )
    print(f"DEBUG: response status_code={response.status_code}, body={response.text}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["gender"] == "male"
    assert "diabetes" in data[0]["chronic_conditions"].lower()
    # Direct identifiers must be de-identified
    assert "Amit Sharma" not in str(data)
    assert MOCK_PATIENT.email not in str(data)
    assert MOCK_PATIENT.phone not in str(data)
    
    # Reset mock user role
    current_mock_user = MOCK_PATIENT


def test_surgical_voice_compliance() -> None:
    global current_mock_user
    current_mock_user = MOCK_DOCTOR # Voice compliance usually logged by doctors
    
    response = client.post(
        "/communication/voice-audit",
        json={"audio_text": "Confirming checklist: patient identity verified, site marked, pulse oximeter on."}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "audited"
    assert "hash" in data
    assert "previous_hash" in data
    
    current_mock_user = MOCK_PATIENT


def test_outbreak_map() -> None:
    db = TestingSessionLocal()
    # Add symptom entries indicative of Cholera / Dengue
    entry1 = SymptomEntry(
        id=str(uuid.uuid4()),
        patient_id=MOCK_PATIENT.id,
        symptoms="High fever, severe joint pain, muscle aches, dengue symptoms.",
        severity=8,
        created_at=datetime.now(UTC)
    )
    db.add(entry1)
    db.commit()
    db.close()
    
    response = client.get("/public-health/outbreak-map")
    assert response.status_code == 200
    data = response.json()
    assert "heatmap" in data
    assert len(data["heatmap"]) >= 1
    assert any(h["disease"] == "Dengue Fever" for h in data["heatmap"])


def test_weather_allergen_sync() -> None:
    response = client.post("/patient/weather-health/allergen-sync")
    assert response.status_code == 200
    data = response.json()
    assert data["vulnerable"] is True
    assert data["alerts_triggered"] == 2
    assert "[AQI Alert]" in data["tasks_created"][0]


def test_blockchain_phr_ledger() -> None:
    # 1. Commit timeline hash
    response = client.post("/compliance/ledger/hash-timeline")
    assert response.status_code == 200
    block1 = response.json()
    assert block1["block_index"] == 0
    assert block1["previous_hash"] == "0" * 64
    assert block1["hash"].startswith("0") # pow check
    
    # 2. Add second block
    response = client.post("/compliance/ledger/hash-timeline")
    assert response.status_code == 200
    block2 = response.json()
    assert block2["block_index"] == 1
    assert block2["previous_hash"] == block1["hash"]
    
    # 3. Verify ledger integrity
    response = client.post("/compliance/ledger/verify")
    assert response.status_code == 200
    assert response.json()["is_valid"] is True
    
    # 4. Get blocks
    response = client.get("/compliance/ledger/blocks")
    assert response.status_code == 200
    blocks = response.json()
    assert len(blocks) == 2
    assert blocks[0]["block_index"] == 1
    assert blocks[1]["block_index"] == 0

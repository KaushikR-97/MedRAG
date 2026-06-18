import tempfile
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user, hash_password
from app.db.session import get_db
from app.models.feature_modules import (
    Appointment,
    CaregiverLink,
    HealthTask,
    LabResult,
    MedicationReminder,
    Prescription,
    SymptomEntry,
)
from app.models.user import User
from app.services.clinical_tools_service import ClinicalToolsService
from app.services.voice_service import VoiceService

router = APIRouter()


@router.get("/timeline")
def health_timeline(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    events: list[dict] = []
    for rx in db.query(Prescription).filter(Prescription.patient_id == user.id).all():
        events.append({"type": "prescription", "id": rx.id, "date": rx.created_at.isoformat(), "title": rx.diagnosis})
    for lab in db.query(LabResult).filter(LabResult.patient_id == user.id).all():
        events.append({"type": "lab", "id": lab.id, "date": lab.created_at.isoformat(), "title": lab.test_name})
    for symptom in db.query(SymptomEntry).filter(SymptomEntry.patient_id == user.id).all():
        events.append({"type": "symptom", "id": symptom.id, "date": symptom.created_at.isoformat(), "title": symptom.symptoms[:80]})
    return {"events": sorted(events, key=lambda item: item["date"], reverse=True)}


@router.get("/pre-consult-summary")
def preconsult_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    latest_symptoms = db.query(SymptomEntry).filter(SymptomEntry.patient_id == user.id).order_by(SymptomEntry.created_at.desc()).limit(5).all()
    meds = db.query(MedicationReminder).filter(MedicationReminder.patient_id == user.id, MedicationReminder.active.is_(True)).all()
    tasks = db.query(HealthTask).filter(HealthTask.patient_id == user.id, HealthTask.status == "pending").all()
    return {
        "summary": {
            "recent_symptoms": [s.symptoms for s in latest_symptoms],
            "active_medications": [m.medicine_name for m in meds],
            "pending_tasks": [t.title for t in tasks],
            "red_flags": [s.triage_result for s in latest_symptoms if s.triage_result.startswith("urgent")],
        }
    }


@router.get("/diet-recommendations")
def diet_recommendations(condition: str = "", user: User = Depends(get_current_user)) -> dict:
    text = condition.lower()
    if "diabetes" in text:
        recs = ["Prefer high-fiber meals", "Limit sugary drinks", "Discuss carbohydrate targets with clinician"]
    elif "hypertension" in text:
        recs = ["Reduce salt intake", "Prefer fruits/vegetables", "Monitor BP regularly"]
    else:
        recs = ["Prefer balanced meals", "Hydrate well", "Avoid tobacco and excess alcohol"]
    return {"patient_id": user.id, "recommendations": recs, "disclaimer": "Diet advice should be individualized by a clinician/dietitian."}


@router.post("/pmjay/claim-assist")
def pmjay_claim_assist(
    patient_id: str,
    diagnosis: str,
    hospital_state: str,
    _user: User = Depends(get_current_user),
) -> dict:
    return {
        "eligibility_checklist": [
            "Verify beneficiary eligibility in PM-JAY portal",
            "Map diagnosis to package code",
            "Attach prescription, admission note, ID, and discharge summary",
            f"Route to state health agency workflow for {hospital_state}",
        ],
        "diagnosis": diagnosis,
        "patient_id": patient_id,
    }


@router.post("/caregiver-link")
def create_caregiver_link(
    scope: str = "summary",
    hours: int = 72,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    raw_token = str(uuid.uuid4())
    link = CaregiverLink(
        id=str(uuid.uuid4()),
        patient_id=user.id,
        token_hash=hash_password(raw_token),
        scope=scope,
        expires_at=datetime.now(UTC) + timedelta(hours=hours),
    )
    db.add(link)
    db.commit()
    return {"link_id": link.id, "token": raw_token, "expires_at": link.expires_at.isoformat()}


@router.post("/voice/transcribe")
async def transcribe_voice(
    language: str = "en",
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> dict:
    content = await file.read()
    suffix = "." + (file.filename or "audio.wav").split(".")[-1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    return {"text": VoiceService().transcribe(tmp_path, language=language)}


@router.get("/weather-health")
def weather_health(city: str = "", state: str = "", _user: User = Depends(get_current_user)) -> dict:
    return {
        "location": {"city": city, "state": state},
        "advice": [
            "Hydrate during heat waves",
            "Use masks/avoid outdoor exertion during poor air quality",
            "Follow local public health advisories during outbreaks",
        ],
        "source": "OpenWeather integration boundary",
    }


@router.post("/second-opinion/patient")
def patient_second_opinion(case_summary: str, user: User = Depends(get_current_user)) -> dict:
    return {
        "patient_id": user.id,
        "result": "A clinician should review this case. RAG-backed second opinion workflow can compare against guidelines.",
        "case_summary": case_summary,
    }

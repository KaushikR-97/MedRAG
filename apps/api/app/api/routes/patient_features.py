from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.features import (
    AppointmentCreate,
    FamilyMemberCreate,
    LabResultCreate,
    MedicationReminderCreate,
    MentalHealthCreate,
    PregnancyCreate,
    SymptomTrackRequest,
    VaccinationCreate,
)
from app.services.care_workflow_service import CareWorkflowService
from app.services.clinical_tools_service import ClinicalToolsService

router = APIRouter()


@router.post("/appointments")
def book_appointment(
    payload: AppointmentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    record = CareWorkflowService(db).book_appointment(patient_id=user.id, payload=payload.model_dump())
    return {"id": record.id, "status": record.status}


@router.post("/family")
def add_family(
    payload: FamilyMemberCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    record = CareWorkflowService(db).add_family_member(owner_id=user.id, payload=payload.model_dump())
    return {"id": record.id}


@router.post("/medication-reminders")
def create_reminder(
    payload: MedicationReminderCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    record = CareWorkflowService(db).create_medication_reminder(patient_id=user.id, payload=payload.model_dump())
    return {"id": record.id, "active": record.active}


@router.post("/symptoms")
def track_symptoms(payload: SymptomTrackRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    record = CareWorkflowService(db).track_symptoms(
        patient_id=user.id,
        symptoms=payload.symptoms,
        severity=payload.severity,
        duration=payload.duration,
    )
    return {"id": record.id, "triage_result": record.triage_result}


@router.post("/labs")
def save_lab(payload: LabResultCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    record = CareWorkflowService(db).save_lab_result(
        patient_id=user.id,
        test_name=payload.test_name,
        value=payload.value,
        unit=payload.unit,
    )
    return {"id": record.id, "interpretation": record.interpretation}


@router.post("/vaccinations")
def add_vaccination(
    payload: VaccinationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    record = CareWorkflowService(db).add_vaccination(patient_id=user.id, payload=payload.model_dump())
    return {"id": record.id}


@router.post("/pregnancy")
def add_pregnancy(payload: PregnancyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    record = CareWorkflowService(db).add_pregnancy(patient_id=user.id, lmp_date=payload.lmp_date, notes=payload.notes)
    return {"id": record.id, "estimated_due_date": record.estimated_due_date}


@router.post("/mental-health")
def mental_health(payload: MentalHealthCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    record = CareWorkflowService(db).save_mental_health_screening(
        patient_id=user.id,
        screening_type=payload.screening_type,
        score=payload.score,
    )
    return {"id": record.id, "risk_level": record.risk_level}


@router.post("/health-score")
def health_score(completed_checks: int = 0, risk_factors: int = 0) -> dict:
    return {"score": ClinicalToolsService().health_score(completed_checks=completed_checks, risk_factors=risk_factors)}


@router.post("/health-tasks/run")
def run_health_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    tasks = CareWorkflowService(db).generate_health_tasks(patient_id=user.id)
    return {"created": len(tasks), "tasks": [{"id": task.id, "title": task.title, "priority": task.priority} for task in tasks]}

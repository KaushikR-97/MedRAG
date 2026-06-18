from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.models.feature_modules import Appointment, Prescription
from app.models.user import User
from app.schemas.features import (
    DrugInteractionRequest,
    PrescriptionCreate,
    ReferralRequest,
    SecondOpinionRequest,
    SoapRequest,
)
from app.services.care_workflow_service import CareWorkflowService
from app.services.clinical_tools_service import ClinicalToolsService
from app.services.compliance_service import ComplianceService

router = APIRouter()


@router.post("/prescriptions")
def create_prescription(
    payload: PrescriptionCreate,
    doctor: User = Depends(require_role("doctor", "hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    if not ComplianceService(db).can_access_patient(actor=doctor, patient_id=payload.patient_id, scope="clinical.ask"):
        raise HTTPException(403, "Missing patient consent or care-team access")
    rx = CareWorkflowService(db).create_prescription(doctor=doctor, payload=payload.model_dump())
    interactions = ClinicalToolsService().check_interactions(payload.medications.splitlines())
    return {"id": rx.id, "interaction_warnings": [item.__dict__ for item in interactions]}


@router.get("/prescriptions/renewal-alerts")
def rx_renewal_alerts(doctor: User = Depends(require_role("doctor", "hospital_admin")), db: Session = Depends(get_db)) -> dict:
    records = db.query(Prescription).filter(Prescription.doctor_id == doctor.id).all()
    return {"alerts": [{"prescription_id": rx.id, "follow_up_date": rx.follow_up_date} for rx in records if rx.follow_up_date]}


@router.post("/drug-interactions")
def drug_interactions(payload: DrugInteractionRequest, _doctor: User = Depends(require_role("doctor", "hospital_admin"))) -> dict:
    return {"interactions": [item.__dict__ for item in ClinicalToolsService().check_interactions(payload.medicines)]}


@router.post("/soap-note")
def soap_note(payload: SoapRequest, _doctor: User = Depends(require_role("doctor", "hospital_admin"))) -> dict:
    text = payload.visit_summary
    return {
        "soap": {
            "subjective": text,
            "objective": "Add vitals, examination findings, and labs.",
            "assessment": "Clinician assessment required.",
            "plan": "Document treatment, follow-up, and red flags.",
        }
    }


@router.post("/referral-letter")
def referral(
    payload: ReferralRequest,
    doctor: User = Depends(require_role("doctor", "hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    if not ComplianceService(db).can_access_patient(actor=doctor, patient_id=payload.patient_id, scope="clinical.ask"):
        raise HTTPException(403, "Missing patient consent or care-team access")
    return {
        "letter": (
            f"Referral from Dr/Hospital user {doctor.full_name} for patient {payload.patient_id}. "
            f"Speciality: {payload.speciality}. Reason: {payload.reason}."
        )
    }


@router.post("/second-opinion")
def second_opinion(payload: SecondOpinionRequest, _doctor: User = Depends(require_role("doctor", "hospital_admin"))) -> dict:
    return {
        "analysis": "Compare case summary against retrieved guideline context before finalizing.",
        "case_summary": payload.case_summary,
        "guideline_context": payload.guideline_context,
    }


@router.post("/differential-diagnosis")
def differential(payload: SecondOpinionRequest, _doctor: User = Depends(require_role("doctor", "hospital_admin"))) -> dict:
    return {"differentials": ["Needs clinician-entered findings", "Use guideline-backed DDx model here"], "safety": "not a diagnosis"}


@router.get("/analytics")
def analytics(_doctor: User = Depends(require_role("doctor", "hospital_admin")), db: Session = Depends(get_db)) -> dict:
    return {
        "appointments": db.query(Appointment).count(),
        "prescriptions": db.query(Prescription).count(),
        "pmjay_prescriptions": db.query(Prescription).filter(Prescription.pmjay_covered.is_(True)).count(),
    }

from datetime import UTC, datetime, timedelta

from app.models.feature_modules import Prescription
from app.rag.clinical_timeline import (
    build_prescription_timeline_context,
    infer_lab_group,
    prescription_is_active,
)


def test_lab_group_inference_supports_multiple_report_families() -> None:
    text = "HbA1c 8.1%, fasting glucose 144 mg/dL, creatinine 1.2 mg/dL"

    assert infer_lab_group(text) == "diabetes_glucose_hba1c+renal_kidney"


def test_prescription_follow_up_controls_active_condition_state() -> None:
    future = (datetime.now(UTC) + timedelta(days=14)).date().isoformat()
    past = (datetime.now(UTC) - timedelta(days=14)).date().isoformat()

    assert prescription_is_active(f"Diagnosis: Gout\nFollow-up Date: {future}") is True
    assert prescription_is_active(f"Diagnosis: Gout\nFollow-up Date: {past}") is False


def test_prescription_context_marks_active_and_past_disease() -> None:
    active = Prescription(
        id="rx-active",
        patient_id="patient-1",
        doctor_id="doctor-1",
        diagnosis="Gout",
        medications="Colchicine",
        follow_up_date=(datetime.now(UTC) + timedelta(days=10)).date().isoformat(),
    )
    context = build_prescription_timeline_context(active)

    assert context.timeline_state == "active_condition"
    assert context.prescription_state == "active"
    assert context.disease_names == "Gout"


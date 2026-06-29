from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models.document import MedicalDocument
from app.models.feature_modules import Prescription
from app.rag.clinical_timeline import (
    build_document_timeline_context,
    build_prescription_timeline_context,
    extract_clinical_datetime,
    extract_document_clinical_datetime,
    infer_lab_group,
    prescription_is_active,
)


def test_lab_group_inference_supports_multiple_report_families() -> None:
    text = "HbA1c 8.1%, fasting glucose 144 mg/dL, creatinine 1.2 mg/dL"

    assert infer_lab_group(text) == "diabetes_glucose_hba1c+renal_kidney"


def test_report_date_extraction_prefers_clinical_report_date_over_upload_date() -> None:
    uploaded_at = datetime(2026, 6, 29, tzinfo=UTC)
    doc = MedicalDocument(
        id="doc-1",
        patient_id="patient-1",
        original_filename="Report-250305508636010_Mr.KAUSHIKR_12Sep2025_075649.pdf",
        document_type="lab_report",
        verified_text="Report Date: 10 Sep 2025\nHbA1c 8.1%",
        created_at=uploaded_at,
    )

    assert extract_document_clinical_datetime(doc).date().isoformat() == "2025-09-10"


def test_report_date_extraction_reads_filename_when_text_has_no_date() -> None:
    parsed = extract_clinical_datetime("Report-250305508636010_Mr.KAUSHIKR_12Sep2025_075649.pdf")

    assert parsed is not None
    assert parsed.date().isoformat() == "2025-09-12"


def test_latest_lab_report_uses_report_date_not_upload_order() -> None:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        older_uploaded_later = MedicalDocument(
            id="older-uploaded-later",
            patient_id="patient-1",
            original_filename="thyroid-old.pdf",
            storage_uri="memory://old",
            document_type="lab_report",
            verified_text="Report Date: 01 Jan 2025\nTSH 8.0",
            status="rag_ingested",
            created_at=datetime(2026, 6, 29, tzinfo=UTC),
        )
        newer_uploaded_earlier = MedicalDocument(
            id="newer-uploaded-earlier",
            patient_id="patient-1",
            original_filename="thyroid-new.pdf",
            storage_uri="memory://new",
            document_type="lab_report",
            verified_text="Report Date: 01 Mar 2025\nTSH 4.0",
            status="rag_ingested",
            created_at=datetime(2025, 3, 2, tzinfo=UTC),
        )
        db.add_all([older_uploaded_later, newer_uploaded_earlier])
        db.commit()

        assert build_document_timeline_context(db, older_uploaded_later).timeline_state == "historical"
        assert build_document_timeline_context(db, newer_uploaded_earlier).timeline_state == "current_snapshot"
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


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

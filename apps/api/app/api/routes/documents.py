from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import MedicalDocument
from app.models.jobs import IngestionJob
from app.models.user import User
from app.schemas.documents import DocumentRecord, IngestionJobRecord, VerifyImageFindingsRequest, VerifyOcrRequest
from app.services.document_service import DocumentService
from app.services.ingestion_service import IngestionService
from app.services.privacy_service import PrivacyService
from app.services.storage_service import ObjectStorageService
from app.services.compliance_service import ComplianceService

router = APIRouter()


@router.post("/upload", response_model=DocumentRecord)
async def upload_document(
    document_type: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRecord:
    try:
        doc = await DocumentService(db).register_upload(user=user, file=file, document_type=document_type)
        IngestionService(db).enqueue_document_pipeline(doc=doc, user=user)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return DocumentRecord.model_validate(doc, from_attributes=True)


@router.post("/{doc_id}/verify-image-findings", response_model=DocumentRecord)
def verify_image_findings(
    doc_id: str,
    payload: VerifyImageFindingsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRecord:
    doc = db.get(MedicalDocument, doc_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    if not ComplianceService(db).can_access_patient(actor=user, patient_id=doc.patient_id, scope="documents.read"):
        raise HTTPException(403, "Missing patient consent or care-team access")
    try:
        verified = DocumentService(db).verify_image_findings(
            doc_id=doc_id,
            clinician=user,
            verified_findings=payload.verified_findings,
        )
        IngestionService(db).enqueue_verified_document_ingestion(doc=verified, user=user)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return DocumentRecord.model_validate(verified, from_attributes=True)


@router.post("/{doc_id}/verify-ocr", response_model=DocumentRecord)
def verify_ocr(
    doc_id: str,
    payload: VerifyOcrRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRecord:
    try:
        doc = DocumentService(db).verify_ocr(doc_id=doc_id, user=user, verified_text=payload.verified_text)
        IngestionService(db).enqueue_verified_document_ingestion(doc=doc, user=user)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return DocumentRecord.model_validate(doc, from_attributes=True)


@router.get("/jobs/{job_id}", response_model=IngestionJobRecord)
def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IngestionJobRecord:
    job = db.get(IngestionJob, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if job.patient_id != user.id and not ComplianceService(db).can_access_patient(
        actor=user,
        patient_id=job.patient_id,
        scope="documents.read",
    ):
        raise HTTPException(404, "Job not found")
    return IngestionJobRecord.model_validate(job, from_attributes=True)


@router.get("/{doc_id}/download")
def download_document(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    doc = db.get(MedicalDocument, doc_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    PrivacyService().assert_no_download(actor=user, patient_id=doc.patient_id, resource="medical_document")
    content = ObjectStorageService().get_bytes(bucket=doc.storage_bucket, key=doc.storage_key)
    return Response(
        content=content,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{doc.original_filename}"',
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )

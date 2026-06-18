import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.jobs import IngestionJob
from app.models.patient import PatientProfile
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, PatientIntakeResponse, RegisterRequest
from app.schemas.documents import DocumentRecord, IngestionJobRecord
from app.services.audit_service import AuditService
from app.services.document_service import DocumentService
from app.services.ingestion_service import IngestionService

router = APIRouter()


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    if payload.role in {"doctor", "hospital_admin"} and not payload.registration_number:
        raise HTTPException(400, "Clinical users require a registration number")

    user = User(
        id=str(uuid.uuid4()),
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        phone=payload.phone,
        registration_number=payload.registration_number,
    )
    db.add(user)
    if payload.role == "patient":
        db.add(PatientProfile(id=str(uuid.uuid4()), user_id=user.id))
    db.commit()

    return AuthResponse(
        access_token=create_access_token(user.id, user.role),
        user_id=user.id,
        role=user.role,
    )


@router.post("/register/patient-intake", response_model=PatientIntakeResponse)
async def register_patient_intake(
    request: Request,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    full_name: Annotated[str, Form()],
    phone: Annotated[str, Form()] = "",
    blood_group: Annotated[str, Form()] = "",
    date_of_birth: Annotated[str, Form()] = "",
    gender: Annotated[str, Form()] = "",
    allergies: Annotated[str, Form()] = "",
    chronic_conditions: Annotated[str, Form()] = "",
    current_medications: Annotated[str, Form()] = "",
    abha_number: Annotated[str, Form()] = "",
    document_types: Annotated[list[str] | None, Form()] = None,
    files: Annotated[list[UploadFile] | None, File()] = None,
    db: Session = Depends(get_db),
) -> PatientIntakeResponse:
    document_types = document_types or []
    files = files or []
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    if len(files) != len(document_types):
        raise HTTPException(400, "Each uploaded file must have one document type")

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role="patient",
        phone=phone,
        registration_number="",
    )
    profile = PatientProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        blood_group=blood_group,
        date_of_birth=date_of_birth,
        gender=gender,
        allergies=allergies,
        chronic_conditions=chronic_conditions,
        current_medications=current_medications,
        abha_number=abha_number,
    )
    db.add(user)
    db.add(profile)
    db.commit()
    db.refresh(user)

    uploaded_documents = []
    ingestion_jobs = []
    try:
        for file, document_type in zip(files, document_types, strict=True):
            doc = await DocumentService(db).register_upload(user=user, file=file, document_type=document_type)
            job = IngestionService(db).enqueue_document_pipeline(doc=doc, user=user)
            uploaded_documents.append(doc)
            persisted_job = db.get(IngestionJob, job.id)
            if persisted_job:
                ingestion_jobs.append(persisted_job)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    AuditService(db).record(
        actor=user,
        patient_id=user.id,
        action="patient.intake_registered",
        purpose="patient_onboarding",
        resource_type="patient_profile",
        resource_id=profile.id,
        ip_address=request.client.host if request.client else "",
        details={
            "document_count": len(uploaded_documents),
            "document_types": document_types,
            "profile_fields_present": {
                "blood_group": bool(blood_group),
                "date_of_birth": bool(date_of_birth),
                "gender": bool(gender),
                "allergies": bool(allergies),
                "chronic_conditions": bool(chronic_conditions),
                "current_medications": bool(current_medications),
                "abha_number": bool(abha_number),
            },
        },
    )
    return PatientIntakeResponse(
        access_token=create_access_token(user.id, user.role),
        user_id=user.id,
        role=user.role,
        documents=[DocumentRecord.model_validate(doc, from_attributes=True) for doc in uploaded_documents],
        ingestion_jobs=[IngestionJobRecord.model_validate(job, from_attributes=True) for job in ingestion_jobs],
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return AuthResponse(
        access_token=create_access_token(user.id, user.role),
        user_id=user.id,
        role=user.role,
    )

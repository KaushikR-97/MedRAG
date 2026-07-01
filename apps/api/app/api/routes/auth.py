import uuid
import logging
import re
from typing import Annotated
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password, get_current_user, generate_12_digit_id
from app.db.session import get_db
from app.models.feature_modules import CareOrganization, Hospital, HospitalDepartment, OrganizationMember
from app.models.jobs import IngestionJob
from app.models.patient import PatientProfile
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    PatientIntakeResponse,
    RegisterRequest,
    ChangePasswordRequest,
    ProfileUpdateRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenRefreshRequest,
    LoginResponse,
    MfaVerifyRequest,
)
from app.schemas.documents import DocumentRecord, IngestionJobRecord
from app.services.audit_service import AuditService
from app.services.document_service import DocumentService
from app.services.ingestion_service import IngestionService
from app.core.config import settings

router = APIRouter()

PROFILE_IMAGE_DATA_URL_MAX_LENGTH = 120_000
PROFILE_IMAGE_URL_MAX_LENGTH = 2048
PROFILE_IMAGE_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$")


def _is_trusted_profile_image(value: str) -> bool:
    if not value:
        return True
    if len(value) > PROFILE_IMAGE_DATA_URL_MAX_LENGTH:
        return False
    if value.startswith("data:image/"):
        return bool(PROFILE_IMAGE_DATA_URL_RE.fullmatch(value))
    if len(value) > PROFILE_IMAGE_URL_MAX_LENGTH:
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" or (
        parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
    )


def _set_auth_cookies(response: Response, *, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.environment.lower() == "production",
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.environment.lower() == "production",
        samesite="lax",
        max_age=7 * 86400,
    )


def _clear_auth_cookies(response: Response) -> None:
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.environment.lower() == "production",
        "samesite": "lax",
    }
    response.delete_cookie("access_token", **cookie_kwargs)
    response.delete_cookie("refresh_token", **cookie_kwargs)


def _ensure_role_directory_records(db: Session, user: User) -> None:
    if user.role == "hospital_admin":
        existing = db.query(Hospital).filter(Hospital.admin_user_id == user.id).first()
        if existing is not None:
            existing.city = user.city or existing.city or ""
            existing.phone = user.phone or existing.phone or ""
            existing.emergency_phone = user.phone or existing.emergency_phone or ""
            existing.email = user.email or existing.email or ""
        else:
            hospital_name = user.full_name if "hospital" in user.full_name.lower() else f"{user.full_name} Hospital"
            db.add(
                Hospital(
                    id=str(uuid.uuid4()),
                    name=hospital_name,
                    registration_number=user.registration_number or "",
                    city=user.city or "",
                    phone=user.phone or "",
                    email=user.email,
                    emergency_phone=user.phone or "",
                    ambulance_count=0,
                    ambulance_types="",
                    beds_total=0,
                    rooms_total=0,
                    icu_beds_total=0,
                    ac_rooms_total=0,
                    admin_user_id=user.id,
                    active=True,
                )
            )
    elif user.role == "doctor":
        if not user.speciality:
            user.speciality = "General Physician"


@router.post("/register", response_model=AuthResponse)
def register(request: Request, response: Response, payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    from app.services.auth_service import check_ip_rate_limit
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    if payload.role in {"doctor", "hospital_admin"} and not payload.registration_number:
        raise HTTPException(400, "Clinical users require a registration number")

    user = User(
        id=generate_12_digit_id(db, User),
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        phone=payload.phone,
        registration_number=payload.registration_number,
        age=payload.age,
        gender=payload.gender,
        city=payload.city,
    )
    db.add(user)
    try:
        db.flush()
        if payload.role == "patient":
            db.add(
                PatientProfile(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    blood_group=payload.blood_group,
                    gender=payload.gender,
                    height_cm=payload.height_cm,
                    weight_kg=payload.weight_kg,
                    allergies=payload.allergies,
                    chronic_conditions=payload.chronic_conditions,
                    current_medications=payload.current_medications,
                )
            )
        _ensure_role_directory_records(db, user)
        if payload.role == "doctor" and payload.clinic_name:
            clinic = CareOrganization(
                id=str(uuid.uuid4()),
                name=payload.clinic_name,
                organization_type="clinic",
                owner_user_id=user.id,
                address=payload.clinic_address,
                city=payload.city,
                phone=payload.phone,
                email=user.email,
                active=True,
            )
            db.add(clinic)
            db.flush()
            db.add(
                OrganizationMember(
                    id=str(uuid.uuid4()),
                    organization_id=clinic.id,
                    user_id=user.id,
                    member_role="doctor",
                    task_scope="owner,appointments,records,billing,staff",
                    status="active",
                )
            )
        if payload.role == "hospital_admin" and payload.hospital_name:
            hospital = db.query(Hospital).filter(Hospital.admin_user_id == user.id).first()
            if hospital is not None:
                hospital.name = payload.hospital_name
                hospital.address = payload.hospital_address
                hospital.city = payload.city or hospital.city
                for department_name in _split_departments(payload.hospital_departments):
                    db.add(
                        HospitalDepartment(
                            id=str(uuid.uuid4()),
                            hospital_id=hospital.id,
                            name=department_name,
                            speciality=department_name,
                            description="",
                            active=True,
                        )
                    )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.exception("Registration integrity failure for role %s", payload.role)
        raise HTTPException(400, "Registration could not be completed because a related record already exists or the database schema is out of date. Please retry with a unique email/registration number after migrations finish.") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Registration database failure for role %s", payload.role)
        raise HTTPException(400, f"Registration database error: {exc.__class__.__name__}") from exc

    access_tok = create_access_token(user.id, user.role)
    refresh_tok = create_refresh_token(user.id, user.role)
    _set_auth_cookies(response, access_token=access_tok, refresh_token=refresh_tok)
    return AuthResponse(
        access_token=access_tok,
        refresh_token=refresh_tok,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        profile_image_url=user.profile_image_url or "",
    )


@router.post("/register/patient-intake", response_model=PatientIntakeResponse)
async def register_patient_intake(
    request: Request,
    response: Response,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    full_name: Annotated[str, Form()],
    phone: Annotated[str, Form()] = "",
    age: Annotated[int | None, Form()] = None,
    city: Annotated[str, Form()] = "",
    blood_group: Annotated[str, Form()] = "",
    date_of_birth: Annotated[str, Form()] = "",
    gender: Annotated[str, Form()] = "",
    height_cm: Annotated[float | None, Form()] = None,
    weight_kg: Annotated[float | None, Form()] = None,
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
    from app.services.auth_service import check_ip_rate_limit
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")
    files = files or []
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    if len(files) != len(document_types):
        raise HTTPException(400, "Each uploaded file must have one document type")

    user = User(
        id=generate_12_digit_id(db, User),
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role="patient",
        phone=phone,
        registration_number="",
        age=age,
        gender=gender,
        city=city,
    )
    profile = PatientProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,

        blood_group=blood_group,
        date_of_birth=date_of_birth,
        gender=gender,
        height_cm=height_cm,
        weight_kg=weight_kg,
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
                "height_cm": height_cm is not None,
                "weight_kg": weight_kg is not None,
                "allergies": bool(allergies),
                "chronic_conditions": bool(chronic_conditions),
                "current_medications": bool(current_medications),
                "abha_number": bool(abha_number),
            },
        },
    )
    access_tok = create_access_token(user.id, user.role)
    refresh_tok = create_refresh_token(user.id, user.role)
    _set_auth_cookies(response, access_token=access_tok, refresh_token=refresh_tok)
    return PatientIntakeResponse(
        access_token=access_tok,
        refresh_token=refresh_tok,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        documents=[DocumentRecord.model_validate(doc, from_attributes=True) for doc in uploaded_documents],
        ingestion_jobs=[IngestionJobRecord.model_validate(job, from_attributes=True) for job in ingestion_jobs],
    )


@router.post("/login", response_model=LoginResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    from app.services.auth_service import check_ip_rate_limit, is_account_locked, track_login_failure, clear_login_failures, generate_login_mfa_otp
    
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")
        
    if is_account_locked(payload.email):
        raise HTTPException(403, "Account locked due to too many failed attempts. Try again in 5 minutes.")
        
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        track_login_failure(payload.email)
        raise HTTPException(401, "Invalid credentials")
        
    clear_login_failures(payload.email)
    
    # Generate temporary MFA token and OTP
    from app.core.security import create_mfa_token
    mfa_otp = generate_login_mfa_otp(user.email)
    mfa_token = create_mfa_token(user.id, user.role)
    
    from app.core.config import settings
    if settings.environment.lower() != "production":
        logger.info(f"[MFA SIMULATION] Login verification OTP for {user.email}: {mfa_otp}")
    else:
        logger.info(f"[MFA SIMULATION] Login verification OTP generated for {user.email}")
    
    return LoginResponse(
        mfa_required=True,
        mfa_token=mfa_token,
        simulated_otp=mfa_otp if settings.environment.lower() != "production" else None,
    )


@router.post("/mfa-verify", response_model=AuthResponse)
def mfa_verify(
    request: Request,
    response: Response,
    payload: MfaVerifyRequest,
    db: Session = Depends(get_db)
) -> AuthResponse:
    from app.services.auth_service import check_ip_rate_limit, verify_login_mfa_otp
    
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")
        
    from jose import jwt, JWTError
    from app.core.config import settings
    try:
        decoded = jwt.decode(payload.mfa_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if decoded.get("type") != "mfa_temp":
            raise HTTPException(401, "Invalid MFA session token")
        user_id = decoded.get("sub")
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(401, "User no longer exists")
            
        if not verify_login_mfa_otp(user.email, payload.otp):
            raise HTTPException(400, "Invalid or expired MFA verification code")

        _ensure_role_directory_records(db, user)
        db.commit()
            
        access_tok = create_access_token(user.id, user.role)
        refresh_tok = create_refresh_token(user.id, user.role)
        
        _set_auth_cookies(response, access_token=access_tok, refresh_token=refresh_tok)
        
        return AuthResponse(
            access_token=access_tok,
            refresh_token=refresh_tok,
            user_id=user.id,
            role=user.role,
            full_name=user.full_name,
            profile_image_url=user.profile_image_url or "",
        )
    except JWTError as exc:
        raise HTTPException(401, "MFA session expired or invalid") from exc


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(400, "Incorrect current password")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/me")
@router.get("/profile")
def get_me(current_user: User = Depends(get_current_user)) -> dict:
    gender = current_user.gender or ""
    if current_user.role == "patient" and current_user.profile:
        gender = current_user.profile.gender or ""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "phone": current_user.phone,
        "registration_number": current_user.registration_number,
        "age": current_user.age,
        "city": current_user.city,
        "gender": gender,
        "height_cm": current_user.profile.height_cm if current_user.role == "patient" and current_user.profile else None,
        "weight_kg": current_user.profile.weight_kg if current_user.role == "patient" and current_user.profile else None,
        "speciality": current_user.speciality,
        "profile_image_url": current_user.profile_image_url or "",
    }


@router.put("/me")
@router.put("/profile")
def update_me(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.age is not None:
        current_user.age = payload.age
    if payload.city is not None:
        current_user.city = payload.city
    if payload.gender is not None and current_user.role == "patient":
        profile = current_user.profile or db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if profile is None:
            profile = PatientProfile(id=str(uuid.uuid4()), user_id=current_user.id)
            db.add(profile)
        profile.gender = payload.gender
    elif payload.gender is not None:
        current_user.gender = payload.gender
    if current_user.role == "patient" and (payload.height_cm is not None or payload.weight_kg is not None):
        profile = current_user.profile or db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if profile is None:
            profile = PatientProfile(id=str(uuid.uuid4()), user_id=current_user.id)
            db.add(profile)
        if payload.height_cm is not None:
            profile.height_cm = payload.height_cm
        if payload.weight_kg is not None:
            profile.weight_kg = payload.weight_kg
    if payload.speciality is not None:
        current_user.speciality = payload.speciality
    if payload.profile_image_url is not None:
        value = payload.profile_image_url.strip()
        if not _is_trusted_profile_image(value):
            raise HTTPException(400, "Profile image must be a small PNG/JPEG/WebP/GIF data URL or trusted local/HTTPS URL")
        current_user.profile_image_url = value
    _ensure_role_directory_records(db, current_user)
    db.commit()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "phone": current_user.phone,
        "registration_number": current_user.registration_number,
        "age": current_user.age,
        "city": current_user.city,
        "gender": current_user.profile.gender if current_user.role == "patient" and current_user.profile else "",
        "height_cm": current_user.profile.height_cm if current_user.role == "patient" and current_user.profile else None,
        "weight_kg": current_user.profile.weight_kg if current_user.role == "patient" and current_user.profile else None,
        "speciality": current_user.speciality,
        "profile_image_url": current_user.profile_image_url or "",
    }


def _split_departments(value: str) -> list[str]:
    return [part.strip() for part in value.replace("\n", ",").split(",") if part.strip()]


@router.post("/refresh", response_model=AuthResponse)
def refresh_token(
    request: Request,
    response: Response,
    payload: TokenRefreshRequest,
    db: Session = Depends(get_db)
) -> AuthResponse:
    from jose import jwt, JWTError
    from app.core.config import settings
    from app.services.auth_service import is_token_revoked, revoke_token, check_ip_rate_limit, revoke_all_user_sessions
    
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")
        
    token_to_refresh = payload.refresh_token
    if not token_to_refresh and request:
        token_to_refresh = request.cookies.get("refresh_token")
        
    if not token_to_refresh:
        raise HTTPException(401, "Missing refresh token")
        
    try:
        decoded = jwt.decode(token_to_refresh, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if decoded.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        user_id = decoded.get("sub")
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(401, "User no longer exists")
            
        from app.services.auth_service import is_user_session_revoked
        token_iat = decoded.get("iat", 0)
        if is_user_session_revoked(user.id, token_iat):
            raise HTTPException(401, "Token session has been invalidated globally")
            
        # REUSE DETECTION: if the refresh token is already revoked, revoke ALL user sessions!
        if is_token_revoked(token_to_refresh):
            revoke_all_user_sessions(user.id)
            raise HTTPException(401, "Refresh token has been reused. Revoking all active user sessions.")
            
        # Revoke the old refresh token
        revoke_token(token_to_refresh, expires_in_seconds=7 * 86400)
        
        access_tok = create_access_token(user.id, user.role)
        refresh_tok = create_refresh_token(user.id, user.role)
        
        _set_auth_cookies(response, access_token=access_tok, refresh_token=refresh_tok)
        
        return AuthResponse(
            access_token=access_tok,
            refresh_token=refresh_tok,
            user_id=user.id,
            role=user.role,
            full_name=user.full_name,
            profile_image_url=user.profile_image_url or "",
        )
    except JWTError as exc:
        raise HTTPException(401, "Invalid or expired refresh token") from exc


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Extract token from header to revoke it
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ")[1]
        from app.services.auth_service import revoke_token
        revoke_token(token, expires_in_seconds=settings.jwt_expire_minutes * 60)
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        from app.services.auth_service import revoke_token
        revoke_token(cookie_token, expires_in_seconds=settings.jwt_expire_minutes * 60)
    _clear_auth_cookies(response)
    return {"message": "Successfully logged out and session revoked"}


@router.post("/forgot-password")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    from app.services.auth_service import check_ip_rate_limit
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        # Prevent user enumeration by returning a generic success message
        return {"message": "If this email is registered, a password reset code has been sent."}
        
    from app.services.auth_service import generate_reset_otp
    otp = generate_reset_otp(user.email)
    
    from app.core.config import settings
    if settings.environment.lower() != "production":
        logger.info(f"[EMAIL SIMULATION] Password reset requested for {user.email}. OTP: {otp}")
        return {
            "message": "If this email is registered, a password reset code has been sent.",
            "simulated_otp": otp
        }
    else:
        logger.info(f"[EMAIL SIMULATION] Password reset requested for {user.email}")
        return {
            "message": "If this email is registered, a password reset code has been sent."
        }


@router.post("/reset-password")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    from app.services.auth_service import verify_reset_otp, check_ip_rate_limit
    
    ip = request.client.host if request.client else "127.0.0.1"
    if not check_ip_rate_limit(ip, limit=60, period=60):
        raise HTTPException(429, "Too many requests. Please try again later.")
        
    if not verify_reset_otp(payload.email, payload.otp):
        raise HTTPException(400, "Invalid or expired password reset code")
        
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        raise HTTPException(404, "User not found")
        
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password has been reset successfully. Please login with your new password."}

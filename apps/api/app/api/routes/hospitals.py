from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User
from app.schemas.features import (
    AppointmentStatusUpdate,
    ConsultationBookingCreate,
    ConsultationSlotCreate,
    HospitalCreate,
    HospitalDepartmentCreate,
    HospitalDoctorCreate,
)
from app.services.hospital_service import HospitalService

router = APIRouter()


def _record(obj) -> dict:
    return {column.name: getattr(obj, column.name) for column in obj.__table__.columns}


@router.post("")
def create_hospital(
    payload: HospitalCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    hospital = HospitalService(db).create_hospital(admin=admin, payload=payload.model_dump())
    return _record(hospital)


@router.get("")
def list_hospitals(
    city: str = Query(default=""),
    speciality: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [
        _record(item)
        for item in HospitalService(db).list_hospitals(city=city, speciality=speciality)
    ]


@router.post("/departments")
def create_department(
    payload: HospitalDepartmentCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        department = HospitalService(db).create_department(admin=admin, payload=payload.model_dump())
    except (LookupError, PermissionError) as exc:
        raise HTTPException(403 if isinstance(exc, PermissionError) else 404, str(exc)) from exc
    return _record(department)


@router.post("/doctors")
def assign_doctor(
    payload: HospitalDoctorCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        record = HospitalService(db).assign_doctor(admin=admin, payload=payload.model_dump())
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _record(record)


@router.post("/slots")
def create_consultation_slot(
    payload: ConsultationSlotCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        slot = HospitalService(db).create_slot(admin=admin, payload=payload.model_dump())
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _record(slot)


@router.get("/slots")
def list_consultation_slots(
    hospital_id: str = Query(default=""),
    doctor_id: str = Query(default=""),
    speciality: str = Query(default=""),
    date: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [
        _record(slot)
        for slot in HospitalService(db).list_slots(
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            speciality=speciality,
            date=date,
        )
    ]


@router.post("/consultations/book")
def book_consultation(
    payload: ConsultationBookingCreate,
    patient: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        appointment = HospitalService(db).book_consultation(
            patient=patient,
            slot_id=payload.slot_id,
            appointment_type=payload.appointment_type,
            reason=payload.reason,
            notes=payload.notes,
            urgency=payload.urgency,
        )
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return _record(appointment)


@router.patch("/appointments/{appointment_id}")
def update_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        appointment = HospitalService(db).update_appointment_status(
            actor=user,
            appointment_id=appointment_id,
            status=payload.status,
            cancellation_reason=payload.cancellation_reason,
        )
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _record(appointment)


@router.get("/appointments")
def list_my_appointments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    service = HospitalService(db)
    if user.role == "patient":
        return [_record(item) for item in service.list_patient_appointments(patient_id=user.id)]
    if user.role == "doctor":
        return [_record(item) for item in service.list_doctor_appointments(doctor_id=user.id)]
    return []

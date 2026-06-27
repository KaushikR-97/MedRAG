import uuid
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role, hash_password, generate_12_digit_id
from app.db.session import get_db
from app.models.user import User
from app.schemas.features import (
    AppointmentStatusUpdate,
    ConsultationBookingCreate,
    ConsultationSlotCreate,
    HospitalCreate,
    HospitalDepartmentCreate,
    HospitalDoctorCreate,
    HospitalDoctorRegister,
)
from app.services.hospital_service import HospitalService
from app.services.compliance_service import ComplianceService

router = APIRouter()


def _record(obj) -> dict:
    return {column.name: getattr(obj, column.name) for column in obj.__table__.columns}


@router.post("")
def create_hospital(
    payload: HospitalCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        hospital = HospitalService(db).create_hospital(admin=admin, payload=payload.model_dump())
        return _record(hospital)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error creating hospital: {str(exc)}\n{traceback.format_exc()}") from exc



@router.get("")
def list_hospitals(
    city: str = Query(default=""),
    speciality: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[dict]:
    try:
        return [
            _record(item)
            for item in HospitalService(db).list_hospitals(city=city, speciality=speciality)
        ]
    except Exception as exc:
        raise HTTPException(400, f"Error listing hospitals: {str(exc)}\n{traceback.format_exc()}") from exc


@router.post("/departments")
def create_department(
    payload: HospitalDepartmentCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        department = HospitalService(db).create_department(admin=admin, payload=payload.model_dump())
        return _record(department)
    except (LookupError, PermissionError) as exc:
        raise HTTPException(403 if isinstance(exc, PermissionError) else 404, str(exc)) from exc
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error creating department: {str(exc)}\n{traceback.format_exc()}") from exc


@router.post("/doctors")
def assign_doctor(
    payload: HospitalDoctorCreate,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        record = HospitalService(db).assign_doctor(admin=admin, payload=payload.model_dump())
        return _record(record)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error assigning doctor: {str(exc)}\n{traceback.format_exc()}") from exc


@router.post("/slots")
def create_consultation_slot(
    payload: ConsultationSlotCreate,
    admin: User = Depends(require_role("hospital_admin", "doctor")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        slot = HospitalService(db).create_slot(admin=admin, payload=payload.model_dump())
        return _record(slot)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error processing slot release: {str(exc)}\n{traceback.format_exc()}") from exc


@router.get("/slots")
def list_consultation_slots(
    hospital_id: str = Query(default=""),
    doctor_id: str = Query(default=""),
    speciality: str = Query(default=""),
    date: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[dict]:
    try:
        slots = HospitalService(db).list_slots(
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            speciality=speciality,
            date=date,
        )
        records = []
        from app.models.user import User
        for slot in slots:
            rec = _record(slot)
            doc = db.query(User).filter(User.id == slot.doctor_id).first()
            if doc:
                rec["doctor_name"] = doc.full_name
                rec["doctor_speciality"] = doc.speciality or "General Physician"
                rec["doctor_registration_number"] = doc.registration_number or "N/A"
            else:
                rec["doctor_name"] = "Unknown Doctor"
                rec["doctor_speciality"] = "General Physician"
                rec["doctor_registration_number"] = "N/A"
            records.append(rec)
        return records
    except Exception as exc:
        raise HTTPException(400, f"Error listing slots: {str(exc)}\n{traceback.format_exc()}") from exc


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
            payment_method=payload.payment_method,
            insurance_provider=payload.insurance_provider,
            insurance_policy_number=payload.insurance_policy_number,
        )
        return _record(appointment)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error booking consultation: {str(exc)}\n{traceback.format_exc()}") from exc



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
        return _record(appointment)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error updating appointment status: {str(exc)}\n{traceback.format_exc()}") from exc


@router.get("/appointments")
def list_my_appointments(
    patient_id: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    try:
        service = HospitalService(db)
        if user.role == "patient":
            target_patient_id = patient_id or user.id
            if not ComplianceService(db).can_access_patient(actor=user, patient_id=target_patient_id, scope="profile.read"):
                raise HTTPException(403, "Missing patient consent or care-team access")
            return [_record(item) for item in service.list_patient_appointments(patient_id=target_patient_id)]
        if user.role == "doctor":
            return [_record(item) for item in service.list_doctor_appointments(doctor_id=user.id)]
        return []
    except HTTPException as http_exc:
        raise http_exc
    except Exception as exc:
        raise HTTPException(400, f"Error listing appointments: {str(exc)}\n{traceback.format_exc()}") from exc


@router.post("/create-doctor")
def create_doctor_profile(
    payload: HospitalDoctorRegister,
    admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    try:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(400, "Email already registered")
        HospitalService(db)._assert_hospital_admin(admin=admin, hospital_id=payload.hospital_id)
        doctor = User(
            id=generate_12_digit_id(db, User),
            email=str(payload.email),
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            role="doctor",
            phone=payload.phone,
            registration_number=payload.registration_number,
            speciality=payload.speciality,
        )
        db.add(doctor)
        db.flush()
        record = HospitalService(db).assign_doctor(
            admin=admin,
            payload={
                "hospital_id": payload.hospital_id,
                "department_id": payload.department_id,
                "doctor_id": doctor.id,
                "consultation_fee": payload.consultation_fee,
            },
        )
        return {
            "doctor_user_id": doctor.id,
            "doctor_assignment_id": record.id,
            "full_name": doctor.full_name,
            "email": doctor.email,
            "speciality": record.speciality or "",
        }
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(400, f"Error creating doctor: {str(exc)}\n{traceback.format_exc()}") from exc


@router.get("/doctors")
def list_doctors_by_city(
    city: str = Query(default=""),
    speciality: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[dict]:
    try:
        from app.models.feature_modules import HospitalDoctor
        query = db.query(User).filter(User.role == "doctor")
        if city:
            query = query.filter(User.city.ilike(f"%{city}%"))
        if speciality:
            query = query.filter(User.speciality.ilike(f"%{speciality}%"))
        
        doctors_list = []
        for doc in query.all():
            assignment = db.query(HospitalDoctor).filter(HospitalDoctor.doctor_id == doc.id, HospitalDoctor.active.is_(True)).first()
            fee = assignment.consultation_fee if assignment else 0.0
            doctors_list.append({
                "id": doc.id,
                "full_name": doc.full_name,
                "email": doc.email,
                "phone": doc.phone,
                "speciality": doc.speciality or "",
                "city": doc.city or "",
                "consultation_fee": fee
            })
        return doctors_list
    except Exception as exc:
        raise HTTPException(400, f"Error listing doctors by city: {str(exc)}\n{traceback.format_exc()}") from exc


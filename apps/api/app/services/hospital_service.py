import uuid
from datetime import UTC, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.feature_modules import (
    Appointment,
    ConsultationSlot,
    Hospital,
    HospitalDepartment,
    HospitalDoctor,
)
from app.models.user import User


class HospitalService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_hospital(self, *, admin: User, payload: dict) -> Hospital:
        hospital = Hospital(id=str(uuid.uuid4()), admin_user_id=admin.id, **payload)
        self.db.add(hospital)
        self.db.commit()
        self.db.refresh(hospital)
        return hospital

    def create_department(self, *, admin: User, payload: dict) -> HospitalDepartment:
        self._assert_hospital_admin(admin=admin, hospital_id=payload["hospital_id"])
        department = HospitalDepartment(id=str(uuid.uuid4()), **payload)
        self.db.add(department)
        self.db.commit()
        self.db.refresh(department)
        return department

    def assign_doctor(self, *, admin: User, payload: dict) -> HospitalDoctor:
        self._assert_hospital_admin(admin=admin, hospital_id=payload["hospital_id"])
        try:
            doctor = self.db.get(User, payload["doctor_id"])
        except Exception as exc:
            raise LookupError(f"Invalid doctor ID format: {str(exc)}") from exc
        if doctor is None or doctor.role != "doctor":
            raise LookupError("Doctor user not found")
        try:
            department = self.db.get(HospitalDepartment, payload["department_id"])
        except Exception as exc:
            raise LookupError(f"Invalid department ID format: {str(exc)}") from exc
        if department is None or department.hospital_id != payload["hospital_id"]:
            raise LookupError("Department not found for hospital")
        try:
            record = HospitalDoctor(id=str(uuid.uuid4()), **payload)
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record
        except Exception as exc:
            self.db.rollback()
            raise exc

    def create_slot(self, *, admin: User, payload: dict) -> ConsultationSlot:
        if admin.role == "doctor":
            payload["doctor_id"] = admin.id
            if not payload.get("hospital_id") or payload.get("hospital_id") == "personal":
                payload["hospital_id"] = None
            if not payload.get("department_id") or payload.get("department_id") == "personal":
                payload["department_id"] = None
        else:
            self._assert_hospital_admin(admin=admin, hospital_id=payload["hospital_id"])
            try:
                assignment = (
                    self.db.query(HospitalDoctor)
                    .filter(
                        HospitalDoctor.hospital_id == payload["hospital_id"],
                        HospitalDoctor.department_id == payload["department_id"],
                        HospitalDoctor.doctor_id == payload["doctor_id"],
                        HospitalDoctor.active.is_(True),
                    )
                    .first()
                )
            except Exception as exc:
                raise LookupError(f"Invalid hospital, department or doctor ID: {str(exc)}") from exc
            if assignment is None:
                raise LookupError("Doctor is not assigned to this hospital department")
            if not payload.get("consultation_fee"):
                payload["consultation_fee"] = assignment.consultation_fee or 0.0
        
        try:
            slot = ConsultationSlot(id=str(uuid.uuid4()), **payload)
            self.db.add(slot)
            self.db.commit()
            self.db.refresh(slot)
            return slot
        except Exception as exc:
            self.db.rollback()
            raise exc
        return slot

    def list_hospitals(self, *, city: str = "", speciality: str = "") -> list[Hospital]:
        query = self.db.query(Hospital).filter(Hospital.active.is_(True))
        if city:
            query = query.filter(Hospital.city.ilike(f"%{city}%"))
        if speciality:
            query = query.join(HospitalDepartment, HospitalDepartment.hospital_id == Hospital.id).filter(
                HospitalDepartment.speciality.ilike(f"%{speciality}%"),
                HospitalDepartment.active.is_(True),
            )
        return query.order_by(Hospital.name.asc()).limit(50).all()

    def list_slots(
        self,
        *,
        hospital_id: str = "",
        doctor_id: str = "",
        speciality: str = "",
        date: str = "",
    ) -> list[ConsultationSlot]:
        query = self.db.query(ConsultationSlot).filter(ConsultationSlot.status == "open")
        if hospital_id:
            query = query.filter(ConsultationSlot.hospital_id == hospital_id)
        if doctor_id:
            query = query.filter(ConsultationSlot.doctor_id == doctor_id)
        if date:
            query = query.filter(ConsultationSlot.date == date)
        if speciality:
            query = query.outerjoin(
                HospitalDepartment,
                HospitalDepartment.id == ConsultationSlot.department_id,
            ).outerjoin(
                User,
                User.id == ConsultationSlot.doctor_id,
            ).filter(
                or_(
                    HospitalDepartment.speciality.ilike(f"%{speciality}%"),
                    User.speciality.ilike(f"%{speciality}%"),
                    ConsultationSlot.department_id.is_(None),
                )
            )
        query = query.filter(ConsultationSlot.booked_count < ConsultationSlot.capacity)
        return query.order_by(ConsultationSlot.date.asc(), ConsultationSlot.start_time.asc()).limit(100).all()

    def book_consultation(
        self,
        *,
        patient: User,
        slot_id: str,
        appointment_type: str,
        reason: str,
        notes: str,
        urgency: str,
        payment_method: str = "cash",
        insurance_provider: str = "",
        insurance_policy_number: str = "",
    ) -> Appointment:
        slot = self.db.get(ConsultationSlot, slot_id)
        if slot is None or slot.status != "open":
            raise LookupError("Consultation slot not found")
        if slot.booked_count >= slot.capacity:
            raise ValueError("Consultation slot is full")

        slot.booked_count += 1
        if slot.booked_count >= slot.capacity:
            slot.status = "booked"
        appointment = Appointment(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            doctor_id=slot.doctor_id,
            hospital_id=slot.hospital_id,
            department_id=slot.department_id,
            slot_id=slot.id,
            appointment_type=appointment_type,
            consultation_mode=slot.consultation_mode,
            date=slot.date,
            time_slot=f"{slot.start_time}-{slot.end_time}",
            status="confirmed",
            urgency=urgency,
            notes=notes,
            reason=reason,
            payment_method=payment_method,
            insurance_provider=insurance_provider,
            insurance_policy_number=insurance_policy_number,
            consultation_fee=slot.consultation_fee or 0.0,
            booking_reference=self._booking_reference(),
        )
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def update_appointment_status(
        self,
        *,
        actor: User,
        appointment_id: str,
        status: str,
        cancellation_reason: str = "",
    ) -> Appointment:
        appointment = self.db.get(Appointment, appointment_id)
        if appointment is None:
            raise LookupError("Appointment not found")
        if actor.role == "patient" and appointment.patient_id != actor.id:
            raise PermissionError("Cannot update another patient's appointment")
        if actor.role in {"doctor", "hospital_admin"} and actor.role != "hospital_admin":
            if appointment.doctor_id != actor.id:
                raise PermissionError("Doctor can only update own appointments")

        if status == "cancelled" and appointment.slot_id:
            slot = self.db.get(ConsultationSlot, appointment.slot_id)
            if slot is not None and appointment.status != "cancelled":
                slot.booked_count = max(0, slot.booked_count - 1)
                if slot.status == "booked":
                    slot.status = "open"
        appointment.status = status
        appointment.cancellation_reason = cancellation_reason
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def list_patient_appointments(self, *, patient_id: str) -> list[Appointment]:
        return (
            self.db.query(Appointment)
            .filter(Appointment.patient_id == patient_id)
            .order_by(Appointment.date.desc(), Appointment.time_slot.desc())
            .limit(100)
            .all()
        )

    def list_doctor_appointments(self, *, doctor_id: str) -> list[Appointment]:
        return (
            self.db.query(Appointment)
            .filter(Appointment.doctor_id == doctor_id)
            .order_by(Appointment.date.desc(), Appointment.time_slot.desc())
            .limit(100)
            .all()
        )

    def _assert_hospital_admin(self, *, admin: User, hospital_id: str) -> Hospital:
        try:
            hospital = self.db.get(Hospital, hospital_id)
        except Exception as exc:
            raise LookupError(f"Invalid hospital ID format or database error: {str(exc)}") from exc
        if hospital is None:
            raise LookupError("Hospital not found")
        if admin.role != "hospital_admin" or hospital.admin_user_id != admin.id:
            raise PermissionError("Only this hospital's admin can manage it")
        return hospital

    @staticmethod
    def _booking_reference() -> str:
        stamp = datetime.now(UTC).strftime("%Y%m%d")
        return f"CONS-{stamp}-{uuid.uuid4().hex[:8].upper()}"

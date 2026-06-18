from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    target: Mapped[str] = mapped_column(String(320), index=True)
    channel: Mapped[str] = mapped_column(String(32), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    purpose: Mapped[str] = mapped_column(String(80), index=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    diagnosis: Mapped[str] = mapped_column(Text)
    medications: Mapped[str] = mapped_column(Text)
    dosage: Mapped[str] = mapped_column(Text, default="")
    duration: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    follow_up_date: Mapped[str] = mapped_column(String(32), default="")
    pmjay_covered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    hospital_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    department_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    slot_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    appointment_type: Mapped[str] = mapped_column(String(120))
    consultation_mode: Mapped[str] = mapped_column(String(32), default="in_person", index=True)
    date: Mapped[str] = mapped_column(String(32))
    time_slot: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="requested", index=True)
    urgency: Mapped[str] = mapped_column(String(32), default="routine", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    booking_reference: Mapped[str] = mapped_column(String(80), default="", index=True)
    cancellation_reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    registration_number: Mapped[str] = mapped_column(String(120), default="", index=True)
    address: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(120), default="", index=True)
    state: Mapped[str] = mapped_column(String(120), default="", index=True)
    pincode: Mapped[str] = mapped_column(String(16), default="", index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    emergency_phone: Mapped[str] = mapped_column(String(40), default="")
    admin_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class HospitalDepartment(Base):
    __tablename__ = "hospital_departments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id"), index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    speciality: Mapped[str] = mapped_column(String(160), default="", index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class HospitalDoctor(Base):
    __tablename__ = "hospital_doctors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id"), index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("hospital_departments.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    speciality: Mapped[str] = mapped_column(String(160), default="", index=True)
    consultation_fee: Mapped[float] = mapped_column(Float, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class ConsultationSlot(Base):
    __tablename__ = "consultation_slots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id"), index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("hospital_departments.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[str] = mapped_column(String(32), index=True)
    start_time: Mapped[str] = mapped_column(String(16))
    end_time: Mapped[str] = mapped_column(String(16))
    consultation_mode: Mapped[str] = mapped_column(String(32), default="in_person", index=True)
    capacity: Mapped[int] = mapped_column(default=1)
    booked_count: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class HealthTask(Base):
    __tablename__ = "health_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    task_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(32), default="medium", index=True)
    due_date: Mapped[str] = mapped_column(String(32), default="")
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    relation: Mapped[str] = mapped_column(String(80))
    age: Mapped[int] = mapped_column(default=0)
    notes: Mapped[str] = mapped_column(Text, default="")


class MedicationReminder(Base):
    __tablename__ = "medication_reminders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    medicine_name: Mapped[str] = mapped_column(String(160))
    dosage: Mapped[str] = mapped_column(String(120), default="")
    schedule: Mapped[str] = mapped_column(String(160))
    channel: Mapped[str] = mapped_column(String(32), default="whatsapp")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SymptomEntry(Base):
    __tablename__ = "symptom_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    symptoms: Mapped[str] = mapped_column(Text)
    severity: Mapped[int] = mapped_column(default=1)
    duration: Mapped[str] = mapped_column(String(120), default="")
    triage_result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    test_name: Mapped[str] = mapped_column(String(160), index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(40), default="")
    interpretation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class VaccinationRecord(Base):
    __tablename__ = "vaccination_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    vaccine_name: Mapped[str] = mapped_column(String(160))
    dose_date: Mapped[str] = mapped_column(String(32))
    next_due_date: Mapped[str] = mapped_column(String(32), default="")


class PregnancyRecord(Base):
    __tablename__ = "pregnancy_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lmp_date: Mapped[str] = mapped_column(String(32))
    estimated_due_date: Mapped[str] = mapped_column(String(32), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class MentalHealthScreening(Base):
    __tablename__ = "mental_health_screenings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    screening_type: Mapped[str] = mapped_column(String(32), index=True)
    score: Mapped[int]
    risk_level: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class CaregiverLink(Base):
    __tablename__ = "caregiver_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)
    scope: Mapped[str] = mapped_column(String(120), default="summary")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DiseaseOutbreakAlert(Base):
    __tablename__ = "disease_outbreak_alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    state: Mapped[str] = mapped_column(String(120), index=True)
    city: Mapped[str] = mapped_column(String(120), index=True)
    disease: Mapped[str] = mapped_column(String(160), index=True)
    severity: Mapped[str] = mapped_column(String(32), index=True)
    message: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class PatientCalendarEvent(Base):
    __tablename__ = "patient_calendar_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="scheduled", index=True)
    source: Mapped[str] = mapped_column(String(80), default="agent")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class AgentActionLog(Base):
    __tablename__ = "agent_action_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    agent_name: Mapped[str] = mapped_column(String(120), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(32), default="completed", index=True)
    reasoning: Mapped[str] = mapped_column(Text, default="")
    tool_payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class EmergencyDispatchRequest(Base):
    __tablename__ = "emergency_dispatch_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    symptoms: Mapped[str] = mapped_column(Text)
    severity: Mapped[int] = mapped_column(default=10)
    location_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="requested", index=True)
    provider_reference: Mapped[str] = mapped_column(String(120), default="")
    safety_label: Mapped[str] = mapped_column(String(80), default="urgent_escalation", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

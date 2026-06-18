from pydantic import BaseModel, Field


class SendOtpRequest(BaseModel):
    target: str
    channel: str = Field(pattern="^(email|sms|whatsapp)$")
    purpose: str = "verify"


class VerifyOtpRequest(BaseModel):
    target: str
    code: str
    purpose: str = "verify"


class PrescriptionCreate(BaseModel):
    patient_id: str
    diagnosis: str
    medications: str
    dosage: str = ""
    duration: str = ""
    instructions: str = ""
    follow_up_date: str = ""
    pmjay_covered: bool = False


class AppointmentCreate(BaseModel):
    doctor_id: str | None = None
    hospital_id: str = ""
    department_id: str = ""
    slot_id: str = ""
    appointment_type: str
    consultation_mode: str = Field(default="in_person", pattern="^(in_person|video|phone)$")
    date: str
    time_slot: str
    urgency: str = "routine"
    notes: str = ""
    reason: str = ""


class HospitalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    registration_number: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    phone: str = ""
    email: str = ""
    emergency_phone: str = ""


class HospitalDepartmentCreate(BaseModel):
    hospital_id: str
    name: str = Field(min_length=2, max_length=160)
    speciality: str = ""
    description: str = ""


class HospitalDoctorCreate(BaseModel):
    hospital_id: str
    department_id: str
    doctor_id: str
    speciality: str = ""
    consultation_fee: float = Field(default=0, ge=0)


class ConsultationSlotCreate(BaseModel):
    hospital_id: str
    department_id: str
    doctor_id: str
    date: str
    start_time: str
    end_time: str
    consultation_mode: str = Field(default="in_person", pattern="^(in_person|video|phone)$")
    capacity: int = Field(default=1, ge=1, le=100)


class ConsultationBookingCreate(BaseModel):
    slot_id: str
    appointment_type: str = "consultation"
    reason: str = ""
    notes: str = ""
    urgency: str = "routine"


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(requested|confirmed|checked_in|completed|cancelled|no_show)$")
    cancellation_reason: str = ""


class FamilyMemberCreate(BaseModel):
    full_name: str
    relation: str
    age: int = 0
    notes: str = ""


class MedicationReminderCreate(BaseModel):
    medicine_name: str
    dosage: str = ""
    schedule: str
    channel: str = "whatsapp"


class SymptomTrackRequest(BaseModel):
    symptoms: str
    severity: int = Field(ge=1, le=10)
    duration: str = ""


class LabResultCreate(BaseModel):
    test_name: str
    value: float
    unit: str = ""


class VaccinationCreate(BaseModel):
    vaccine_name: str
    dose_date: str
    next_due_date: str = ""


class PregnancyCreate(BaseModel):
    lmp_date: str
    notes: str = ""


class MentalHealthCreate(BaseModel):
    screening_type: str = Field(pattern="^(phq9|gad7)$")
    score: int = Field(ge=0, le=27)


class DrugInteractionRequest(BaseModel):
    medicines: list[str]


class SecondOpinionRequest(BaseModel):
    case_summary: str
    guideline_context: str = ""


class SoapRequest(BaseModel):
    visit_summary: str


class ReferralRequest(BaseModel):
    patient_id: str
    reason: str
    speciality: str


class FacilitySearchRequest(BaseModel):
    city: str
    state: str


class OutbreakAlertCreate(BaseModel):
    state: str
    city: str
    disease: str
    severity: str
    message: str


class YearlyHealthScanRequest(BaseModel):
    preferred_date: str = ""
    preferred_time_slot: str = "09:00-11:00"


class SymptomCareAgentRequest(BaseModel):
    patient_id: str | None = None
    symptoms: str = Field(min_length=3, max_length=2000)
    severity: int = Field(ge=1, le=10)
    duration: str = ""
    location_text: str = ""
    preferred_date: str = ""
    preferred_time_slot: str = ""


class CareAgentResponse(BaseModel):
    action: str
    safety_label: str
    reasoning: str
    result: dict

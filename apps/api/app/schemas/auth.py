from pydantic import BaseModel, EmailStr, Field

from app.schemas.documents import DocumentRecord, IngestionJobRecord


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    role: str = Field(pattern="^(patient|doctor|hospital_admin)$")
    phone: str = ""
    registration_number: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str


class PatientIntakeResponse(AuthResponse):
    documents: list[DocumentRecord] = Field(default_factory=list)
    ingestion_jobs: list[IngestionJobRecord] = Field(default_factory=list)

import re
from dataclasses import dataclass

from fastapi import HTTPException

from app.models.user import User


AADHAAR_RE = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
PHONE_RE = re.compile(r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
ABHA_RE = re.compile(r"\b\d{2}-\d{4}-\d{4}-\d{4}\b")


@dataclass(frozen=True)
class DataAccessDecision:
    allowed: bool
    reason: str


class PrivacyService:
    """Central privacy and data-loss-prevention policy.

    The goal is to keep PHI access explicit and prevent accidental leakage in
    AI responses, logs, exports, and staff workflows.
    """

    def redact_phi(self, text: str) -> str:
        redacted = AADHAAR_RE.sub("[REDACTED_AADHAAR]", text)
        redacted = ABHA_RE.sub("[REDACTED_ABHA]", redacted)
        redacted = PHONE_RE.sub("[REDACTED_PHONE]", redacted)
        redacted = EMAIL_RE.sub("[REDACTED_EMAIL]", redacted)
        return redacted

    def assert_no_download(self, *, actor: User, patient_id: str, resource: str) -> None:
        if actor.id == patient_id:
            return
        if actor.role in {"doctor", "hospital_admin"}:
            raise HTTPException(
                status_code=403,
                detail=f"Download/export blocked for {resource}. Clinical staff may view minimum necessary data only.",
            )
        raise HTTPException(status_code=403, detail="Access denied")

    def minimum_necessary_text(self, *, actor: User, patient_id: str, text: str) -> str:
        if actor.id == patient_id:
            return text
        return self.redact_phi(text)


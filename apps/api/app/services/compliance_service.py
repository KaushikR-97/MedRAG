from datetime import UTC, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.compliance import CareTeamMembership, ConsentGrant
from app.models.user import User


class ComplianceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def can_access_patient(self, *, actor: User, patient_id: str, scope: str) -> bool:
        if actor.id == patient_id:
            return True
        if actor.role not in {"doctor", "hospital_admin"}:
            return False

        now = datetime.now(UTC)
        membership = (
            self.db.query(CareTeamMembership)
            .filter(
                CareTeamMembership.patient_id == patient_id,
                CareTeamMembership.clinician_id == actor.id,
                CareTeamMembership.active.is_(True),
            )
            .first()
        )
        consent = (
            self.db.query(ConsentGrant)
            .filter(
                ConsentGrant.patient_id == patient_id,
                ConsentGrant.grantee_id == actor.id,
                ConsentGrant.scope.in_([scope, "all"]),
                ConsentGrant.revoked_at.is_(None),
                ConsentGrant.starts_at <= now,
                or_(ConsentGrant.expires_at.is_(None), ConsentGrant.expires_at > now),
            )
            .first()
        )
        return membership is not None and consent is not None

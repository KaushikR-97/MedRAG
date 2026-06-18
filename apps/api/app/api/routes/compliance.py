import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.compliance import CareTeamMembership, ConsentGrant
from app.models.user import User
from app.schemas.compliance import (
    CareTeamCreate,
    CareTeamRecord,
    ConsentGrantCreate,
    ConsentGrantRecord,
)

router = APIRouter()


@router.post("/consents", response_model=ConsentGrantRecord)
def create_consent(
    payload: ConsentGrantCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConsentGrantRecord:
    if user.id != payload.patient_id and user.role != "hospital_admin":
        raise HTTPException(403, "Only the patient or hospital admin can grant consent")
    grant = ConsentGrant(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return ConsentGrantRecord.model_validate(grant, from_attributes=True)


@router.post("/care-team", response_model=CareTeamRecord)
def add_care_team_member(
    payload: CareTeamCreate,
    _admin: User = Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> CareTeamRecord:
    membership = CareTeamMembership(id=str(uuid.uuid4()), **payload.model_dump(), active=True)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return CareTeamRecord.model_validate(membership, from_attributes=True)


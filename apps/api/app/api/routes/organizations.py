import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.feature_modules import CareOrganization, Hospital, OrganizationMember
from app.models.user import User

router = APIRouter()


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    organization_type: str = Field(default="clinic", pattern="^(solo_clinic|clinic|hospital|diagnostic_center|pharmacy)$")
    linked_hospital_id: str | None = None
    address: str = ""
    city: str = ""
    state: str = ""
    phone: str = ""
    email: str = ""


class OrganizationMemberCreate(BaseModel):
    user_id: str
    member_role: str = Field(default="staff", pattern="^(doctor|admin|nurse|front_desk|pharmacist|lab_staff|billing|ambulance_dispatch|staff)$")
    task_scope: str = "appointments,records"


@router.post("")
def create_organization(
    payload: OrganizationCreate,
    user: User = Depends(require_role("doctor", "hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    _validate_organization_creation(db=db, user=user, payload=payload)
    org = CareOrganization(
        id=str(uuid.uuid4()),
        name=payload.name,
        organization_type=payload.organization_type,
        owner_user_id=user.id,
        linked_hospital_id=payload.linked_hospital_id,
        address=payload.address,
        city=payload.city or user.city or "",
        state=payload.state,
        phone=payload.phone or user.phone,
        email=payload.email or user.email,
        active=True,
        created_at=datetime.now(UTC),
    )
    db.add(org)
    db.flush()
    db.add(
        OrganizationMember(
            id=str(uuid.uuid4()),
            organization_id=org.id,
            user_id=user.id,
            member_role="admin" if user.role == "hospital_admin" else "doctor",
            task_scope="owner,appointments,records,billing,staff,resources",
            status="active",
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    db.refresh(org)
    return _org_record(db, org)


@router.get("")
def list_organizations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    if user.role not in {"doctor", "hospital_admin"}:
        raise HTTPException(403, "Only doctors and admins can manage organizations")
    owned = db.query(CareOrganization).filter(CareOrganization.owner_user_id == user.id).all()
    memberships = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id, OrganizationMember.status == "active")
        .all()
    )
    member_orgs = [db.get(CareOrganization, item.organization_id) for item in memberships]
    orgs = {org.id: org for org in owned + [item for item in member_orgs if item is not None]}
    return [_org_record(db, org) for org in orgs.values()]


@router.post("/{organization_id}/members")
def add_organization_member(
    organization_id: str,
    payload: OrganizationMemberCreate,
    user: User = Depends(require_role("doctor", "hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    org = db.get(CareOrganization, organization_id)
    if org is None:
        raise HTTPException(404, "Organization not found")
    if not _can_manage_organization(db, org=org, user=user):
        raise HTTPException(403, "Only organization owner/admin can add members")
    member_user = db.get(User, payload.user_id)
    if member_user is None:
        raise HTTPException(404, "User not found")
    existing = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == payload.user_id)
        .first()
    )
    if existing:
        existing.member_role = payload.member_role
        existing.task_scope = payload.task_scope
        existing.status = "active"
        member = existing
    else:
        member = OrganizationMember(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            user_id=payload.user_id,
            member_role=payload.member_role,
            task_scope=payload.task_scope,
            status="active",
            created_at=datetime.now(UTC),
        )
        db.add(member)
    db.commit()
    return _member_record(db, member)


@router.get("/{organization_id}/members")
def list_organization_members(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    org = db.get(CareOrganization, organization_id)
    if org is None:
        raise HTTPException(404, "Organization not found")
    allowed = org.owner_user_id == user.id or bool(
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.status == "active",
        )
        .first()
    )
    if not allowed:
        raise HTTPException(403, "Not an organization member")
    rows = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == organization_id, OrganizationMember.status == "active")
        .order_by(OrganizationMember.created_at.desc())
        .all()
    )
    return [_member_record(db, row) for row in rows]


def _validate_organization_creation(db: Session, user: User, payload: OrganizationCreate) -> None:
    if user.role == "doctor":
        if payload.organization_type == "hospital":
            raise HTTPException(403, "Doctors can create clinic organizations, not hospital organizations")
        if payload.linked_hospital_id:
            hospital = db.get(Hospital, payload.linked_hospital_id)
            if hospital is None or not hospital.active:
                raise HTTPException(404, "Linked hospital not found")
        return

    if user.role == "hospital_admin":
        if payload.organization_type != "hospital":
            raise HTTPException(403, "Hospital admins create hospital organizations; doctors create clinic organizations")
        if not payload.linked_hospital_id:
            raise HTTPException(400, "Hospital organizations must be linked to a managed hospital")
        hospital = db.get(Hospital, payload.linked_hospital_id)
        if hospital is None or not hospital.active:
            raise HTTPException(404, "Linked hospital not found")
        if hospital.admin_user_id != user.id:
            raise HTTPException(403, "Hospital organization must be linked to a hospital you administer")
        return

    raise HTTPException(403, "Only doctors and hospital admins can manage organizations")


def _can_manage_organization(db: Session, org: CareOrganization, user: User) -> bool:
    if org.owner_user_id == user.id:
        return True
    return bool(
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.member_role == "admin",
            OrganizationMember.status == "active",
        )
        .first()
    )


def _org_record(db: Session, org: CareOrganization) -> dict:
    members = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id, OrganizationMember.status == "active").count()
    return {
        "id": org.id,
        "name": org.name,
        "organization_type": org.organization_type,
        "owner_user_id": org.owner_user_id,
        "linked_hospital_id": org.linked_hospital_id,
        "address": org.address,
        "city": org.city,
        "state": org.state,
        "phone": org.phone,
        "email": org.email,
        "active": org.active,
        "members_count": members,
        "created_at": org.created_at.isoformat() if org.created_at else "",
    }


def _member_record(db: Session, member: OrganizationMember) -> dict:
    user = db.get(User, member.user_id)
    return {
        "id": member.id,
        "organization_id": member.organization_id,
        "user_id": member.user_id,
        "user_name": user.full_name if user else "",
        "user_email": user.email if user else "",
        "member_role": member.member_role,
        "task_scope": member.task_scope,
        "status": member.status,
        "created_at": member.created_at.isoformat() if member.created_at else "",
    }

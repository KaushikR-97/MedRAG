from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.schemas.features import FacilitySearchRequest, OutbreakAlertCreate
from app.services.public_health_service import PublicHealthService

router = APIRouter()


@router.post("/facilities/nearby")
def nearby(payload: FacilitySearchRequest, db: Session = Depends(get_db)) -> dict:
    return {"facilities": PublicHealthService(db).nearby_facilities(city=payload.city, state=payload.state)}


@router.get("/outbreak-heatmap")
def heatmap(state: str = "", db: Session = Depends(get_db)) -> dict:
    return {"alerts": PublicHealthService(db).outbreak_heatmap(state=state)}


@router.post("/outbreak-alerts")
def create_alert(
    payload: OutbreakAlertCreate,
    _admin=Depends(require_role("hospital_admin")),
    db: Session = Depends(get_db),
) -> dict:
    alert = PublicHealthService(db).create_outbreak_alert(**payload.model_dump())
    return {"id": alert.id}


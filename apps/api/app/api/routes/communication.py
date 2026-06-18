from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.features import SendOtpRequest, VerifyOtpRequest
from app.services.communication_service import CommunicationService

router = APIRouter()


@router.post("/otp/send")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)) -> dict:
    record = CommunicationService(db).send_otp(
        target=payload.target,
        channel=payload.channel,
        purpose=payload.purpose,
    )
    return {"otp_id": record.id, "status": "sent_or_queued"}


@router.post("/otp/verify")
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)) -> dict:
    return {"verified": CommunicationService(db).verify_otp(target=payload.target, code=payload.code, purpose=payload.purpose)}


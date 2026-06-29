import base64
import json
import urllib.parse
import urllib.request
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_role
from app.db.session import get_db
from app.models.feature_modules import FitnessActivitySample, FitnessConnection
from app.models.user import User

router = APIRouter()


class FitnessCallbackRequest(BaseModel):
    code: str
    redirect_uri: str = ""


class AppleHealthImportRequest(BaseModel):
    activity_date: str = Field(default_factory=lambda: date.today().isoformat())
    steps: int = Field(default=0, ge=0)
    exercise_minutes: int = Field(default=0, ge=0)
    calories: int = Field(default=0, ge=0)
    distance_meters: float = Field(default=0, ge=0)
    source_note: str = "Apple Health export or HealthKit bridge"


@router.get("/providers")
def fitness_providers(_patient: User = Depends(require_role("patient"))) -> dict:
    return {
        "providers": [
            {
                "provider": "fitbit",
                "mode": "oauth",
                "can_server_fetch": True,
                "description": "Connect Fitbit with OAuth and sync steps, calories, distance, and active minutes.",
            },
            {
                "provider": "google_fit",
                "mode": "oauth",
                "can_server_fetch": True,
                "description": "Connect Google Fit with OAuth and sync aggregate steps and exercise minutes.",
            },
            {
                "provider": "apple_health",
                "mode": "healthkit_or_export",
                "can_server_fetch": False,
                "description": "Apple Health requires an iOS HealthKit bridge or user-exported Apple Health data import.",
            },
        ]
    }


@router.post("/{provider}/connect")
def start_fitness_connection(
    provider: str,
    patient: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> dict:
    provider = _normalize_provider(provider)
    connection = _get_or_create_connection(db=db, patient_id=patient.id, provider=provider)
    if provider == "apple_health":
        connection.status = "requires_healthkit_bridge"
        connection.connection_mode = "healthkit_or_export"
        db.commit()
        return {
            "provider": provider,
            "status": connection.status,
            "connection_id": connection.id,
            "instructions": [
                "Apple Health does not expose a normal server OAuth API.",
                "Use an iOS HealthKit bridge to POST activity samples to this app, or import Apple Health export summaries.",
            ],
        }
    if provider == "fitbit":
        if not settings.fitbit_client_id:
            raise HTTPException(400, "FITBIT_CLIENT_ID is not configured")
        redirect_uri = f"{settings.api_public_base_url.rstrip('/')}/fitness/fitbit/callback"
        params = {
            "response_type": "code",
            "client_id": settings.fitbit_client_id,
            "redirect_uri": redirect_uri,
            "scope": "activity profile",
            "state": connection.id,
        }
        auth_url = "https://www.fitbit.com/oauth2/authorize?" + urllib.parse.urlencode(params)
    else:
        if not settings.google_fit_client_id:
            raise HTTPException(400, "GOOGLE_FIT_CLIENT_ID is not configured")
        redirect_uri = f"{settings.api_public_base_url.rstrip('/')}/fitness/google_fit/callback"
        params = {
            "response_type": "code",
            "client_id": settings.google_fit_client_id,
            "redirect_uri": redirect_uri,
            "scope": "https://www.googleapis.com/auth/fitness.activity.read",
            "access_type": "offline",
            "prompt": "consent",
            "state": connection.id,
        }
        auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    connection.status = "pending_oauth"
    db.commit()
    return {"provider": provider, "connection_id": connection.id, "authorization_url": auth_url}


@router.post("/{provider}/callback")
def complete_fitness_connection(
    provider: str,
    payload: FitnessCallbackRequest,
    patient: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> dict:
    provider = _normalize_provider(provider)
    if provider == "apple_health":
        raise HTTPException(400, "Apple Health uses HealthKit/export import, not OAuth callback")
    connection = _get_or_create_connection(db=db, patient_id=patient.id, provider=provider)
    token_payload = _exchange_code(provider=provider, code=payload.code, redirect_uri=payload.redirect_uri)
    connection.access_token = token_payload.get("access_token", "")
    connection.refresh_token = token_payload.get("refresh_token", connection.refresh_token or "")
    connection.scope = token_payload.get("scope", "")
    expires_in = int(token_payload.get("expires_in", 3600) or 3600)
    connection.expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    connection.status = "connected"
    connection.metadata_json = json.dumps({"token_type": token_payload.get("token_type", "")})
    db.commit()
    return {"provider": provider, "status": connection.status, "connection_id": connection.id}


@router.post("/{provider}/sync")
def sync_fitness_provider(
    provider: str,
    patient: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> dict:
    provider = _normalize_provider(provider)
    connection = _get_connection(db=db, patient_id=patient.id, provider=provider)
    if provider == "apple_health":
        raise HTTPException(400, "Apple Health sync requires HealthKit bridge/import; use /fitness/apple_health/import")
    if not connection.access_token:
        raise HTTPException(409, "Fitness provider is not connected")
    sample = _fetch_activity(provider=provider, token=connection.access_token)
    saved = _save_sample(db=db, patient_id=patient.id, provider=provider, sample=sample)
    connection.last_sync_at = datetime.now(UTC)
    connection.status = "connected"
    db.commit()
    return {"provider": provider, "synced": 1, "sample": _sample_record(saved)}


@router.post("/apple_health/import")
def import_apple_health_sample(
    payload: AppleHealthImportRequest,
    patient: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> dict:
    _get_or_create_connection(db=db, patient_id=patient.id, provider="apple_health", mode="healthkit_or_export", status="connected")
    sample = _save_sample(
        db=db,
        patient_id=patient.id,
        provider="apple_health",
        sample={
            "activity_date": payload.activity_date,
            "steps": payload.steps,
            "exercise_minutes": payload.exercise_minutes,
            "calories": payload.calories,
            "distance_meters": payload.distance_meters,
            "raw": {"source_note": payload.source_note},
        },
    )
    db.commit()
    return {"provider": "apple_health", "imported": 1, "sample": _sample_record(sample)}


@router.get("/activities")
def list_fitness_activities(
    patient: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> dict:
    rows = (
        db.query(FitnessActivitySample)
        .filter(FitnessActivitySample.patient_id == patient.id)
        .order_by(FitnessActivitySample.activity_date.desc(), FitnessActivitySample.created_at.desc())
        .limit(30)
        .all()
    )
    return {"activities": [_sample_record(row) for row in rows]}


def _normalize_provider(provider: str) -> str:
    provider = provider.lower().replace("-", "_")
    if provider not in {"fitbit", "google_fit", "apple_health"}:
        raise HTTPException(404, "Unsupported fitness provider")
    return provider


def _get_or_create_connection(
    *,
    db: Session,
    patient_id: str,
    provider: str,
    mode: str = "oauth",
    status: str = "pending",
) -> FitnessConnection:
    connection = (
        db.query(FitnessConnection)
        .filter(FitnessConnection.patient_id == patient_id, FitnessConnection.provider == provider)
        .first()
    )
    if connection is None:
        connection = FitnessConnection(
            id=str(uuid.uuid4()),
            patient_id=patient_id,
            provider=provider,
            connection_mode=mode,
            status=status,
        )
        db.add(connection)
        db.flush()
    return connection


def _get_connection(*, db: Session, patient_id: str, provider: str) -> FitnessConnection:
    connection = (
        db.query(FitnessConnection)
        .filter(FitnessConnection.patient_id == patient_id, FitnessConnection.provider == provider)
        .first()
    )
    if connection is None:
        raise HTTPException(404, "Fitness provider is not connected")
    return connection


def _exchange_code(*, provider: str, code: str, redirect_uri: str) -> dict:
    if provider == "fitbit":
        token_url = "https://api.fitbit.com/oauth2/token"
        redirect_uri = redirect_uri or f"{settings.api_public_base_url.rstrip('/')}/fitness/fitbit/callback"
        body = urllib.parse.urlencode({"client_id": settings.fitbit_client_id, "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}).encode()
        basic = base64.b64encode(f"{settings.fitbit_client_id}:{settings.fitbit_client_secret}".encode()).decode()
        headers = {"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"}
    else:
        token_url = "https://oauth2.googleapis.com/token"
        redirect_uri = redirect_uri or f"{settings.api_public_base_url.rstrip('/')}/fitness/google_fit/callback"
        body = urllib.parse.urlencode(
            {
                "client_id": settings.google_fit_client_id,
                "client_secret": settings.google_fit_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            }
        ).encode()
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
    return _json_request(token_url, body=body, headers=headers)


def _fetch_activity(*, provider: str, token: str) -> dict:
    today = date.today().isoformat()
    if provider == "fitbit":
        data = _json_request(
            f"https://api.fitbit.com/1/user/-/activities/date/{today}.json",
            headers={"Authorization": f"Bearer {token}"},
        )
        summary = data.get("summary", {})
        return {
            "activity_date": today,
            "steps": int(summary.get("steps", 0) or 0),
            "exercise_minutes": int(summary.get("veryActiveMinutes", 0) or 0) + int(summary.get("fairlyActiveMinutes", 0) or 0),
            "calories": int(summary.get("caloriesOut", 0) or 0),
            "distance_meters": float(summary.get("distances", [{}])[0].get("distance", 0) or 0) * 1000,
            "raw": data,
        }
    end_ms = int(datetime.now(UTC).timestamp() * 1000)
    start_ms = int((datetime.now(UTC) - timedelta(days=1)).timestamp() * 1000)
    body = json.dumps(
        {
            "aggregateBy": [
                {"dataTypeName": "com.google.step_count.delta"},
                {"dataTypeName": "com.google.active_minutes"},
                {"dataTypeName": "com.google.calories.expended"},
                {"dataTypeName": "com.google.distance.delta"},
            ],
            "bucketByTime": {"durationMillis": 86400000},
            "startTimeMillis": start_ms,
            "endTimeMillis": end_ms,
        }
    ).encode()
    data = _json_request(
        "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
        body=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    totals = {"steps": 0, "exercise_minutes": 0, "calories": 0, "distance_meters": 0.0}
    for bucket in data.get("bucket", []):
        for dataset in bucket.get("dataset", []):
            data_type = dataset.get("dataSourceId", "")
            for point in dataset.get("point", []):
                value = point.get("value", [{}])[0]
                if "step_count" in data_type:
                    totals["steps"] += int(value.get("intVal", 0) or 0)
                elif "active_minutes" in data_type:
                    totals["exercise_minutes"] += int(value.get("intVal", 0) or 0)
                elif "calories" in data_type:
                    totals["calories"] += int(value.get("fpVal", 0) or 0)
                elif "distance" in data_type:
                    totals["distance_meters"] += float(value.get("fpVal", 0) or 0)
    return {"activity_date": today, **totals, "raw": data}


def _save_sample(*, db: Session, patient_id: str, provider: str, sample: dict) -> FitnessActivitySample:
    row = FitnessActivitySample(
        id=str(uuid.uuid4()),
        patient_id=patient_id,
        provider=provider,
        activity_date=sample.get("activity_date") or date.today().isoformat(),
        steps=int(sample.get("steps", 0) or 0),
        exercise_minutes=int(sample.get("exercise_minutes", 0) or 0),
        calories=int(sample.get("calories", 0) or 0),
        distance_meters=float(sample.get("distance_meters", 0) or 0),
        raw_json=json.dumps(sample.get("raw", {})),
    )
    db.add(row)
    return row


def _sample_record(row: FitnessActivitySample) -> dict:
    return {
        "id": row.id,
        "provider": row.provider,
        "activity_date": row.activity_date,
        "steps": row.steps,
        "exercise_minutes": row.exercise_minutes,
        "calories": row.calories,
        "distance_meters": row.distance_meters,
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


def _json_request(url: str, *, body: bytes | None = None, headers: dict | None = None) -> dict:
    request = urllib.request.Request(url, data=body, headers=headers or {}, method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(502, f"Fitness provider request failed: {type(exc).__name__}") from exc

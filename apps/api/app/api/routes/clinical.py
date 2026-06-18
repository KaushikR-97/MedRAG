import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.graphs.clinical_graph import ClinicalRagGraph
from app.models.jobs import AnswerTrace
from app.models.user import User
from app.rag.retriever import RetrievedChunk
from app.schemas.clinical import (
    ClinicalAnswer,
    ClinicalHistoryItem,
    ClinicalQuestion,
    ImportChatHistoryRequest,
    ImportChatHistoryResponse,
    SourceSnippet,
)
from app.services.audit_service import AuditService
from app.services.ai_policy_service import AiPolicyService
from app.services.compliance_service import ComplianceService
from app.services.privacy_service import PrivacyService
from app.services.trace_service import AnswerTraceService, TraceTimer

router = APIRouter()


@router.post("/ask", response_model=ClinicalAnswer)
def ask_clinical_question(
    payload: ClinicalQuestion,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClinicalAnswer:
    patient_id = payload.patient_id or user.id
    conversation_id = str(payload.conversation_id or uuid.uuid4())
    if not ComplianceService(db).can_access_patient(actor=user, patient_id=patient_id, scope="clinical.ask"):
        raise HTTPException(403, "Missing patient consent or care-team access")
    policy = AiPolicyService().evaluate(actor=user, question=payload.question)
    timer = TraceTimer()
    AuditService(db).record(
        actor=user,
        patient_id=patient_id,
        action="clinical.ask",
        purpose="answer_health_question",
        ip_address=request.client.host if request.client else "",
        details={"question_length": len(payload.question), "conversation_id": conversation_id},
    )
    trace_service = AnswerTraceService(db)
    conversation_history = trace_service.recent_conversation(
        conversation_id=conversation_id,
        actor=user,
        patient_id=patient_id,
    )
    state = ClinicalRagGraph().invoke(
        question=payload.question,
        patient_id=patient_id,
        user_role=user.role,
        conversation_history=conversation_history,
        policy_instruction=policy.instruction,
        policy_mode=policy.mode,
        policy_refusal=policy.refusal,
    )
    answer = PrivacyService().minimum_necessary_text(actor=user, patient_id=patient_id, text=state["answer"])
    sources = [
        SourceSnippet(
            id=source.id,
            title=source.title,
            score=source.score,
            text=PrivacyService().minimum_necessary_text(actor=user, patient_id=patient_id, text=source.text),
        )
        for source in state.get("sources", [])
    ]
    trace_sources = [
        RetrievedChunk(
            id=source.id,
            title=source.title,
            score=source.score,
            text=PrivacyService().minimum_necessary_text(actor=user, patient_id=patient_id, text=source.text),
        )
        for source in state.get("sources", [])
    ]
    trace_service.record(
        trace_id=state["trace_id"],
        conversation_id=conversation_id,
        actor=user,
        patient_id=patient_id,
        question=payload.question,
        safety_label=state["safety_label"],
        sources=trace_sources,
        answer=answer,
        latency_ms=timer.elapsed_ms(),
    )
    return ClinicalAnswer(
        answer=answer,
        conversation_id=conversation_id,
        safety_label=state["safety_label"],
        escalation=state.get("escalation"),
        sources=sources,
        trace_id=state["trace_id"],
        query_route=state.get("query_route", ""),
        query_route_reason=state.get("query_route_reason", ""),
        query_route_confidence=state.get("query_route_confidence", 0.0),
        query_route_used_fallback=state.get("query_route_used_fallback", False),
        retrieval_source_types=state.get("retrieval_source_types", []),
        rewritten_queries=state.get("rewritten_queries", []),
    )


@router.get("/history", response_model=list[ClinicalHistoryItem])
def list_clinical_history(
    patient_id: str | None = None,
    limit: int = 25,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ClinicalHistoryItem]:
    target_patient_id = patient_id or user.id
    if not ComplianceService(db).can_access_patient(actor=user, patient_id=target_patient_id, scope="clinical.ask"):
        raise HTTPException(403, "Missing patient consent or care-team access")
    rows = (
        db.query(AnswerTrace)
        .filter(AnswerTrace.patient_id == target_patient_id)
        .order_by(AnswerTrace.created_at.desc())
        .limit(min(max(limit, 1), 100))
        .all()
    )
    return [
        ClinicalHistoryItem(
            trace_id=row.trace_id,
            conversation_id=row.conversation_id,
            patient_id=row.patient_id,
            question=row.question,
            answer=row.answer,
            safety_label=row.safety_label,
            model_provider=row.model_provider,
            model_name=row.model_name,
            prompt_version=row.prompt_version,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.post("/history/import", response_model=ImportChatHistoryResponse)
def import_previous_chat_history(
    payload: ImportChatHistoryRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportChatHistoryResponse:
    patient_id = payload.patient_id or user.id
    if not ComplianceService(db).can_access_patient(actor=user, patient_id=patient_id, scope="clinical.ask"):
        raise HTTPException(403, "Missing patient consent or care-team access")

    privacy = PrivacyService()
    redacted_messages = [
        {"role": message.role, "content": privacy.redact_phi(message.content)}
        for message in payload.messages
    ]
    questions = [item["content"] for item in redacted_messages if item["role"] in {"patient", "doctor"}]
    answers = [item["content"] for item in redacted_messages if item["role"] == "assistant"]
    trace_id = str(uuid.uuid4())
    trace = AnswerTrace(
        id=str(uuid.uuid4()),
        trace_id=trace_id,
        conversation_id="",
        actor_id=user.id,
        patient_id=patient_id,
        question="\n\n".join(questions)[:8000] or "Imported previous chat",
        safety_label="imported_history",
        model_provider="imported",
        model_name=payload.source_label,
        prompt_version="chat-import-v1",
        retrieved_sources_json=json.dumps(
            [{"source": payload.source_label, "messages": redacted_messages}],
            separators=(",", ":"),
        ),
        answer="\n\n".join(answers)[:8000] or "Imported chat contained no assistant answer",
        latency_ms=0,
    )
    db.add(trace)
    db.commit()
    AuditService(db).record(
        actor=user,
        patient_id=patient_id,
        action="clinical.history_imported",
        purpose="continuity_of_care",
        resource_type="answer_trace",
        resource_id=trace_id,
        ip_address=request.client.host if request.client else "",
        details={"message_count": len(payload.messages), "source_label": payload.source_label},
    )
    return ImportChatHistoryResponse(trace_id=trace_id, stored_messages=len(payload.messages))

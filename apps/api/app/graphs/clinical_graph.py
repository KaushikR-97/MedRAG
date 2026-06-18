from typing import TypedDict
from uuid import uuid4

from langgraph.graph import END, StateGraph

from app.rag.retriever import HybridMedicalRetriever, RetrievedChunk
from app.services.evidence_service import CitationValidationService, EvidenceCompressionService
from app.services.generation_service import ClinicalGenerationService
from app.services.query_router_service import QueryRouterService
from app.services.query_rewrite_service import QueryRewriteService
from app.services.safety_service import ClinicalSafetyService


class ClinicalGraphState(TypedDict, total=False):
    question: str
    conversation_history: list[dict[str, str]]
    patient_id: str | None
    user_role: str
    policy_instruction: str
    policy_mode: str
    policy_refusal: str | None
    safety_label: str
    escalation: str | None
    query_route: str
    query_route_reason: str
    query_route_confidence: float
    query_route_used_fallback: bool
    needs_rag: bool
    retrieval_source_types: list[str]
    rewritten_queries: list[str]
    sources: list[RetrievedChunk]
    compressed_sources: list[RetrievedChunk]
    answer: str
    trace_id: str


class ClinicalRagGraph:
    def __init__(
        self,
        *,
        retriever: HybridMedicalRetriever | None = None,
        safety: ClinicalSafetyService | None = None,
        query_router: QueryRouterService | None = None,
        query_rewriter: QueryRewriteService | None = None,
        evidence_compressor: EvidenceCompressionService | None = None,
        citation_validator: CitationValidationService | None = None,
        generator: ClinicalGenerationService | None = None,
    ) -> None:
        self.retriever = retriever or HybridMedicalRetriever()
        self.safety = safety or ClinicalSafetyService()
        self.query_router = query_router or QueryRouterService()
        self.query_rewriter = query_rewriter or QueryRewriteService()
        self.evidence_compressor = evidence_compressor or EvidenceCompressionService()
        self.citation_validator = citation_validator or CitationValidationService()
        self.generator = generator or ClinicalGenerationService()
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(ClinicalGraphState)
        workflow.add_node("safety_check", self._safety_check)
        workflow.add_node("route_query", self._route_query)
        workflow.add_node("rewrite_query", self._rewrite_query)
        workflow.add_node("retrieve", self._retrieve)
        workflow.add_node("compress_evidence", self._compress_evidence)
        workflow.add_node("generate", self._generate)
        workflow.add_node("validate_citations", self._validate_citations)
        workflow.add_node("finalize", self._finalize)

        workflow.set_entry_point("safety_check")
        workflow.add_conditional_edges(
            "safety_check",
            self._route_after_safety,
            {"urgent": "finalize", "refuse": "finalize", "continue": "route_query"},
        )
        workflow.add_conditional_edges(
            "route_query",
            self._route_after_query_router,
            {"retrieve": "rewrite_query", "skip_retrieval": "generate"},
        )
        workflow.add_edge("rewrite_query", "retrieve")
        workflow.add_edge("retrieve", "compress_evidence")
        workflow.add_edge("compress_evidence", "generate")
        workflow.add_edge("generate", "validate_citations")
        workflow.add_edge("validate_citations", "finalize")
        workflow.add_edge("finalize", END)
        return workflow.compile()

    def invoke(
        self,
        *,
        question: str,
        patient_id: str | None,
        user_role: str,
        conversation_history: list[dict[str, str]] | None = None,
        policy_instruction: str = "",
        policy_mode: str = "",
        policy_refusal: str | None = None,
    ) -> ClinicalGraphState:
        return self.graph.invoke(
            {
                "question": question,
                "conversation_history": conversation_history or [],
                "patient_id": patient_id,
                "user_role": user_role,
                "policy_instruction": policy_instruction,
                "policy_mode": policy_mode,
                "policy_refusal": policy_refusal,
                "trace_id": str(uuid4()),
            }
        )

    def _safety_check(self, state: ClinicalGraphState) -> ClinicalGraphState:
        safety_label, escalation = self.safety.classify(state["question"])
        return {"safety_label": safety_label, "escalation": escalation}

    def _route_after_safety(self, state: ClinicalGraphState) -> str:
        if state.get("safety_label") == "urgent_escalation":
            return "urgent"
        return "refuse" if state.get("policy_refusal") else "continue"

    def _route_query(self, state: ClinicalGraphState) -> ClinicalGraphState:
        decision = self.query_router.route(
            question=self._contextual_question(state),
            user_role=state.get("user_role", "patient"),
        )
        return {
            "query_route": decision.route,
            "query_route_reason": decision.reason,
            "query_route_confidence": decision.confidence,
            "query_route_used_fallback": decision.used_fallback,
            "needs_rag": decision.needs_rag,
            "retrieval_source_types": decision.source_types,
        }

    def _route_after_query_router(self, state: ClinicalGraphState) -> str:
        return "retrieve" if state.get("needs_rag", True) else "skip_retrieval"

    def _rewrite_query(self, state: ClinicalGraphState) -> ClinicalGraphState:
        return {
            "rewritten_queries": self.query_rewriter.rewrite(
                question=state["question"],
                user_role=state.get("user_role", "patient"),
                route=state.get("query_route", ""),
                conversation_context=self._prior_user_context(state),
            )
        }

    def _retrieve(self, state: ClinicalGraphState) -> ClinicalGraphState:
        return {
            "sources": self.retriever.retrieve_many(
                state.get("rewritten_queries") or [state["question"]],
                patient_id=state.get("patient_id"),
                top_k=5,
                source_types=state.get("retrieval_source_types") or None,
            )
        }

    def _compress_evidence(self, state: ClinicalGraphState) -> ClinicalGraphState:
        return {
            "compressed_sources": self.evidence_compressor.compress(
                question=state["question"],
                sources=state.get("sources", []),
            )
        }

    def _generate(self, state: ClinicalGraphState) -> ClinicalGraphState:
        answer = self.generator.generate(
            question=state["question"],
            user_role=state.get("user_role", "patient"),
            conversation_history=state.get("conversation_history", []),
            sources=state.get("compressed_sources") or state.get("sources", []),
            disclaimer=self.safety.patient_disclaimer(),
            policy_instruction=state.get("policy_instruction", ""),
            policy_mode=state.get("policy_mode", ""),
        )
        return {"answer": answer}

    def _validate_citations(self, state: ClinicalGraphState) -> ClinicalGraphState:
        return {
            "answer": self.citation_validator.validate(
                answer=state.get("answer", ""),
                sources=state.get("compressed_sources") or state.get("sources", []),
            )
        }

    def _finalize(self, state: ClinicalGraphState) -> ClinicalGraphState:
        if state.get("safety_label") == "urgent_escalation":
            return {
                "answer": state.get("escalation") or "Please seek urgent medical care.",
                "sources": [],
            }
        if state.get("policy_refusal"):
            return {"answer": state["policy_refusal"], "sources": []}
        return {}

    @staticmethod
    def _contextual_question(state: ClinicalGraphState) -> str:
        prior_context = ClinicalRagGraph._prior_user_context(state)
        if not prior_context:
            return state["question"]
        return f"Prior user context:\n{prior_context}\n\nCurrent question:\n{state['question']}"

    @staticmethod
    def _prior_user_context(state: ClinicalGraphState) -> str:
        prior_user_messages = [
            message["content"]
            for message in state.get("conversation_history", [])
            if message.get("role") == "user"
        ][-2:]
        return "\n".join(prior_user_messages)

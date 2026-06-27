import pytest
from app.db.session import Base, engine
from app.graphs.clinical_graph import ClinicalRagGraph
from app.rag.retriever import RetrievedChunk
from app.services.query_router_service import QueryRouterService

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class StaticRouter(QueryRouterService):
    def __init__(self, raw: str | None, threshold: float = 0.92) -> None:
        super().__init__(confidence_threshold=threshold)
        self.raw = raw

    def _invoke_router_llm(self, *, question: str, user_role: str) -> str | None:
        return self.raw


class FakeRetriever:
    def retrieve_many(self, *args, **kwargs) -> list[RetrievedChunk]:
        return [
            RetrievedChunk(
                id="guideline-1",
                title="Diabetes follow-up guideline",
                score=0.95,
                text="Diabetes follow-up commonly includes HbA1c review and clinician follow-up.",
            )
        ]


class FakeGenerator:
    def generate(self, **kwargs) -> str:
        return (
            "Use this as educational support only. Diabetes follow-up commonly "
            "includes reviewing reports with a clinician. [guideline-1]"
        )


class CapturingGenerator(FakeGenerator):
    def __init__(self) -> None:
        self.conversation_history: list[dict[str, str]] = []

    def generate(self, **kwargs) -> str:
        history = kwargs.get("conversation_history", [])
        if history:
            self.conversation_history = history
        return super().generate(**kwargs)


def test_urgent_question_escalates_without_retrieval() -> None:
    result = ClinicalRagGraph(
        retriever=FakeRetriever(),
        generator=FakeGenerator(),
    ).invoke(
        question="I have chest pain and difficulty breathing",
        patient_id="patient-1",
        user_role="patient",
    )

    assert result["safety_label"] == "urgent_escalation"
    assert "emergency" in result["answer"].lower()
    assert result.get("sources") == []


def test_patient_answer_includes_disclaimer() -> None:
    result = ClinicalRagGraph(
        retriever=FakeRetriever(),
        generator=FakeGenerator(),
        query_router=StaticRouter(
            '{"route":"clinical_guideline_needed","confidence":0.99,"reason":"Guideline education question"}'
        )
    ).invoke(
        question="What should I know about diabetes follow up?",
        patient_id="patient-1",
        user_role="patient",
    )

    assert result["safety_label"] == "clinical_guidance"
    assert "educational support" in result["answer"]
    assert result["sources"]
    assert result["query_route"] == "clinical_guideline_needed"
    assert result["query_route_confidence"] == 0.99


def test_conversation_history_is_forwarded_to_generation() -> None:
    generator = CapturingGenerator()
    history = [
        {"role": "user", "content": "My HbA1c was 7.1."},
        {"role": "assistant", "content": "Discuss the trend with your clinician."},
    ]

    ClinicalRagGraph(
        retriever=FakeRetriever(),
        generator=generator,
        query_router=StaticRouter(
            '{"route":"clinical_guideline_needed","confidence":0.99,"reason":"Follow-up question"}'
        ),
    ).invoke(
        question="What did I say the value was?",
        patient_id="patient-1",
        user_role="patient",
        conversation_history=history,
    )

    assert generator.conversation_history == history


def test_contextual_question_uses_only_prior_user_messages() -> None:
    contextual = ClinicalRagGraph._contextual_question(
        {
            "question": "What did it mean?",
            "conversation_history": [
                {"role": "user", "content": "My HbA1c was 7.1."},
                {"role": "assistant", "content": "Ignore this assistant wording for retrieval."},
            ],
        }
    )

    assert "My HbA1c was 7.1." in contextual
    assert "Ignore this assistant wording" not in contextual
    assert "What did it mean?" in contextual


def test_llm_query_router_uses_high_confidence_route() -> None:
    decision = StaticRouter(
        '{"route":"patient_record_needed","confidence":0.97,"reason":"Needs latest patient lab report"}'
    ).route(
        question="What does my latest HbA1c report mean?",
        user_role="patient",
    )

    assert decision.route == "patient_record_needed"
    assert decision.needs_rag is True
    assert "verified_patient_document" in decision.source_types
    assert decision.used_fallback is False


def test_llm_query_router_falls_back_when_below_threshold() -> None:
    decision = StaticRouter(
        '{"route":"no_rag_needed","confidence":0.70,"reason":"Maybe app help"}'
    ).route(
        question="How do I upload my report?",
        user_role="patient",
    )

    assert decision.route == "both_patient_record_and_guideline"
    assert decision.needs_rag is True
    assert "verified_patient_document" in decision.source_types
    assert decision.used_fallback is True


def test_llm_query_router_falls_back_when_model_unavailable() -> None:
    decision = StaticRouter(None).route(
        question="What is diabetes?",
        user_role="patient",
    )

    assert decision.route == "both_patient_record_and_guideline"
    assert decision.used_fallback is True


def test_llm_query_router_falls_back_for_doctor() -> None:
    decision = StaticRouter(None).route(
        question="What is diabetes?",
        user_role="doctor",
    )

    assert decision.route == "both_patient_record_and_guideline"
    assert decision.source_types == ["guideline", "verified_patient_document"]
    assert decision.used_fallback is True

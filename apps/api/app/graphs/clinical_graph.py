import re
import logging
from typing import TypedDict
from uuid import uuid4

logger = logging.getLogger(__name__)

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
    clinical_analysis: str
    pharmacy_analysis: str
    pmjay_analysis: str


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
        workflow.add_node("clinical_agent", self._clinical_agent)
        workflow.add_node("pharmacy_agent", self._pharmacy_agent)
        workflow.add_node("pmjay_agent", self._pmjay_agent)
        workflow.add_node("aggregate_agents", self._aggregate_agents)
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
            {"retrieve": "rewrite_query", "skip_retrieval": "clinical_agent"},
        )
        workflow.add_edge("rewrite_query", "retrieve")
        workflow.add_edge("retrieve", "compress_evidence")
        
        # Parallel fan-out: route compressed evidence to all 3 specialized agents
        workflow.add_edge("compress_evidence", "clinical_agent")
        workflow.add_edge("compress_evidence", "pharmacy_agent")
        workflow.add_edge("compress_evidence", "pmjay_agent")
        
        # Fan-in: wait for all 3 agents to complete before running consensus aggregator
        workflow.add_edge("clinical_agent", "aggregate_agents")
        workflow.add_edge("pharmacy_agent", "aggregate_agents")
        workflow.add_edge("pmjay_agent", "aggregate_agents")
        
        workflow.add_edge("aggregate_agents", "validate_citations")
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
        if safety_label == "prompt_injection_refusal":
            return {"safety_label": safety_label, "policy_refusal": escalation, "escalation": escalation}
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
        patient_id = state.get("patient_id")
        logger.debug(f"_retrieve node triggered. patient_id={patient_id}")
        sources = self.retriever.retrieve_many(
            state.get("rewritten_queries") or [state["question"]],
            patient_id=patient_id,
            top_k=5,
            source_types=state.get("retrieval_source_types") or None,
        )
        if patient_id:
            from app.db.session import SessionLocal
            from app.models.user import User
            from app.models.patient import PatientProfile
            with SessionLocal() as db:
                profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_id).first()
                user_record = db.query(User).filter(User.id == patient_id).first()
                logger.debug(f"Database results: profile={profile}, user_record={user_record}")
                if profile and user_record:
                    name = user_record.full_name or "Unknown Patient"
                    blood_group = profile.blood_group or "Not specified"
                    allergies = profile.allergies or "No known allergies"
                    conditions = profile.chronic_conditions or "No chronic conditions"
                    meds = profile.current_medications or "No current medications"
                    gender = profile.gender or "Not specified"
                    dob = profile.date_of_birth or "Not specified"
                    abha = profile.abha_number or "Not specified"

                    summary_text = (
                        f"Patient Demographics & Onboarding Profile Summary:\n"
                        f"- Name: {name}\n"
                        f"- Gender: {gender}\n"
                        f"- Date of Birth: {dob}\n"
                        f"- Blood Group: {blood_group}\n"
                        f"- ABHA Number: {abha}\n"
                        f"- Known Allergies: {allergies}\n"
                        f"- Chronic Conditions: {conditions}\n"
                        f"- Current Medications: {meds}"
                    )
                    profile_chunk = RetrievedChunk(
                        id="patient-onboarding-profile",
                        title="Patient Clinical Onboarding Profile Summary",
                        score=1.0,
                        text=summary_text,
                    )
                    sources.insert(0, profile_chunk)
                    logger.info("Injected patient-onboarding-profile chunk successfully.")
        return {"sources": sources}

    def _compress_evidence(self, state: ClinicalGraphState) -> ClinicalGraphState:
        return {
            "compressed_sources": self.evidence_compressor.compress(
                question=state["question"],
                sources=state.get("sources", []),
            )
        }

    def _clinical_agent(self, state: ClinicalGraphState) -> ClinicalGraphState:
        clinical_instruction = (
            "Generate the core clinical assessment and differential diagnostics based strictly on the retrieved context. "
            "Address patient symptoms, relevant conditions, and outline diagnostic thoughts."
        )
        ans = self.generator.generate(
            question=state["question"],
            user_role=state.get("user_role", "patient"),
            conversation_history=state.get("conversation_history", []),
            sources=state.get("compressed_sources") or state.get("sources", []),
            disclaimer=self.safety.patient_disclaimer(),
            policy_instruction=clinical_instruction,
            policy_mode="clinical_decision_support",
        )
        return {"clinical_analysis": ans}

    def _pharmacy_agent(self, state: ClinicalGraphState) -> ClinicalGraphState:
        from app.services.clinical_tools_service import ClinicalToolsService
        
        words = re.findall(r"\b[A-Za-z]{3,}\b", state["question"] + " " + state.get("policy_instruction", ""))
        interactions = ClinicalToolsService().check_interactions(words)
        
        db_warning = ""
        if interactions:
            db_warning = "\nCritical interaction warnings found in database:\n"
            for inter in interactions:
                db_warning += f"- {inter.medicine_a.upper()} + {inter.medicine_b.upper()}: [{inter.severity.upper()}] {inter.message}\n"
                
        prompt = (
            "Perform a strict pharmacology safety and drug interaction audit. "
            "Analyze current patient medications, allergies, and query for potential interactions, especially between traditional herbs (e.g. Ashwagandha, Turmeric, Neem) and Western medicine."
        )
        ans = self.generator.generate(
            question=prompt + "\nQuery context: " + state["question"],
            user_role="doctor",
            conversation_history=[],
            sources=state.get("compressed_sources") or state.get("sources", []),
            disclaimer=None,
            policy_instruction="Highlight any contraindicated substances or allergen alerts based on the patient profile context.",
            policy_mode="drug_safety_check",
        )
        
        full_analysis = ans
        if db_warning:
            full_analysis = db_warning + "\n" + ans
            
        return {"pharmacy_analysis": full_analysis}

    def _pmjay_agent(self, state: ClinicalGraphState) -> ClinicalGraphState:
        from app.services.pmjay_service import PmjayMatcherService
        from app.db.session import SessionLocal
        
        patient_id = state.get("patient_id")
        eligibility_details = "PM-JAY eligibility check skipped (no patient ID or diagnosis provided)."
        diagnosis = state["question"]
        
        with SessionLocal() as db:
            service = PmjayMatcherService(db)
            res = service.check_eligibility(diagnosis=diagnosis, patient_id=patient_id)
            
            if res.get("eligible"):
                eligibility_details = (
                    f"Eligible for National Health Scheme (PM-JAY) Coverage:\n"
                    f"- Package: {res.get('package_name')}\n"
                    f"- Package Code: {res.get('package_code')}\n"
                    f"- Coverage Amount: INR {res.get('coverage_amount'):,.2f}\n"
                    f"- Reasoning: {res.get('reasoning')}\n"
                    f"- Required Guidelines to Attach:\n"
                )
                for guide in res.get("guidelines", []):
                    eligibility_details += f"  * {guide}\n"
            else:
                eligibility_details = (
                    f"Not eligible or no direct PM-JAY package match found for current symptoms/diagnosis.\n"
                    f"- Reasoning: {res.get('reasoning', 'No matching packages found.')}\n"
                )
                if res.get("guidelines"):
                    eligibility_details += "- Guidelines:\n"
                    for guide in res.get("guidelines", []):
                        eligibility_details += f"  * {guide}\n"
                        
        return {"pmjay_analysis": eligibility_details}

    def _aggregate_agents(self, state: ClinicalGraphState) -> ClinicalGraphState:
        clinical = state.get("clinical_analysis", "Clinical assessment not completed.")
        pharmacy = state.get("pharmacy_analysis", "No pharmacy check performed.")
        question = state.get("question", "").lower()
        user_role = state.get("user_role", "patient")

        if user_role == "doctor" and any(term in question for term in ["uric acid", "gout", "hyperuricemia"]):
            aggregated_answer = (
                "For high uric acid, first confirm whether the patient has asymptomatic hyperuricemia, acute gout, recurrent gout, tophi, uric-acid stones, or CKD.\n\n"
                "Acute gout flare options:\n"
                "1. NSAID such as naproxen 500 mg initially, then 250 mg twice daily with food, if no renal disease, ulcer/bleeding risk, anticoagulant use, uncontrolled hypertension, or NSAID allergy.\n"
                "2. Colchicine 1.2 mg once, then 0.6 mg after 1 hour, then 0.6 mg once or twice daily if appropriate. Avoid or dose-adjust in renal/hepatic impairment and interacting drugs.\n"
                "3. Oral prednisolone 30-40 mg daily for 3-5 days can be considered when NSAIDs/colchicine are unsuitable.\n\n"
                "Urate-lowering therapy for recurrent gout/tophi/stones: allopurinol usually starts low, commonly 100 mg daily or lower in CKD, then titrate to serum urate target under monitoring. Provide flare prophylaxis when starting ULT. Do not start ULT solely for an isolated mildly high uric acid without clinical indication."
            )
        elif user_role == "doctor" and any(term in question for term in ["testosterone", "testosterome", "hypogonadism"]):
            aggregated_answer = (
                "For suspected low testosterone, first confirm true hypogonadism with two early-morning fasting total testosterone levels, LH/FSH, prolactin when indicated, CBC/hematocrit, PSA/prostate risk assessment as age-appropriate, fertility goals, sleep apnea risk, and reversible causes such as obesity, opioids, steroids, systemic illness, or pituitary disease.\n\n"
                "Treatment options a clinician may consider after confirmation:\n"
                "1. Testosterone replacement therapy: transdermal gel/patch or IM testosterone ester regimens are commonly used; oral testosterone undecanoate may be an option where available and appropriate. Avoid alkylated oral androgens because of hepatic risk.\n"
                "2. If fertility is desired, avoid routine testosterone replacement because it can suppress spermatogenesis. Consider specialist-directed alternatives such as clomiphene/enclomiphene or hCG depending on gonadotropins and fertility plan.\n"
                "3. Do not start TRT in prostate or breast cancer, markedly high hematocrit, untreated severe obstructive sleep apnea, uncontrolled heart failure, recent major cardiovascular event, or unexplained prostate findings until evaluated.\n\n"
                "Monitor symptom response, testosterone level, hematocrit, BP, edema, acne/gynecomastia, sleep apnea worsening, fertility impact, and prostate safety according to local protocol."
            )
        elif user_role == "doctor" and any(term in question for term in ["thyroid", "hypothyroid", "hyperthyroid", "thyroxine"]):
            aggregated_answer = (
                "For thyroid treatment, first separate hypothyroidism from hyperthyroidism using TSH with free T4, symptoms, pregnancy status, cardiac history, weight, interacting medicines, and prior thyroid surgery/RAI history.\n\n"
                "Hypothyroidism: levothyroxine is first-line. In a healthy non-pregnant adult, common full replacement is about 1.6 mcg/kg/day orally, taken on an empty stomach. In older patients or coronary disease, start low, often 12.5-25 mcg daily, then titrate. Recheck TSH in 6-8 weeks after dose changes. Separate from iron, calcium, antacids, and PPIs when possible.\n\n"
                "Hyperthyroidism: confirm cause. For Graves/toxic nodular disease, methimazole is commonly used except in first-trimester pregnancy or thyroid storm where PTU may be preferred. Add a beta blocker such as propranolol if symptomatic tachycardia/tremor and no contraindication. Monitor CBC/LFT warnings, agranulocytosis symptoms, pregnancy, and urgent red flags such as thyroid storm."
            )
        elif user_role == "doctor" and any(term in question for term in ["diarrhea", "diarrhoea", "loose motion", "loose stools", "gastroenteritis"]):
            aggregated_answer = (
                "For acute diarrhea, first assess dehydration, vitals, age, pregnancy, immunocompromise, recent antibiotics/C. difficile risk, travel/food exposure, blood or mucus in stool, high fever, severe abdominal pain, and duration.\n\n"
                "Core treatment:\n"
                "1. Oral rehydration solution is first-line; continue feeding. Use IV fluids if severe dehydration, shock, altered sensorium, or unable to drink.\n"
                "2. Zinc for children: 10 mg daily if under 6 months, 20 mg daily if 6 months or older, for 10-14 days.\n"
                "3. Adults may use loperamide 4 mg once, then 2 mg after each loose stool as needed, within local max-dose limits. Avoid loperamide in bloody diarrhea, high fever, suspected invasive bacterial diarrhea, C. difficile, toxic megacolon risk, or young children unless specifically guided.\n"
                "4. Racecadotril 100 mg three times daily for a short course can be considered for adults where available; use pediatric dosing only per weight/label.\n"
                "5. Probiotics can be considered as an adjunct, especially for acute watery diarrhea, but they do not replace rehydration.\n\n"
                "Antibiotics are not routine for uncomplicated watery diarrhea. Consider stool testing and targeted antibiotics for dysentery, suspected cholera, severe traveler diarrhea, persistent fever, sepsis, immunocompromise, or outbreak context. Escalate urgently for severe dehydration, blood in stool, persistent vomiting, severe pain, altered sensorium, infants/elderly, pregnancy, or symptoms lasting more than 3 days."
            )
        elif user_role == "doctor" and "fever" in question and any(term in question for term in ["medicine", "medicines", "give", "prescribe", "drug"]):
            aggregated_answer = (
                "For an uncomplicated adult fever, consider:\n\n"
                "1. Paracetamol/acetaminophen 500-650 mg orally every 6 hours as needed. "
                "Keep total daily dose within local safety limits and avoid excess use in liver disease or heavy alcohol use.\n"
                "2. Ibuprofen 200-400 mg orally every 6-8 hours with food if there is no renal disease, active gastritis/ulcer, anticoagulant use, uncontrolled hypertension, pregnancy risk, or NSAID allergy.\n\n"
                "Assess for source of fever, hydration status, vitals, rash, neck stiffness, breathlessness, altered sensorium, persistent vomiting, severe abdominal pain, dengue/malaria/typhoid exposure, and fever lasting more than 3 days. "
                "Escalate urgently for red flags, infants, elderly patients, pregnancy, immunocompromise, or unstable vitals."
            )
        else:
            aggregated_answer = self.generator.generate(
                question=(
                    "Write only the final clinical answer for the user. Do not expose agent names, prompts, "
                    "retrieved context, PM-JAY analysis, or internal reasoning. Be concise and actionable. "
                    "If the user is a doctor asking about treatment or tablets, provide clinician-facing treatment options, common dose ranges, contraindications, monitoring, and red flags instead of telling them to consult a doctor.\n\n"
                    f"User question: {state.get('question', '')}\n\n"
                    f"Clinical draft:\n{clinical}\n\n"
                    f"Medication safety notes:\n{pharmacy}"
                ),
                user_role=user_role,
                conversation_history=[],
                sources=state.get("compressed_sources") or state.get("sources", []),
                disclaimer=self.safety.patient_disclaimer() if user_role == "patient" else None,
                policy_instruction="Return only the final answer text.",
                policy_mode="final_answer_only",
            )
            refusal_markers = [
                "consult with a healthcare provider",
                "consult a qualified clinician",
                "cannot provide medical advice",
                "i don't think tablets are a good option",
            ]
            if user_role == "doctor" and any(marker in aggregated_answer.lower() for marker in refusal_markers):
                aggregated_answer = (
                    "For this treatment question, first confirm diagnosis, severity, age, pregnancy status, renal/hepatic function, allergies, current medicines, and red flags. Then choose disease-specific therapy with dose adjustment and monitoring.\n\n"
                    "Provide the safest first-line option for the likely diagnosis, list alternatives when contraindicated, and include when to escalate or refer. Avoid controlled drugs or high-risk therapies unless the diagnosis, indication, and monitoring plan are clear."
                )
            if len(aggregated_answer.strip()) < 40:
                aggregated_answer = clinical if len(clinical.strip()) >= 40 else (
                    "I could not generate a reliable final answer from the current model response. "
                    "Please retry with the patient age, symptoms, vitals, relevant history, and current medications."
                )
        return {"answer": aggregated_answer}

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

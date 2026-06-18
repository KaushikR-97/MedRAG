from dataclasses import dataclass

from app.models.user import User


PATIENT_DIAGNOSIS_TERMS = {
    "diagnose",
    "diagnosis",
    "what disease",
    "do i have",
    "confirm",
    "prescribe",
    "dose",
}


@dataclass(frozen=True)
class AiPolicyResult:
    allowed: bool
    mode: str
    instruction: str
    refusal: str | None = None


class AiPolicyService:
    def evaluate(self, *, actor: User, question: str) -> AiPolicyResult:
        text = question.lower()
        if actor.role == "patient" and any(term in text for term in PATIENT_DIAGNOSIS_TERMS):
            return AiPolicyResult(
                allowed=False,
                mode="patient_education_only",
                instruction="Patients may receive education, red flags, and guidance to consult a clinician, but no diagnosis or prescription.",
                refusal=(
                    "I cannot diagnose you or prescribe medicine. I can explain possible red flags, "
                    "general health information, and when to consult a qualified doctor."
                ),
            )

        if actor.role == "patient":
            return AiPolicyResult(
                allowed=True,
                mode="patient_education_only",
                instruction=(
                    "Answer as educational support only. Do not diagnose. Do not prescribe. "
                    "Use plain language, cite sources, and advise clinician consultation."
                ),
            )

        return AiPolicyResult(
            allowed=True,
            mode="clinician_decision_support",
            instruction=(
                "Provide clinical decision support for a licensed clinician. Include differential considerations, "
                "contraindications, dose-safety reminders, uncertainty, and source citations. The clinician remains responsible."
            ),
        )


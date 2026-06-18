EMERGENCY_TERMS = {
    "chest pain",
    "difficulty breathing",
    "stroke",
    "unconscious",
    "severe bleeding",
    "suicidal",
}


class ClinicalSafetyService:
    def classify(self, question: str) -> tuple[str, str | None]:
        text = question.lower()
        if any(term in text for term in EMERGENCY_TERMS):
            return "urgent_escalation", "Seek emergency medical care now or call local emergency services."
        return "clinical_guidance", None

    def patient_disclaimer(self) -> str:
        return "This is educational support, not a diagnosis. Consult a qualified clinician."


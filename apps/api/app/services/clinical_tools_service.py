from dataclasses import dataclass


DRUG_INTERACTIONS = {
    ("sildenafil", "nitrate"): ("contraindicated", "Risk of severe hypotension."),
    ("warfarin", "aspirin"): ("major", "Increased bleeding risk."),
    ("tramadol", "ssri"): ("major", "Risk of serotonin syndrome."),
    ("metformin", "furosemide"): ("moderate", "Monitor renal function and lactic acidosis risk."),
}


@dataclass(frozen=True)
class InteractionResult:
    medicine_a: str
    medicine_b: str
    severity: str
    message: str


class ClinicalToolsService:
    def check_interactions(self, medicines: list[str]) -> list[InteractionResult]:
        normalized = [medicine.lower().strip() for medicine in medicines]
        results: list[InteractionResult] = []
        for i, med_a in enumerate(normalized):
            for med_b in normalized[i + 1 :]:
                for (a, b), (severity, message) in DRUG_INTERACTIONS.items():
                    if (a in med_a and b in med_b) or (b in med_a and a in med_b):
                        results.append(InteractionResult(med_a, med_b, severity, message))
        return results

    def interpret_lab(self, *, test_name: str, value: float, unit: str = "") -> str:
        name = test_name.lower()
        if name in {"hba1c", "hbA1c".lower()}:
            if value >= 6.5:
                return "HbA1c is in diabetic range; clinician follow-up is recommended."
            if value >= 5.7:
                return "HbA1c is in prediabetes range; lifestyle and clinician review are recommended."
            return "HbA1c is below prediabetes threshold."
        if name in {"systolic_bp", "bp_systolic"}:
            return "High systolic BP; repeat measurement and clinician review are recommended." if value >= 140 else "Systolic BP is not high by this threshold."
        return "No local reference range configured for this test yet."

    def symptom_triage(self, *, symptoms: str, severity: int) -> str:
        text = symptoms.lower()
        if severity >= 8 or any(term in text for term in ["chest pain", "breathing", "unconscious", "stroke"]):
            return "urgent: seek emergency care or contact local emergency services."
        if severity >= 5:
            return "soon: book clinician consultation within 24-48 hours."
        return "routine: monitor symptoms and consult a clinician if persistent or worsening."

    def health_score(self, *, completed_checks: int, risk_factors: int) -> int:
        return max(0, min(100, 50 + completed_checks * 7 - risk_factors * 8))

    def mental_health_risk(self, *, score: int, screening_type: str) -> str:
        if score >= 20:
            return "severe"
        if score >= 15:
            return "moderately_severe"
        if score >= 10:
            return "moderate"
        if score >= 5:
            return "mild"
        return "minimal"


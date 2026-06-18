import re

from app.core.config import settings
from app.rag.retriever import RetrievedChunk


class EvidenceCompressionService:
    """Keeps only the most relevant evidence sentences for generation."""

    def compress(self, *, question: str, sources: list[RetrievedChunk]) -> list[RetrievedChunk]:
        if not sources:
            return []
        terms = {
            token
            for token in re.findall(r"[a-zA-Z0-9]+", question.lower())
            if len(token) > 2
        }
        compressed: list[RetrievedChunk] = []
        for source in sources:
            sentences = re.split(r"(?<=[.!?])\s+", source.text.strip())
            ranked = sorted(
                sentences,
                key=lambda sentence: self._overlap_score(sentence=sentence, terms=terms),
                reverse=True,
            )
            selected = " ".join(sentence for sentence in ranked[:3] if sentence).strip()
            if not selected:
                selected = source.text[: settings.evidence_max_chars_per_source]
            compressed.append(
                RetrievedChunk(
                    id=source.id,
                    title=source.title,
                    score=source.score,
                    text=selected[: settings.evidence_max_chars_per_source],
                )
            )
        return compressed

    @staticmethod
    def _overlap_score(*, sentence: str, terms: set[str]) -> int:
        words = set(re.findall(r"[a-zA-Z0-9]+", sentence.lower()))
        return len(words & terms)


class CitationValidationService:
    """Ensures generated answers expose usable source IDs when sources exist."""

    def validate(self, *, answer: str, sources: list[RetrievedChunk]) -> str:
        if not settings.citation_validation_enabled or not sources:
            return answer
        source_ids = [source.id for source in sources]
        cited_ids = {match for match in re.findall(r"\[([^\]]+)\]", answer)}
        if cited_ids & set(source_ids):
            return answer
        citations = ", ".join(f"[{source_id}]" for source_id in source_ids[:3])
        return (
            f"{answer.rstrip()}\n\n"
            f"Evidence used: {citations}. Please verify clinical decisions against the cited record/guideline."
        )

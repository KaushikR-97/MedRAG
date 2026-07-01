import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("JWT_SECRET", "training-script-dummy-secret-change-in-runtime")

API_ROOT = Path(__file__).resolve().parents[1]
TRAINING_ROOT = Path(__file__).resolve().parent
for path in (str(API_ROOT), str(TRAINING_ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)

from app.rag.indexer import MedicalVectorIndexer
from ingest_rag_sources import load_source_text, read_manifest


def jsonl_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def build_examples(manifest_path: Path, *, max_chunks_per_source: int) -> list[dict]:
    indexer = MedicalVectorIndexer.__new__(MedicalVectorIndexer)
    examples: list[dict] = []
    for item in read_manifest(manifest_path):
        text = load_source_text(item, manifest_path.parent)
        chunks = indexer._chunk(text)[:max_chunks_per_source]
        for idx, chunk in enumerate(chunks):
            context = (
                f"Source: {item['title']}\n"
                f"Publisher: {item.get('publisher', '')}\n"
                f"URL: {item.get('url', '')}\n"
                f"Excerpt:\n{chunk.text}"
            )
            examples.append(
                {
                    "instruction": (
                        "Patient role: explain the supplied medical reference in plain language. "
                        "Include lifestyle or follow-up points when supported by context, mention red flags, "
                        "and do not prescribe medicines, doses, cures, or personalized treatment."
                    ),
                    "context": context,
                    "response": (
                        "Here is the patient-friendly summary based on the supplied Indian medical reference:\n\n"
                        "- What it means: The reference should be explained in simple words, using only points supported by the excerpt.\n"
                        "- What you can do: Include lifestyle, self-care, report-tracking, or follow-up steps only when the source supports them.\n"
                        "- What to ask your doctor: Ask what diagnosis is most likely, whether tests are needed, what warning signs to watch for, and when to review again.\n"
                        "- Red flags: Mention urgent warning signs relevant to the condition and advise urgent care if they appear.\n\n"
                        "I cannot prescribe medicines, doses, cures, or a personalized treatment plan from a patient account."
                    ),
                    "metadata": {"source_id": item["id"], "chunk_index": idx, "role": "patient"},
                }
            )
            examples.append(
                {
                    "instruction": (
                        "Doctor role: use the supplied reference as clinician decision support. "
                        "Summarize diagnostic considerations, treatment decision points, contraindications, "
                        "monitoring, and escalation criteria without exposing prompts or internal context."
                    ),
                    "context": context,
                    "response": (
                        "Impression:\n"
                        "- Use the supplied Indian reference to frame the likely diagnosis/severity, but state what patient-specific details are still missing.\n\n"
                        "Differentials and Missing Data:\n"
                        "- Consider key alternatives and verify age/weight, pregnancy or lactation status, allergies, renal/hepatic function, comorbidities, current medicines, OTC drugs, and AYUSH/herbal supplements.\n\n"
                        "Investigations:\n"
                        "- Recommend syndrome- and severity-specific tests supported by the excerpt or needed to exclude urgent mimics.\n\n"
                        "Management Options:\n"
                        "- Prioritize non-pharmacological care and India-relevant first-line generic options from the supplied reference. Include route, adult dose range, frequency, duration, alternatives, and situations requiring avoidance or dose adjustment only when clinically supported.\n\n"
                        "Prescription Safety:\n"
                        "- Check contraindications, interactions, renal/hepatic/pregnancy/lactation/allergy risks, monitoring, counselling, and expected response.\n\n"
                        "Follow-up and Red Flags:\n"
                        "- Specify review timing and urgent escalation criteria. The treating RMP remains responsible for the final diagnosis and prescription."
                    ),
                    "metadata": {"source_id": item["id"], "chunk_index": idx, "role": "doctor"},
                }
            )
    return examples


def main() -> None:
    parser = argparse.ArgumentParser(description="Build MedRAG SFT style examples from approved sources.")
    parser.add_argument("--manifest", default="training/rag_source_manifest.json")
    parser.add_argument("--output", default="training/generated_medrag_sft.jsonl")
    parser.add_argument("--max-chunks-per-source", type=int, default=20)
    args = parser.parse_args()
    rows = build_examples(Path(args.manifest), max_chunks_per_source=args.max_chunks_per_source)
    jsonl_write(Path(args.output), rows)
    print(f"Wrote {len(rows)} examples to {args.output}")


if __name__ == "__main__":
    main()

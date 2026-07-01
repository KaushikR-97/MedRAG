import argparse
import json
from pathlib import Path
from urllib.parse import urlparse


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_REGISTRY = BASE_DIR / "data" / "source_registry" / "indian_medical_ai_sources.json"
DEFAULT_OUTPUT = BASE_DIR / "apps" / "api" / "training" / "indian_rag_source_manifest.json"

REQUIRED_FIELDS = [
    "id",
    "name",
    "url",
    "publisher",
    "source_family",
    "priority",
    "retrieved_date",
    "india_relevance",
    "recommended_use",
    "phi_status",
    "commercial_use_status",
    "quality_gate",
]


def load_registry(path: Path) -> list[dict]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("Source registry must be a JSON list")
    return rows


def validate_row(row: dict) -> None:
    missing = [field for field in REQUIRED_FIELDS if not row.get(field)]
    if missing:
        raise ValueError(f"{row.get('id', '<missing id>')} missing fields: {', '.join(missing)}")
    parsed = urlparse(row["url"])
    if parsed.scheme not in {"https", "http"} or not parsed.netloc:
        raise ValueError(f"{row['id']} has invalid URL: {row['url']}")
    if "rag_manifest" not in row:
        raise ValueError(f"{row['id']} missing rag_manifest")
    if row.get("phi_status") not in {"public_non_phi", "public_non_phi_or_aggregate", "aggregate_or_public_non_phi"}:
        raise ValueError(f"{row['id']} has unsafe or unsupported PHI status: {row.get('phi_status')}")


def to_manifest_item(row: dict) -> dict:
    manifest = row["rag_manifest"]
    return {
        "id": row["id"],
        "title": manifest.get("title") or row["name"],
        "publisher": row["publisher"],
        "url": row["url"],
        "source_type": manifest.get("source_type", "guideline"),
        "publication_date": manifest.get("publication_date", row["retrieved_date"]),
        "retrieved_date": row["retrieved_date"],
        "license_status": manifest.get("license_status", row["commercial_use_status"]),
        "language": manifest.get("language", "en"),
        "priority": row["priority"],
        "source_family": row["source_family"],
        "recommended_use": row["recommended_use"],
        "quality_gate": row["quality_gate"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a RAG ingestion manifest from the India-first source registry.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--include-p1", action="store_true", help="Include P1 sources in addition to P0.")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    registry_path = Path(args.registry)
    output_path = Path(args.output)
    rows = load_registry(registry_path)
    for row in rows:
        validate_row(row)

    priorities = {"P0", "P1"} if args.include_p1 else {"P0"}
    manifest = [to_manifest_item(row) for row in rows if row["priority"] in priorities and "rag_corpus" in row["recommended_use"]]
    if not manifest:
        raise ValueError("No approved RAG sources matched the selected priorities")

    if args.validate_only:
        print(f"Validated {len(rows)} registry rows; {len(manifest)} rows would be written.")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(manifest)} manifest rows to {output_path}")


if __name__ == "__main__":
    main()

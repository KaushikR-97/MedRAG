import argparse
from dataclasses import dataclass
import json
import os
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

os.environ.setdefault("JWT_SECRET", "training-script-dummy-secret-change-in-runtime")

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

@dataclass
class SourceChunk:
    text: str


def chunk_text(text: str, *, target_chars: int = 900, overlap_chars: int = 140) -> list[SourceChunk]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    chunks: list[SourceChunk] = []
    start = 0
    while start < len(normalized):
        end = min(start + target_chars, len(normalized))
        if end < len(normalized):
            boundary = max(normalized.rfind("\n", start, end), normalized.rfind(". ", start, end))
            if boundary > start + target_chars // 2:
                end = boundary + 1
        chunks.append(SourceChunk(text=normalized[start:end].strip()))
        if end >= len(normalized):
            break
        start = max(0, end - overlap_chars)
    return chunks


def normalize_text(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.replace("\r", "\n").split("\n")]
    return "\n".join(line for line in lines if line)


def load_indexer_class():
    from app.rag.indexer import MedicalVectorIndexer

    return MedicalVectorIndexer


def read_manifest(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fetch_url(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "MedRAG-India/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def html_to_text(data: bytes) -> str:
    raw = data.decode("utf-8", errors="ignore")
    raw = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    raw = re.sub(r"&nbsp;|&#160;", " ", raw)
    raw = re.sub(r"&amp;", "&", raw)
    return re.sub(r"\s+", " ", raw).strip()


def pdf_to_text(data: bytes) -> str:
    try:
        import pypdf
    except Exception:
        pypdf = None
    if pypdf is not None:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            tmp.write(data)
            tmp.flush()
            pdf = pypdf.PdfReader(tmp.name)
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    try:
        import fitz

        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            tmp.write(data)
            tmp.flush()
            doc = fitz.open(tmp.name)
            return "\n".join(page.get_text("text") for page in doc)
    except Exception as exc:
        raise RuntimeError("PDF extraction requires pypdf or PyMuPDF installed") from exc


def load_source_text(item: dict, base_dir: Path) -> str:
    if item.get("text"):
        return str(item["text"])
    if item.get("path"):
        return (base_dir / item["path"]).read_text(encoding="utf-8-sig")
    if item.get("url"):
        data = fetch_url(item["url"])
        content_type = item.get("content_type", "").lower()
        if item["url"].lower().endswith(".pdf") or "pdf" in content_type:
            return pdf_to_text(data)
        return html_to_text(data)
    raise ValueError(f"Source {item.get('id', '<unknown>')} has no text, path, or url")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest approved guideline/reference sources into Qdrant.")
    parser.add_argument("--manifest", default="training/rag_source_manifest.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--continue-on-error", action="store_true")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    sources = read_manifest(manifest_path)
    indexer = None
    if not args.dry_run:
        indexer = load_indexer_class()()
    total_chunks = 0
    failures: list[tuple[str, str]] = []
    for item in sources:
        try:
            text = load_source_text(item, manifest_path.parent)
            if len(text.strip()) < 80:
                raise ValueError(f"Source {item['id']} produced too little text")
            if args.dry_run:
                chunks = chunk_text(text)
                print(f"{item['id']}: {len(chunks)} chunks (dry run)")
                total_chunks += len(chunks)
                continue
            if indexer is None:
                raise RuntimeError("Indexer failed to initialize")
            count = indexer.index_reference_document(
                source_id=item["id"],
                title=item["title"],
                text=text,
                source_type=item.get("source_type", "guideline"),
                url=item.get("url", ""),
                publisher=item.get("publisher", ""),
                publication_date=item.get("publication_date", ""),
                license_status=item.get("license_status", ""),
                language=item.get("language", "en"),
            )
            print(f"{item['id']}: indexed {count} chunks")
            total_chunks += count
        except Exception as exc:
            if not args.continue_on_error:
                raise
            failures.append((item.get("id", "<unknown>"), str(exc)))
            print(f"{item.get('id', '<unknown>')}: failed: {exc}")
    print(f"Total chunks: {total_chunks}")
    if failures:
        print("Failures:")
        for source_id, error in failures:
            print(f"- {source_id}: {error}")
        if not args.dry_run:
            raise SystemExit(1)


if __name__ == "__main__":
    main()

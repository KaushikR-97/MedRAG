import argparse
import json
import sys
import time
from pathlib import Path

from evaluate_adapter import generate_answer, load_model


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def resolve_existing_path(value: str, *, api_root: Path, repo_root: Path) -> Path:
    raw = Path(value).expanduser()
    candidates = [
        raw,
        api_root / raw,
        repo_root / raw,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return (api_root / raw).resolve() if not raw.is_absolute() else raw


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate predictions JSONL for clinical quality cases.")
    parser.add_argument("--cases", default="training/clinical_quality_cases.jsonl")
    parser.add_argument("--output", default="training/predictions.jsonl")
    parser.add_argument("--base-model", default="BioMistral/BioMistral-7B")
    parser.add_argument("--adapter-path", default="models/biomistral-medical")
    parser.add_argument("--max-input-tokens", type=int, default=2500)
    parser.add_argument("--max-new-tokens", type=int, default=512)
    parser.add_argument("--max-memory-json", default='{"0":"13GiB","cpu":"24GiB"}')
    parser.add_argument("--limit", type=int, default=0, help="Generate only the first N cases for a fast smoke test.")
    parser.add_argument("--case-id", action="append", default=[], help="Generate only matching case IDs. Can be repeated.")
    parser.add_argument("--continue-on-error", action="store_true", help="Write failed prediction rows instead of stopping at the first model error.")
    args = parser.parse_args()

    api_root = Path(__file__).resolve().parents[1]
    repo_root = api_root.parents[1]
    cases_path = resolve_existing_path(args.cases, api_root=api_root, repo_root=repo_root)
    output_path = resolve_existing_path(args.output, api_root=api_root, repo_root=repo_root)
    adapter_path = resolve_existing_path(args.adapter_path, api_root=api_root, repo_root=repo_root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cases = load_jsonl(cases_path)
    if args.case_id:
        wanted = set(args.case_id)
        cases = [case for case in cases if case.get("id") in wanted]
    if args.limit > 0:
        cases = cases[: args.limit]
    if not cases:
        raise SystemExit("No clinical quality cases matched the requested filters.")
    if not adapter_path.exists():
        raise SystemExit(
            f"Adapter path not found: {adapter_path}\n"
            "Pass --adapter-path models/biomistral-medical when running from apps/api, "
            "or --adapter-path apps/api/models/biomistral-medical when running from the repo root."
        )

    print("Loading model once for all quality cases. This avoids per-question reload overhead.")
    try:
        tokenizer, model = load_model(args.base_model, str(adapter_path), args.max_memory_json)
    except Exception as exc:
        raise SystemExit(
            "Failed to load base model or adapter once for batch prediction. "
            "Check GPU memory, HF cache/auth, adapter path, and bitsandbytes CUDA support. "
            f"Details: {exc}"
        ) from exc

    with output_path.open("w", encoding="utf-8") as handle:
        started_at = time.perf_counter()
        for index, case in enumerate(cases, start=1):
            prompt = f"{case['role'].capitalize()} role: {case['question']}"
            try:
                case_started_at = time.perf_counter()
                answer = generate_answer(
                    tokenizer=tokenizer,
                    model=model,
                    prompt=prompt,
                    max_input_tokens=args.max_input_tokens,
                    max_new_tokens=args.max_new_tokens,
                )
            except Exception as exc:
                message = (
                    f"Prediction failed for {case['id']}: {type(exc).__name__}: {exc}\n"
                    f"Prompt: {prompt}"
                )
                if not args.continue_on_error:
                    raise SystemExit(message)
                print(message, file=sys.stderr)
                handle.write(json.dumps({"id": case["id"], "answer": "", "error": message}, ensure_ascii=False) + "\n")
                handle.flush()
                continue
            handle.write(json.dumps({"id": case["id"], "answer": answer}, ensure_ascii=False) + "\n")
            handle.flush()
            elapsed = time.perf_counter() - case_started_at
            print(f"Wrote prediction {index}/{len(cases)} for {case['id']} in {elapsed:.1f}s")

    total_elapsed = time.perf_counter() - started_at
    print(f"Predictions saved to {output_path} in {total_elapsed / 60:.1f} minutes")


if __name__ == "__main__":
    main()

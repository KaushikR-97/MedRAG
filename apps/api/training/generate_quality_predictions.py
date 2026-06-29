import argparse
import json
import subprocess
import sys
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate predictions JSONL for clinical quality cases.")
    parser.add_argument("--cases", default="training/clinical_quality_cases.jsonl")
    parser.add_argument("--output", default="training/predictions.jsonl")
    parser.add_argument("--base-model", default="BioMistral/BioMistral-7B")
    parser.add_argument("--adapter-path", default="models/biomistral-medical")
    parser.add_argument("--max-input-tokens", type=int, default=2500)
    parser.add_argument("--max-new-tokens", type=int, default=1024)
    args = parser.parse_args()

    cases_path = Path(args.cases)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    evaluator = Path(__file__).with_name("evaluate_adapter.py")
    cases = load_jsonl(cases_path)

    with output_path.open("w", encoding="utf-8") as handle:
        for case in cases:
            prompt = f"{case['role'].capitalize()} role: {case['question']}"
            command = [
                sys.executable,
                str(evaluator),
                "--base-model",
                args.base_model,
                "--adapter-path",
                args.adapter_path,
                "--max-input-tokens",
                str(args.max_input_tokens),
                "--max-new-tokens",
                str(args.max_new_tokens),
                "--prompt",
                prompt,
            ]
            completed = subprocess.run(command, check=True, capture_output=True, text=True)
            answer = completed.stdout.strip()
            handle.write(json.dumps({"id": case["id"], "answer": answer}, ensure_ascii=False) + "\n")
            handle.flush()
            print(f"Wrote prediction for {case['id']}")

    print(f"Predictions saved to {output_path}")


if __name__ == "__main__":
    main()

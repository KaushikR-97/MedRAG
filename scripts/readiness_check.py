import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def check_file(path: str) -> tuple[bool, str]:
    target = ROOT / path
    return target.exists(), path


def run_command(command: list[str], cwd: Path) -> tuple[bool, str]:
    try:
        result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=120, check=False)
    except Exception as exc:
        return False, f"{' '.join(command)} failed to start: {exc}"
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output[-1000:]


def env_present(names: list[str]) -> tuple[bool, str]:
    missing = [name for name in names if not os.environ.get(name)]
    return not missing, ", ".join(missing)


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def env_or_file_present(names: list[str], env_file: Path) -> tuple[bool, str]:
    file_values = parse_env_file(env_file)
    missing = [name for name in names if not (os.environ.get(name) or file_values.get(name))]
    return not missing, ", ".join(missing)


def main() -> None:
    parser = argparse.ArgumentParser(description="MedRAG investor-demo and closed-pilot readiness check.")
    parser.add_argument("--level", choices=["demo", "pilot"], default="demo")
    parser.add_argument("--env-file", default="apps/api/.env.example")
    parser.add_argument("--external-gates-file", default="")
    parser.add_argument("--skip-build", action="store_true")
    args = parser.parse_args()

    checks: list[dict] = []

    required_files = [
        "docs/DATASET_SOURCING_AND_MODEL_PLAN.md",
        "docs/DEMO_AND_PILOT_READINESS.md",
        "data/source_registry/seed_sources.json",
        "apps/api/training/clinical_quality_cases.jsonl",
        "apps/api/training/evaluate_clinical_quality.py",
        "apps/api/training/rag_source_manifest.json",
        "apps/api/training/ingest_rag_sources.py",
        "apps/api/training/generated_medrag_sft.jsonl",
    ]
    for file_path in required_files:
        passed, detail = check_file(file_path)
        checks.append({"name": f"file:{file_path}", "passed": passed, "detail": detail})

    env_ok, missing_env = env_or_file_present(["DATABASE_URL", "REDIS_URL", "QDRANT_URL"], ROOT / args.env_file)
    checks.append({"name": "runtime_env_core_services", "passed": env_ok, "detail": missing_env or f"ok via {args.env_file}"})

    source_registry = ROOT / "data/source_registry/seed_sources.json"
    try:
        sources = json.loads(source_registry.read_text(encoding="utf-8-sig"))
        india_sources = [s for s in sources if s.get("india_relevance") == "high"]
        checks.append({"name": "india_source_registry", "passed": len(india_sources) >= 6, "detail": str(len(india_sources))})
    except Exception as exc:
        checks.append({"name": "india_source_registry", "passed": False, "detail": str(exc)})

    cases_path = ROOT / "apps/api/training/clinical_quality_cases.jsonl"
    try:
        cases = [json.loads(line) for line in cases_path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
        roles = {case["role"] for case in cases}
        checks.append({"name": "clinical_eval_case_count", "passed": len(cases) >= 25, "detail": str(len(cases))})
        checks.append({"name": "clinical_eval_role_coverage", "passed": {"patient", "doctor"}.issubset(roles), "detail": ",".join(sorted(roles))})
    except Exception as exc:
        checks.append({"name": "clinical_eval_cases_parse", "passed": False, "detail": str(exc)})

    if not args.skip_build:
        python = sys.executable
        passed, output = run_command([python, "-m", "compileall", "apps/api/app", "apps/api/training"], ROOT)
        checks.append({"name": "python_compile", "passed": passed, "detail": output or "ok"})

    if args.level == "pilot":
        pilot_files = [
            "docs/CLINICAL_PILOT_VALIDATION_PROTOCOL.md",
            "docs/CLINICAL_PILOT_OPERATIONS_RUNBOOK.md",
            "docs/CLINICAL_EVAL_REVIEW_TEMPLATE.md",
            "docs/LIGHTNING_CLUSTER_DEPLOYMENT_PLAN.md",
            "docs/pilot_external_gates.example.json",
        ]
        for file_path in pilot_files:
            passed, detail = check_file(file_path)
            checks.append({"name": f"file:{file_path}", "passed": passed, "detail": detail})
        pilot_manual = {
            "clinical_governance_signoff": False,
            "legal_privacy_review": False,
            "backup_restore_tested": False,
            "monitoring_alerts_configured": False,
            "dedicated_turn_or_video_sfu_configured": False,
            "licensed_guideline_corpus_loaded": False,
            "clinician_reviewed_eval_cases_200_plus": False,
            "urgent_escalation_100_percent": False,
            "zero_patient_prescribing_violations": False,
            "incident_response_runbook_approved": False,
        }
        if args.external_gates_file:
            try:
                gate_values = json.loads((ROOT / args.external_gates_file).read_text(encoding="utf-8-sig"))
                pilot_manual.update({key: bool(value) for key, value in gate_values.items() if key in pilot_manual})
            except Exception as exc:
                checks.append({"name": "external_gates_file_parse", "passed": False, "detail": str(exc)})
        for name, passed in pilot_manual.items():
            checks.append({
                "name": name,
                "passed": passed,
                "detail": "approved" if passed else "manual external gate required",
            })

    passed_count = sum(1 for check in checks if check["passed"])
    total = len(checks)
    print(json.dumps({"level": args.level, "passed": passed_count, "total": total, "checks": checks}, indent=2))
    raise SystemExit(0 if passed_count == total else 1)


if __name__ == "__main__":
    main()

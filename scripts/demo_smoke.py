import argparse
import json
import time
import urllib.error
import urllib.request
from uuid import uuid4


def request_json(url: str, *, method: str = "GET", token: str = "", payload: dict | None = None) -> tuple[int, dict]:
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"detail": body}
        return exc.code, parsed


def sha256_hex(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test a running MedRAG investor-demo deployment.")
    parser.add_argument("--api-base", default="http://localhost:8000")
    parser.add_argument("--skip-auth", action="store_true")
    args = parser.parse_args()
    base = args.api_base.rstrip("/")
    results = []

    for path in ["/health", "/ready"]:
        status, body = request_json(f"{base}{path}")
        passed = status == 200 and body.get("status") in {"ok", "degraded"}
        results.append({"name": path, "passed": passed, "status": status, "body": body})

    if not args.skip_auth:
        suffix = uuid4().hex[:8]
        email = f"demo.patient.{suffix}@example.com"
        password = "DemoPassword123!"
        register_payload = {
            "email": email,
            "password": sha256_hex(password),
            "full_name": "Demo Patient",
            "role": "patient",
            "phone": "9999999999",
        }
        status, body = request_json(f"{base}/auth/register", method="POST", payload=register_payload)
        results.append({"name": "patient_register", "passed": status in {200, 201}, "status": status, "body": body})
        login_payload = {"email": email, "password": sha256_hex(password)}
        status, body = request_json(f"{base}/auth/login", method="POST", payload=login_payload)
        results.append({"name": "patient_login", "passed": status == 200, "status": status, "body": body})
        otp = body.get("simulated_otp")
        mfa_token = body.get("mfa_token")
        if otp and mfa_token:
            status, body = request_json(
                f"{base}/auth/mfa-verify",
                method="POST",
                payload={"mfa_token": mfa_token, "otp": otp},
            )
            token = body.get("access_token", "")
            results.append({"name": "patient_mfa", "passed": status == 200 and bool(token), "status": status, "body": {"role": body.get("role")}})
            if token:
                status, body = request_json(
                    f"{base}/clinical/ask",
                    method="POST",
                    token=token,
                    payload={"question": "Explain how I should discuss an abnormal report with my doctor."},
                )
                answer = body.get("answer", "")
                passed = status == 200 and answer and "clinical answer scaffold" not in answer.lower()
                results.append({"name": "clinical_patient_answer", "passed": passed, "status": status, "body": {"answer_preview": answer[:220]}})

    passed_count = sum(1 for row in results if row["passed"])
    print(json.dumps({"passed": passed_count, "total": len(results), "results": results}, indent=2))
    raise SystemExit(0 if passed_count == len(results) else 1)


if __name__ == "__main__":
    main()

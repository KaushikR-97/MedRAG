# Demo And Closed Pilot Readiness Plan

This document defines what "100%" means for the investor demo and the closed
clinical pilot. It is intentionally stricter than a feature checklist.

## Investor Demo 100% Gate

The investor demo is ready when all items below pass on a fresh Lightning AI
deployment from `main`.

Run the automated portion with:

```bash
python scripts/readiness_check.py --level demo
```

After the API is running, run the live smoke test:

```bash
python scripts/demo_smoke.py --api-base http://localhost:8000
```

| Area | Gate |
| --- | --- |
| Deployment | `npm install`, API start, web start, migrations, worker start, Qdrant/Redis/Postgres health checks documented and repeatable. |
| UI | Dark MedRAG UI appears for patient, doctor, and hospital admin roles. No broken left/default template. |
| Auth | Register, login, MFA demo OTP, token refresh/re-login behavior after restart all work. |
| Patient flow | Onboarding, document upload, ingestion status, PDF view, reminder creation, family/consent, slot request, ambulance/resource request. |
| Doctor flow | Patient access request, patient record view after consent, clinical AI, prescription sign, slots, booking confirm, video call, chat. |
| Hospital admin flow | Hospital registration, departments, doctors, slots/resources, ambulance approval, bed/room resource booking, upload records during allowed window. |
| AI | `evaluate_clinical_quality.py` pass rate >= 85% on demo cases. No prompt leak or gibberish. |
| Telehealth | Video call connects both sides on laptop-to-laptop, chat works from confirmation through allowed window, video window is time-gated. |
| Audit | Consent, document access, prescription, chat/video room creation, and break-glass events are logged. |
| Recovery | Failed document ingestion shows job failure and retry action. |

## Demo Day Command Sequence

```bash
cp apps/api/.env.example apps/api/.env
docker compose up --build
python scripts/readiness_check.py --level demo
python scripts/demo_smoke.py --api-base http://localhost:8000
cd apps/api
python training/ingest_rag_sources.py --manifest training/rag_source_manifest.json --dry-run
```

On Lightning, run the same checks after setting public URLs and starting the API,
worker, web app, Redis, Postgres, Qdrant, and MinIO.

## Closed Clinical Pilot 100% Gate

The closed pilot is ready when investor-demo gates pass plus the following.

Run the automated/manual gate report with:

```bash
python scripts/readiness_check.py --level pilot
```

| Area | Gate |
| --- | --- |
| Clinical governance | Named supervising doctors approve AI behavior, prescription workflow, escalation text, and disclaimers. |
| Legal/compliance | Consent form, privacy notice, data retention, deletion, incident response, and BA/DPDP-style obligations reviewed by counsel. |
| AI evaluation | >= 90% pass rate on at least 200 locked cases; 100% urgent escalation pass; 0 patient prescribing violations. |
| Observability | API errors, background jobs, ingestion failures, model latency, Qdrant failures, Redis failures, and video-call failures visible in logs/alerts. |
| Security | Password/MFA policy, rate limiting, token revocation, PHI redaction, object storage access control, backup encryption verified. |
| Reliability | Backup and restore tested. Fresh deploy and restart tested. Worker queues drain successfully. |
| Operations | Support playbook, clinician onboarding, hospital admin onboarding, demo data reset, and emergency contact process documented. |
| Infrastructure | Dedicated TURN service or managed video infra configured for pilot; free public relay not used for pilot promises. |

## Work Remaining

Already implemented in code:
- Role-specific patient vs doctor AI policy.
- Source-grounded fallback instead of prompt scaffold leakage.
- Clinical cache namespace bump to avoid replaying old weak answers.
- Anti-repetition controls for local model generation.
- Generic fallback reasoning framework instead of disease-specific hardcoding.
- Document ingestion status, retry, and inline PDF view.
- HD WebRTC media constraints and larger call UI.

Still needs environment/operator work:
- Acquire and license source datasets.
- Load guideline/reference corpus into Qdrant.
- Run eval harness against actual deployed model responses.
- Configure production TURN/SFU or managed video service.
- Configure monitoring and backup/restore.
- Complete legal/privacy/clinical governance review.

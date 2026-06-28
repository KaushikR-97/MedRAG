# Clinical Pilot Operations Runbook

This runbook is for the closed clinical pilot owner, supervising doctors, and
technical operator.

## Daily Pilot Start

1. Confirm API readiness:
   ```bash
   curl <api-url>/ready
   python scripts/demo_smoke.py --api-base <api-url>
   ```
2. Confirm worker queue is running:
   ```bash
   rq info --url redis://localhost:6379/0
   ```
3. Confirm Qdrant has source chunks:
   ```bash
   cd apps/api
   python training/ingest_rag_sources.py --manifest training/rag_source_manifest.json --dry-run
   ```
4. Verify video call path with one staff patient and one staff doctor account.
5. Review previous-day errors, failed ingestion jobs, and support tickets.

## Incident Severity

| Severity | Definition | Response |
| --- | --- | --- |
| Sev 1 | Patient safety risk, wrong patient record access, PHI leak, emergency escalation failure | Stop affected workflow, notify pilot lead and clinical owner immediately |
| Sev 2 | Prescription/signature/chat/video/document flow broken for multiple users | Pause affected workflow, open technical incident, notify pilot users |
| Sev 3 | Single-user issue with workaround | Support ticket and same-day fix/triage |

## Patient Safety Incident Procedure

1. Stop the unsafe workflow or disable affected account/session.
2. Preserve audit logs, answer trace ID, document IDs, appointment IDs, and timestamps.
3. Notify supervising RMP and pilot manager.
4. Record incident in the pilot incident log.
5. Do not resume until clinical owner signs off.

## PHI / Privacy Incident Procedure

1. Revoke exposed session/token.
2. Disable affected access grant if relevant.
3. Preserve audit trail.
4. Identify affected patient, actor, document, and access path.
5. Notify privacy/legal reviewer before external communication.

## Backup And Restore Test

Before pilot:
- Export database backup.
- Export object storage bucket or snapshot.
- Record Qdrant collection snapshot/export procedure.
- Restore into a test namespace or fresh instance.
- Confirm patient profile, document metadata, appointment, consent, and audit rows restore correctly.

Minimum backup scope:
- Postgres database.
- Object storage bucket.
- Qdrant collections.
- `.env` secrets stored in secure secret manager, not plain repo.

## Monitoring Checklist

Monitor:
- API 5xx rate.
- Auth failures and token expiry loops.
- `/ready` degraded status.
- Redis/RQ queue length and failed jobs.
- Document ingestion failures.
- Qdrant connection failures.
- Model latency and generation failures.
- Video call join failures.
- Consent/access denials.

## Pilot User Support

For each pilot session record:
- Patient ID.
- Doctor ID.
- Appointment ID.
- Consent grant ID if records are accessed.
- Document IDs uploaded/viewed.
- AI trace IDs for any clinical answers discussed.
- Support notes and resolution.

## Stop Criteria

Pause pilot immediately if:
- AI gives patient-facing prescription/dose advice.
- Emergency question does not escalate.
- Wrong patient records are visible.
- Video/chat routes messages to the wrong participant.
- Data deletion or consent revocation fails.
- Supervising clinician requests pause.

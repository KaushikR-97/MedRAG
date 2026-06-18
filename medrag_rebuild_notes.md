# MedRAG India v3/v4 Analysis

## What The Files Are

- `medrag_india_v3.sh`: a full bootstrap script that installs system/Python dependencies, gathers secrets, writes a complete FastAPI app into `~/medical_rag`, fine-tunes/loads models, starts a server, and embeds a large static HTML/JS UI.
- `medrag_india_v4.sh`: an upgrade script that patches the v3 install with base64-encoded Python payloads, writes `api/v4_routes.py`, modifies `main.py`, and restarts the service.
- `medrag_workflows.jsx`: a React explainer component containing workflow diagrams and charts for non-technical users. Useful for documentation, not as core app architecture.

## Strong Ideas To Keep

- India-aware medical workflows: ABHA, PM-JAY, NMC/NABH registration context, regional languages, WhatsApp, and government-facility orientation.
- RAG architecture: dense retrieval, BM25 keyword retrieval, reciprocal rank fusion, citations, and patient profile context.
- Document pipeline: upload, OCR, patient verification before ingestion, and document-to-RAG flow.
- Proactive health agent: overdue checks, reminders, risk-prioritized tasks, doctor alerting.
- Doctor portal: prescriptions, SOAP/referral concepts, patient access logging.

## Problems To Fix Before Building Further

- Hardcoded/fallback secrets and secrets written to shell profile.
- Wildcard credentialed CORS.
- Opaque base64 upgrade payloads.
- No normal migrations; database schema is patched by scripts.
- Heavy work blocks app flows instead of running as jobs.
- Inline HTML/JS makes UI hard to test and easy to break.
- `innerHTML` is used heavily; escaped strings help in places but this should become component rendering.
- HIPAA/DPDP/ABDM compliance is mostly stated in UI, not enforced as a full control system.
- Clinical answers need stronger safety: citations, refusal policy, uncertainty handling, emergency escalation, and answer trace storage.

## Better Target

Build a normal repository:

```text
apps/
  api/
    app/
      api/
      core/
      models/
      schemas/
      services/
      rag/
      workers/
      tests/
    alembic/
  web/
    src/
      routes/
      components/
      api/
      features/
infra/
  docker/
  compose.yaml
```

## First MVP

1. Secure auth, explicit roles, user/patient profile, and audit event writer.
2. Document upload with validation, async OCR job, patient verification, and versioned OCR text.
3. RAG ingestion/query with source citations, clinical safety policies, and answer trace.
4. Doctor workflow with consent-based patient access, prescriptions, drug interaction warnings, and appointment requests.


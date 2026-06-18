# MedRAG India API

This is the production-oriented replacement for the original v3/v4 shell-generated prototype.

## Why LangGraph

LangGraph is the right orchestration layer for fine-tuned clinical RAG because MedRAG needs durable,
auditable workflow steps: safety check, retrieval, generation, trace storage, human review,
and later resume/retry behavior. LangChain remains useful inside nodes for retrievers,
prompt templates, model calls, and tool integrations.

Use plain LangChain chains only for simple two-step RAG. Use LangGraph when workflow state,
branching, auditability, and human-in-the-loop review matter.

## Fine-Tuned Model + RAG

This codebase supports fine-tuning and RAG together:

- `training/train_lora.py` creates a LoRA/QLoRA adapter from supervised JSONL examples.
- `MODEL_PROVIDER=local_hf` loads `BASE_MODEL_NAME` directly from Hugging Face.
- If `FINETUNED_ADAPTER_PATH` is set, the same loader attaches the LoRA/QLoRA adapter.
- `ClinicalRagGraph` still performs safety checks and retrieval before generation.
- `AnswerTraceService` records either the base model or `base_model+adapter_path`.
- `TrainingRun` and `ModelArtifact` tables track dataset hash, metrics, adapter URI,
  prompt version, and approval status.

The fine-tuned model should learn format and behavior. RAG should provide medical facts.

## Local Run

```bash
cd apps/api
cp .env.example .env
uvicorn app.main:app --reload
```

Set a real `JWT_SECRET` before starting. Do not reuse the example secret.

## Migrations

```bash
cd apps/api
alembic upgrade head
```

The app calls `init_db()` only in non-production environments so the scaffold is easy to try.
Production should run Alembic during deploy and start with `ENVIRONMENT=production`.

## Services

- `ObjectStorageService`: stores uploads in S3-compatible storage and records bucket/key/SHA-256.
- `MalwareScanner`: scans uploaded bytes through ClamAV before OCR.
- `IngestionService`: creates durable ingestion job rows and enqueues Redis/RQ jobs.
- `OcrService`: PaddleOCR-based extraction with native PDF text extraction,
  scanned PDF rendering, OCR confidence, and handwritten-prescription review gates.
- `MedicalVectorIndexer`: performs section-aware medical chunking with overlap,
  parent-window context, section/chunk metadata, BGE-M3 embeddings, and Qdrant writes.
- `HybridMedicalRetriever`: combines BGE-M3 Qdrant dense search, BM25 sparse search, RRF fusion, BGE reranking, and metadata filters.
- `BioMedClipImageIndexer`: writes X-ray, dental, and symptom-photo embeddings to a separate Qdrant image collection for similarity support only.
- `ClinicalGenerationService`: approved model-call boundary with prompt versioning.
- `LocalHuggingFaceModel`: loads BioMistral from Hugging Face and optionally attaches a PEFT adapter.
- `AnswerTraceService`: stores strict trace records for every generated answer.
- `ComplianceService`: enforces patient self-access or clinician care-team plus active consent.
- `AuditService`: writes hash-chained audit records.

## v3/v4 Feature Route Groups

- `/communication`: OTP send/verify for email, SMS, and WhatsApp.
- `/patient`: appointments, family members, medication reminders, symptoms, labs,
  vaccinations, pregnancy tracking, PHQ-9/GAD-7, health score, health tasks.
- `/doctor`: prescriptions, drug interactions, SOAP notes, referrals, second opinion,
  differential diagnosis, Rx renewal alerts, analytics.
- `/shared`: timeline, pre-consult summary, diet recommendations, PM-JAY assistant,
  caregiver links, voice transcription, weather-health, patient second opinion.
- `/public-health`: nearby facilities, outbreak heatmap, outbreak alert creation.

## Safety Filters

- `AiPolicyService` blocks patient diagnosis/prescription requests and allows only
  education, red flags, and consult-a-doctor guidance.
- `ClinicalRagGraph` prioritizes emergency escalation over normal answer generation.
- Doctors and hospital admins receive clinical decision support only after
  `ComplianceService` verifies care-team membership plus active consent.
- `PrivacyService` blocks staff document downloads and redacts common direct
  identifiers from traces.
- `SecurityHeadersMiddleware` adds `no-store`, `no-cache`, `nosniff`, frame-deny,
  and no-referrer headers.
- `AnswerTraceService` stores redacted prompt/answer/source traces with model,
  adapter, prompt version, safety label, and latency.

## Fine-Tuning

```bash
cd apps/api
pip install -e ".[finetune]"
python training/train_lora.py \
  --train-file training/sample_medrag_sft.jsonl \
  --output-dir models/medrag-lora
```

Dataset format:

```json
{"instruction":"...","context":"...","response":"..."}
```

Do not train on raw PHI. De-identify, document source licensing, and keep an evaluation set.

## Production Work Still Needed

- Add real OCR engines and confidence extraction.
- Add refresh-token rotation, MFA/OTP, and session revocation.
- Add object-lock retention, encryption/KMS, backup/restore, and disaster recovery.
- Add clinical eval datasets, regression tests, red-team tests, and clinician review queues.

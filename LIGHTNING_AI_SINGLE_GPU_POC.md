# Lightning AI Single-GPU POC Runbook

This POC uses:

- Free local Hugging Face zero-shot model for query routing.
- Local BioMistral pulled from Hugging Face for clinical answer generation.
  LoRA/QLoRA fine-tuning can be added later.
- RAG over BGE-M3 text embeddings in Qdrant, BM25, BGE reranking, and verified
  patient documents.
- Medical image intake for X-rays, dental images, and symptom photos with
  BioMedCLIP image embeddings plus clinician verification before image-derived
  text can enter clinical RAG.
- React UI to show route, confidence, fallback, trace ID, and answer.

## 0. Architecture For The Demo

```text
React UI
  -> FastAPI
  -> safety + consent checks
  -> free local Hugging Face query router
      if confidence >= 0.92: use selected route
      else: retrieve guidelines + patient records
  -> BGE-M3 Qdrant/BM25/BGE-rerank RAG
  -> local BioMistral from Hugging Face
  -> answer + route metadata + trace ID
```

## 1. Start In Lightning Studio

Use one GPU Studio. Do not create a venv; Lightning uses one default conda env.

```bash
cd "/teamspace/studios/this_studio/New project"
```

Verify GPU:

```bash
nvidia-smi
python - <<'PY'
import torch
print("CUDA:", torch.cuda.is_available())
print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none")
PY
```

## 2. Create API Environment File

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
cp .env.example .env
```

Edit `.env`:

```env
ENVIRONMENT=development
JWT_SECRET=replace-this-with-a-very-long-demo-secret-1234567890

DATABASE_URL=postgresql+psycopg://medrag:medrag@localhost:5432/medrag
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
EMBEDDING_MODEL=BAAI/bge-m3
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
IMAGE_EMBEDDING_ENABLED=true
IMAGE_EMBEDDING_MODEL=microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224
QDRANT_IMAGE_COLLECTION=medical_image_embeddings
OCR_ENGINE=paddleocr
OCR_LANGUAGES=en
OCR_MIN_CONFIDENCE=0.70
OCR_HANDWRITING_CONFIDENCE_THRESHOLD=0.82
OCR_STORE_HANDWRITTEN_RAW_TEXT=false
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=medrag-documents
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

OPENAI_API_KEY=
QUERY_ROUTER_PROVIDER=local_zero_shot
QUERY_ROUTER_MODEL=MoritzLaurer/deberta-v3-base-zeroshot-v2.0
QUERY_ROUTER_CONFIDENCE_THRESHOLD=0.92
QUERY_REWRITE_MODEL=

MODEL_PROVIDER=local_hf
BASE_MODEL_NAME=BioMistral/BioMistral-7B
FINETUNED_ADAPTER_PATH=
LOCAL_MODEL_DEVICE=auto
LOCAL_MODEL_LOAD_IN_4BIT=true
VISION_MODEL_ENABLED=false
VISION_MODEL_NAME=gpt-4.1-mini

ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:8000"]
```

This pulls `BioMistral/BioMistral-7B` from Hugging Face on first use. Keep
`FINETUNED_ADAPTER_PATH` empty until a LoRA adapter has been trained.

## 3. Start Infra Services

From project root:

```bash
cd "/teamspace/studios/this_studio/New project"
docker compose up -d postgres redis qdrant minio clamav
docker compose ps
```

Check Postgres:

```bash
docker compose exec postgres pg_isready -U medrag -d medrag
```

## 4. Install API Dependencies

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
python -m pip install -U pip
python -m pip install -e ".[dev,finetune,ocr]"
```

## 5. Run Migrations And Tests

```bash
alembic upgrade head
pytest tests/test_clinical_graph.py -q
```

Expected:

```text
passed
```

## 6. Optional: Train BioMistral Adapter Later

Skip this for the first presentation. The API can already use the base
`BioMistral/BioMistral-7B` model from Hugging Face with RAG. Fine-tune later when
you have approved, de-identified training examples.

For a short adapter experiment:

```bash
export HF_HOME=/teamspace/studios/this_studio/hf_cache

python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/sample_medrag_sft.jsonl \
  --output-dir models/biomistral-medical \
  --epochs 1 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 256 \
  --lora-r 8 \
  --lora-alpha 16 \
  --target-modules q_proj,v_proj \
  --max-memory-json '{"0":"14GiB","cpu":"24GiB"}'
```

If you have a larger GPU, use `--epochs 3` and `--max-length 512`.

Verify:

```bash
ls -lh models/biomistral-medical
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path models/biomistral-medical \
  --prompt "Explain diabetes follow-up safely for a patient in India."
```

## 7. Start API

Make sure `.env` now has:

```env
MODEL_PROVIDER=local_hf
BASE_MODEL_NAME=BioMistral/BioMistral-7B
FINETUNED_ADAPTER_PATH=
```

After training an adapter, keep `MODEL_PROVIDER=local_hf` and set
`FINETUNED_ADAPTER_PATH=./models/biomistral-medical`.

Run:

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

First clinical request may take time because BioMistral loads on GPU.

## 8. Start React UI

Open a second terminal:

```bash
cd "/teamspace/studios/this_studio/New project/apps/web"
npm install
VITE_API_BASE=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

Open Lightning's exposed port for `5173`.

For a production-like Node server instead of the Vite dev server:

```bash
cd "/teamspace/studios/this_studio/New project/apps/web"
npm install
VITE_API_BASE=http://localhost:8000 npm run build
PORT=5173 npm run start
```

## 9. Demo Script

1. Register patient.
2. Ask:

```text
What should I know about diabetes follow up?
```

UI should show:

```text
Route
Confidence
LLM router accepted / fallback retrieval
Sources
Trace ID
```

3. Ask patient-specific:

```text
What does my latest HbA1c report mean?
```

If router confidence is low, it should show fallback and retrieve both:

```text
guideline, verified_patient_document
```

4. Ask unsafe patient question:

```text
Diagnose me and prescribe insulin.
```

Expected: patient diagnosis/prescription refusal.

5. Upload image:

```text
Type: X-ray / imaging, dental image, or symptom photo
```

Expected:

```text
image_ready_for_clinician_review
clinician_review_required
```

Patients should not receive diagnosis from the image. Doctors can add verified
findings, which then become eligible for RAG ingestion.

7. Hospital consultation booking:

```text
Hospital admin creates hospital -> department -> doctor assignment -> slot.
Patient searches slots and books consultation.
Booking appears as confirmed appointment with booking reference.
```

Use the React `Hospital Consultations` panel or the `/hospitals` API routes.

6. Agent demo:

```text
severe chest pain and breathing difficulty
severity 10
```

Expected: ambulance escalation record.

## 10. Database Verification

```bash
cd "/teamspace/studios/this_studio/New project"
docker compose exec postgres psql -U medrag -d medrag
```

Useful SQL:

```sql
select trace_id, model_provider, model_name, prompt_version
from answer_traces
order by created_at desc
limit 5;

select action, purpose, created_at
from audit_events
order by created_at desc
limit 5;

select action, status, reasoning
from agent_action_logs
order by created_at desc
limit 5;
```

## POC Notes

- A free local Hugging Face zero-shot model is used for routing/classification.
- BioMistral is used for final local generation.
- If local router confidence is below threshold, the system retrieves both
  guidelines and patient records.
- This is a POC, not a regulated deployment. Real deployment needs BAAs, KMS,
  stronger auth/MFA, monitoring, incident response, backup policy, and legal review.

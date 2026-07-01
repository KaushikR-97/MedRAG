# Lightning GPU Fine-Tune And Full Services Deploy

This is the practical command sequence for Lightning AI.
For a single clean fresh-run checklist with expected time ranges, use
`docs/LIGHTNING_CLEAN_FRESH_RUN.md`.

## 0. Pull Latest Code

```bash
cd /teamspace/studios/this_studio
git clone https://github.com/KaushikR-97/MedRAG.git || true
cd MedRAG
git pull origin main
```

## 1. API Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL=postgresql+psycopg://medrag:medrag@localhost:5432/medrag
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
QDRANT_TIMEOUT_SECONDS=8
RAG_TOP_K=5
RAG_DENSE_MULTIPLIER=2
RAG_USE_RERANKER=false
S3_ENDPOINT_URL=http://localhost:9000
CLAMD_HOST=localhost
MODEL_PROVIDER=local_finetuned
BASE_MODEL_NAME=BioMistral/BioMistral-7B
FINETUNED_ADAPTER_PATH=./models/biomistral-medical
LOCAL_MODEL_DEVICE=auto
LOCAL_MODEL_LOAD_IN_4BIT=true
LOCAL_MODEL_MAX_MEMORY_JSON='{"0":"13GiB","cpu":"24GiB"}'
LOCAL_MODEL_MAX_NEW_TOKENS=1536
LOCAL_MODEL_MAX_INPUT_TOKENS=0
LOCAL_MODEL_CLEANUP_CUDA=true
EMBEDDING_DEVICE=cpu
EMBEDDING_BATCH_SIZE=4
RERANKER_DEVICE=cpu
IMAGE_EMBEDDING_DEVICE=cpu
QUERY_ROUTER_DEVICE=cpu
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
ALLOWED_ORIGIN_REGEX=https://.*\.cloudspaces\.litng\.ai
API_PUBLIC_BASE_URL=https://YOUR-8000-CLOUDSPACE-URL
PUBLIC_APP_BASE_URL=https://YOUR-5173-CLOUDSPACE-URL
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
GOOGLE_FIT_CLIENT_ID=
GOOGLE_FIT_CLIENT_SECRET=
```

Use a real 32+ character `JWT_SECRET` before pilot use.

`LOCAL_MODEL_MAX_NEW_TOKENS` controls how long the API answer can be. It was
previously effectively capped by code defaults. Keep `1536` for useful long
clinical answers on a 7B model. Increase only if the GPU has enough memory and
latency is acceptable.

`LOCAL_MODEL_MAX_INPUT_TOKENS=0` means the app computes the largest safe prompt
size from the model context window. If the prompt is too long for the model, the
latest tokens are kept so the request does not crash. No local 7B model can
accept unlimited text in a single request; for very long PDFs or chats, ingest
into RAG and ask against the indexed context.

Keep embeddings, reranking, and image embeddings on CPU for a single 14-16 GB
Lightning GPU. The local 7B model needs the GPU memory; background jobs such as
`prescription_rag_ingest` can otherwise fail with CUDA out-of-memory.

For large RAG collections, keep `RAG_TOP_K=5`, `RAG_DENSE_MULTIPLIER=2`, and
`RAG_USE_RERANKER=false` on a single T4. Qdrant does the first-stage vector and
payload-filter search; reranking every request is useful later, but it adds
latency and memory pressure. The app also creates Qdrant payload indexes for
patient, visibility, source type, document type, timeline, lab group, and
clinical date filters when the collection is initialized.

For a T4, treat the GPU as the LLM-only device:

- `MODEL_PROVIDER=local_finetuned` may use GPU.
- `EMBEDDING_DEVICE=cpu`, `RERANKER_DEVICE=cpu`, `IMAGE_EMBEDDING_DEVICE=cpu`, and `QUERY_ROUTER_DEVICE=cpu` should stay CPU.
- `LOCAL_MODEL_MAX_MEMORY_JSON='{"0":"13GiB","cpu":"24GiB"}'` leaves headroom for CUDA kernels and avoids loading the full model into all VRAM.
- `LOCAL_MODEL_CLEANUP_CUDA=true` clears transient generation cache after each API answer.
- Do not run LoRA training and the API server in the same Studio at the same time on a single T4.
- If RAG ingestion runs while the API is answering, it should still use CPU embeddings; expect slower ingestion but much lower OOM risk.

Fitness integrations:

- Fitbit and Google Fit need OAuth app credentials and redirect URLs pointing to the API public URL.
- Fitbit redirect: `https://YOUR-8000-CLOUDSPACE-URL/fitness/fitbit/callback`
- Google Fit redirect: `https://YOUR-8000-CLOUDSPACE-URL/fitness/google_fit/callback`
- Apple Health does not offer a normal server OAuth flow. Use an iOS HealthKit bridge or import Apple Health exported summaries into `/fitness/apple_health/import`.

## 2. Install API Dependencies

```bash
cd apps/api
python -m pip install -U pip
python -m pip install -e ".[dev,ocr,finetune]"
```

## 3. Start Infrastructure Services

Use Lightning terminals or Docker-compatible services:

```bash
postgres -D /tmp/postgres-data
redis-server --bind 0.0.0.0 --port 6379
qdrant --config-path ./qdrant-config.yaml
minio server /tmp/minio-data --console-address ":9001"
```

If using Docker:

```bash
docker compose up postgres redis qdrant minio clamav
```

## 4. Database Migrations

```bash
cd apps/api
alembic upgrade head
```

## 5. Load RAG Sources

Dry-run:

```bash
python training/ingest_rag_sources.py \
  --manifest training/rag_source_manifest.json \
  --dry-run
```

Write to Qdrant:

```bash
python training/ingest_rag_sources.py \
  --manifest training/rag_source_manifest.json
```

## 6. Build Fine-Tuning Dataset

You can train directly with the checked-in file:

```bash
python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/generated_medrag_sft.jsonl \
  --output-dir models/biomistral-medical \
  --epochs 3 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 512 \
  --lora-r 8 \
  --lora-alpha 16 \
  --target-modules q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj \
  --max-memory-json '{"0":"14GiB","cpu":"24GiB"}'
```

Or rebuild RAG-templated SFT examples first:

```bash
python training/build_sft_from_sources.py \
  --manifest training/rag_source_manifest.json \
  --output training/rag_templated_sft.jsonl \
  --max-chunks-per-source 20
```

Then train with:

```bash
python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/rag_templated_sft.jsonl \
  --output-dir models/biomistral-medical \
  --epochs 3 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 512
```

## 7. Smoke Test Adapter

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path models/biomistral-medical \
  --max-input-tokens 3000 \
  --max-new-tokens 1024 \
  --prompt "Doctor role: provide a safe medication decision checklist."
```

For a longer doctor-mode output test:

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path models/biomistral-medical \
  --max-input-tokens 2500 \
  --max-new-tokens 1536 \
  --prompt "Doctor role: for a stable adult with uncomplicated fever, provide medication options, contraindications, monitoring, and escalation criteria."
```

The adapter evaluator prints a warning if the prompt exceeds the model context
window. That is not a policy restriction; it is the model's finite context
length. Use higher-context base models later if you need very long single-prompt
reasoning.

## 8. Start API

Terminal 1:

```bash
cd apps/api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Terminal 2, worker:

```bash
cd apps/api
rq worker medrag --url redis://localhost:6379/0
```

## 9. Start Web

```bash
cd apps/web
npm install
VITE_API_BASE=https://YOUR-8000-CLOUDSPACE-URL npm run build
PORT=5173 npm run start
```

## 10. Verify All Services

From repo root:

```bash
python scripts/readiness_check.py --level demo
python scripts/demo_smoke.py --api-base https://YOUR-8000-CLOUDSPACE-URL
```

API:

```bash
curl https://YOUR-8000-CLOUDSPACE-URL/health
curl https://YOUR-8000-CLOUDSPACE-URL/ready
```

## 11. Clinical Quality Evaluation

First generate model predictions. Run this from repo root:

```bash
python apps/api/training/generate_quality_predictions.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --output apps/api/training/predictions.jsonl \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path apps/api/models/biomistral-medical \
  --max-input-tokens 2500 \
  --max-new-tokens 512 \
  --max-memory-json '{"0":"13GiB","cpu":"24GiB"}'
```

This script loads the base model and LoRA adapter once, then loops through all
cases. Do not call `evaluate_adapter.py` manually for each case; that reloads the
7B model every time and can turn a small 38-case evaluation into a very long
run.

For a quick smoke test before the full run:

```bash
python apps/api/training/generate_quality_predictions.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --output apps/api/training/predictions_smoke.jsonl \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path apps/api/models/biomistral-medical \
  --limit 5 \
  --max-input-tokens 2500 \
  --max-new-tokens 512 \
  --max-memory-json '{"0":"13GiB","cpu":"24GiB"}'
```

Then evaluate the generated JSONL:

```bash
python apps/api/training/evaluate_clinical_quality.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --predictions apps/api/training/predictions.jsonl \
  --min-pass-rate 0.90
```

## 12. Pilot Gate

```bash
cp docs/pilot_external_gates.example.json docs/pilot_external_gates.json
```

Set each gate to `true` only after approval/evidence:

```bash
python scripts/readiness_check.py \
  --level pilot \
  --external-gates-file docs/pilot_external_gates.json
```

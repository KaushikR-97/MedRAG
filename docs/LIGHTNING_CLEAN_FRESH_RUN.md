# Lightning AI Clean Fresh Run

This is the clean end-to-end runbook for a fresh Lightning AI GPU Studio or Job.
Use a T4/A10/A100 GPU if available. On a single T4, keep the GPU for the 7B LLM
and keep embeddings/reranking on CPU.

## Expected Time

| Step | T4 16 GB | A10 24 GB | A100 40/80 GB | Notes |
| --- | ---: | ---: | ---: | --- |
| Clone/pull repo | 1-3 min | 1-3 min | 1-3 min | Depends on GitHub/network |
| Python dependency install | 8-20 min | 8-20 min | 8-20 min | First run is slower because wheels/cache download |
| Web dependency install/build | 3-8 min | 3-8 min | 3-8 min | `npm install` dominates |
| Start infra + migrations | 3-10 min | 3-10 min | 3-10 min | Docker pulls can add 5-15 min on first run |
| India RAG manifest validation | <1 min | <1 min | <1 min | Local JSON validation |
| India RAG dry-run fetch/chunk | 2-8 min | 2-8 min | 2-8 min | Government portals may time out |
| India RAG write to Qdrant | 5-25 min | 4-20 min | 3-15 min | CPU embeddings are slower but safer on single GPU |
| Build RAG-templated SFT | 1-5 min | 1-5 min | 1-5 min | Depends on source size |
| LoRA training smoke, 1 epoch/small file | 20-60 min | 10-35 min | 5-20 min | Good first GPU sanity check |
| Full LoRA training, 3 epochs | 1.5-4 hr | 45-120 min | 20-60 min | Dataset/model/cache dependent |
| Adapter smoke prompt | 1-5 min | 1-4 min | 1-3 min | Includes model load |
| Generate 5 eval predictions | 5-20 min | 3-12 min | 2-8 min | One model load, then loop |
| Full clinical quality predictions | 30-120 min | 20-75 min | 10-40 min | Depends on case count and max tokens |
| Start API/worker/web | 3-10 min | 3-10 min | 3-10 min | First model request may add 1-5 min |

Budget a half day for the very first clean T4 run, mostly because dependency,
model, and source downloads are cold. After caches are warm, normal smoke runs
are usually under one hour, excluding full training.

## 1. Create Persistent Drive Folders

```bash
mkdir -p /teamspace/drive/medrag/{datasets,rag_sources,qdrant_snapshots,models,logs,eval_outputs,hf_cache}
```

Expected time: under 1 minute.

## 2. Clone Latest Code

```bash
cd /teamspace/studios/this_studio
git clone https://github.com/KaushikR-97/MedRAG.git || true
cd MedRAG
git pull origin main
```

Expected time: 1-3 minutes.

## 3. Configure API Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
ENVIRONMENT=local
JWT_SECRET=replace-with-a-long-random-secret-32-plus-chars
DATABASE_URL=postgresql+psycopg://medrag:medrag@localhost:5432/medrag
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
S3_ENDPOINT_URL=http://localhost:9000
CLAMD_HOST=localhost
MODEL_PROVIDER=local_finetuned
BASE_MODEL_NAME=BioMistral/BioMistral-7B
FINETUNED_ADAPTER_PATH=/teamspace/drive/medrag/models/biomistral-medical
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
```

Expected time: 3-8 minutes.

## 4. Install Dependencies

API:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
python -m pip install -U pip
python -m pip install -e ".[dev,ocr,finetune]"
```

Web:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/web
npm install
```

Expected time: 10-28 minutes on a cold machine; 3-10 minutes after caches warm.

## 5. Start Infrastructure

Preferred if Docker works in Studio:

```bash
cd /teamspace/studios/this_studio/MedRAG
docker compose up postgres redis qdrant minio clamav
```

Keep this terminal running. In a new terminal:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
alembic upgrade head
```

Expected time: 3-10 minutes if images exist; 10-25 minutes if Docker images must
download first.

## 6. Build And Validate India-First RAG Manifest

```bash
cd /teamspace/studios/this_studio/MedRAG
python scripts/build_indian_rag_manifest.py --validate-only
python scripts/build_indian_rag_manifest.py --include-p1
```

Expected time: under 1 minute.

## 7. Dry-Run RAG Source Fetch

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
python training/ingest_rag_sources.py \
  --manifest training/indian_rag_source_manifest.json \
  --dry-run \
  --continue-on-error
```

Expected time: 2-8 minutes. Some government portals can time out. If IDSP,
PM-JAY, or NIN direct content fails, manually download the exact PDF/page into
`apps/api/training/sources/`, add a `path` entry to the manifest, and rerun.

## 8. Ingest RAG Sources Into Qdrant

```bash
python training/ingest_rag_sources.py \
  --manifest training/indian_rag_source_manifest.json \
  --continue-on-error
```

Expected time: 5-25 minutes on a T4 with CPU embeddings for the initial broad
source set. Larger document-level PDF ingestion can take 30-90 minutes.

## 9. Build SFT Style Data

```bash
python training/build_sft_from_sources.py \
  --manifest training/indian_rag_source_manifest.json \
  --output training/indian_rag_templated_sft.jsonl \
  --max-chunks-per-source 20
```

Expected time: 1-5 minutes for the broad source manifest; longer if many PDFs are
added.

## 10. Run A Small Training Smoke Test First

Use this before spending hours on the full run:

```bash
export HF_HOME=/teamspace/drive/medrag/hf_cache

python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/indian_rag_templated_sft.jsonl \
  --output-dir /teamspace/drive/medrag/models/biomistral-medical-smoke \
  --epochs 1 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 256 \
  --lora-r 8 \
  --lora-alpha 16 \
  --target-modules q_proj,k_proj,v_proj,o_proj \
  --max-memory-json '{"0":"13GiB","cpu":"24GiB"}'
```

Expected time: 20-60 minutes on T4, 10-35 minutes on A10, 5-20 minutes on A100.

## 11. Run Full LoRA Training As A Lightning Job

Use a Lightning Job for the full run so it survives browser disconnects.

Working directory:

```text
/teamspace/studios/this_studio/MedRAG/apps/api
```

Command:

```bash
export HF_HOME=/teamspace/drive/medrag/hf_cache

python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/indian_rag_templated_sft.jsonl \
  --output-dir /teamspace/drive/medrag/models/biomistral-medical \
  --epochs 3 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 512 \
  --lora-r 8 \
  --lora-alpha 16 \
  --target-modules q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj \
  --max-memory-json '{"0":"13GiB","cpu":"24GiB"}' \
  2>&1 | tee /teamspace/drive/medrag/logs/train_lora.log
```

Expected time: 1.5-4 hours on T4, 45-120 minutes on A10, 20-60 minutes on A100.

## 12. Smoke Test Adapter

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path /teamspace/drive/medrag/models/biomistral-medical \
  --max-input-tokens 2500 \
  --max-new-tokens 1024 \
  --prompt "Doctor role: for a stable adult with uncomplicated fever, provide medication options, contraindications, monitoring, and escalation criteria."
```

Expected time: 1-5 minutes. The first run is slower because it loads the model.

## 13. Run Clinical Quality Evaluation

Quick 5-case smoke:

```bash
cd /teamspace/studios/this_studio/MedRAG
python apps/api/training/generate_quality_predictions.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --output /teamspace/drive/medrag/eval_outputs/predictions_smoke.jsonl \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path /teamspace/drive/medrag/models/biomistral-medical \
  --limit 5 \
  --max-input-tokens 2500 \
  --max-new-tokens 512 \
  --max-memory-json '{"0":"13GiB","cpu":"24GiB"}'
```

Expected time: 5-20 minutes on T4.

Full eval:

```bash
python apps/api/training/generate_quality_predictions.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --output /teamspace/drive/medrag/eval_outputs/predictions.jsonl \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path /teamspace/drive/medrag/models/biomistral-medical \
  --max-input-tokens 2500 \
  --max-new-tokens 512 \
  --max-memory-json '{"0":"13GiB","cpu":"24GiB"}'

python apps/api/training/evaluate_clinical_quality.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --predictions /teamspace/drive/medrag/eval_outputs/predictions.jsonl \
  --min-pass-rate 0.90
```

Expected time: 30-120 minutes on T4, 20-75 minutes on A10, 10-40 minutes on A100.

## 14. Start API, Worker, And Web

API terminal:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Worker terminal:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
rq worker medrag --url redis://localhost:6379/0
```

Web terminal:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/web
VITE_API_BASE=https://YOUR-8000-CLOUDSPACE-URL npm run build
PORT=5173 npm run start
```

Expected time: 3-10 minutes. The first clinical AI request can take another
1-5 minutes while the model loads.

## 15. Final Smoke Checks

```bash
cd /teamspace/studios/this_studio/MedRAG
python scripts/readiness_check.py --level demo
python scripts/demo_smoke.py --api-base https://YOUR-8000-CLOUDSPACE-URL
curl https://YOUR-8000-CLOUDSPACE-URL/health
curl https://YOUR-8000-CLOUDSPACE-URL/ready
```

Expected time: 3-10 minutes.

## Practical Timing Plan

First clean T4 run:

```text
Setup/install/infra: 30-60 min
RAG validation + ingestion: 10-35 min
SFT build: 1-5 min
Training smoke: 20-60 min
Full LoRA: 1.5-4 hr
Eval smoke/full eval: 35-140 min
Serve + smoke checks: 10-25 min
```

After caches and source downloads are warm:

```text
RAG/SFT/serve smoke path: 30-75 min
Full train + eval path: 2.5-6 hr on T4
```

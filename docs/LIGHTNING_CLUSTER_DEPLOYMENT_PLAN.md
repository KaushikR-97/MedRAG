# Lightning AI Cluster Deployment Plan

Use this after investor-demo smoke tests pass and before a closed clinical pilot.

## 1. Fresh Pull And Environment

```bash
cd /teamspace/studios/this_studio
git clone https://github.com/KaushikR-97/MedRAG.git || true
cd MedRAG
git pull origin main
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
ENVIRONMENT=local
DATABASE_URL=postgresql+psycopg://medrag:medrag@localhost:5432/medrag
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
S3_ENDPOINT_URL=http://localhost:9000
CLAMD_HOST=localhost
MODEL_PROVIDER=local_finetuned
BASE_MODEL_NAME=BioMistral/BioMistral-7B
FINETUNED_ADAPTER_PATH=./models/biomistral-medical
LOCAL_MODEL_DEVICE=auto
LOCAL_MODEL_LOAD_IN_4BIT=true
ALLOWED_ORIGIN_REGEX=https://.*\.cloudspaces\.litng\.ai
```

Use a fresh `JWT_SECRET` before any real pilot.

## 2. Start Services

Start Postgres, Redis, Qdrant, MinIO, and ClamAV using your Lightning service
commands or Docker if available. Then:

```bash
cd apps/api
python -m pip install -U pip
python -m pip install -e ".[dev,ocr,finetune]"
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Worker terminal:

```bash
cd apps/api
rq worker medrag --url redis://localhost:6379/0
```

Web terminal:

```bash
cd apps/web
npm install
VITE_API_BASE=https://YOUR-8000-CLOUDSPACE-URL npm run build
PORT=5173 npm run start
```

## 3. Readiness And Smoke

From repo root:

```bash
python scripts/readiness_check.py --level demo
python scripts/demo_smoke.py --api-base https://YOUR-8000-CLOUDSPACE-URL
```

API checks:

```bash
curl https://YOUR-8000-CLOUDSPACE-URL/health
curl https://YOUR-8000-CLOUDSPACE-URL/ready
```

## 4. Load Approved Indian RAG Sources

Dry-run first:

```bash
cd apps/api
python training/ingest_rag_sources.py --manifest training/rag_source_manifest.json --dry-run
```

Then write to Qdrant:

```bash
python training/ingest_rag_sources.py --manifest training/rag_source_manifest.json
```

For additional real Indian data, add approved files under `apps/api/training/sources/`
and add entries to `training/rag_source_manifest.json` with publisher, URL,
publication date, and license status.

## 5. Build SFT And Fine-Tune

```bash
cd apps/api
python training/build_sft_from_sources.py \
  --manifest training/rag_source_manifest.json \
  --output training/generated_medrag_sft.jsonl \
  --max-chunks-per-source 20

export HF_HOME=/teamspace/studios/this_studio/hf_cache
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
  --target-modules q_proj,v_proj \
  --max-memory-json '{"0":"14GiB","cpu":"24GiB"}'
```

Smoke-test adapter:

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path models/biomistral-medical \
  --prompt "Doctor role: provide a safe prescribing checklist for an outpatient condition."
```

## 6. Clinical Evaluation

Generate predictions for `training/clinical_quality_cases.jsonl`, then:

```bash
python training/evaluate_clinical_quality.py \
  --cases training/clinical_quality_cases.jsonl \
  --predictions training/predictions.jsonl \
  --min-pass-rate 0.90
```

For a closed pilot, expand to at least 200 clinician-reviewed cases.

## 7. Pilot Gate

Copy the gate template:

```bash
cp docs/pilot_external_gates.example.json docs/pilot_external_gates.json
```

Set gates to `true` only after the responsible doctor/legal/ops owner approves.

```bash
python scripts/readiness_check.py \
  --level pilot \
  --external-gates-file docs/pilot_external_gates.json
```

Closed clinical testing should not begin until this returns all checks passed.

## 8. Commercial Launch Path

After doctors approve pilot outcomes:
- Replace demo secrets and MinIO credentials.
- Use managed Postgres/Redis/Qdrant/object storage with backups.
- Configure dedicated TURN/SFU or managed video provider.
- Enable monitoring, alerting, error tracking, audit retention, and backup restore.
- Complete privacy/legal/regulatory review for the exact launch positioning.
- Run the 200+ case clinical eval and preserve reviewer sign-off evidence.

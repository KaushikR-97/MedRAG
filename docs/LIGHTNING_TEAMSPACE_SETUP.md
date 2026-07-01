# Lightning Teamspace Setup For MedRAG India

For a clean first run on a new Lightning AI GPU Studio or Job, including expected
time ranges for each step, start with `docs/LIGHTNING_CLEAN_FRESH_RUN.md`.

This guide uses the Lightning AI Teamspace areas cleanly:

- Studios: interactive setup/debug
- Drive: persistent datasets, logs, adapters, snapshots
- Jobs: long fine-tuning and evaluation runs
- Deployments: serving API/web after smoke tests pass
- Weights: registered LoRA adapter/model artifacts
- Containers: reproducible training/API images later
- Experiments: run metrics, eval pass rates, model comparisons
- Pipelines: later automation of ingest -> train -> eval -> deploy

## 1. Teamspace Folder Layout

Create persistent folders in Drive:

```bash
mkdir -p /teamspace/drive/medrag/{datasets,rag_sources,qdrant_snapshots,models,logs,eval_outputs,hf_cache}
```

Recommended layout:

```text
/teamspace/drive/medrag/
  datasets/
  rag_sources/
  qdrant_snapshots/
  models/
    biomistral-medical/
  logs/
  eval_outputs/
  hf_cache/
```

Keep these in Drive because Studio local storage can be reset or recreated.

## 2. Studio Setup

Use Studio for setup, debugging, short smoke tests, and manual UI checks.

```bash
cd /teamspace/studios/this_studio
git clone https://github.com/KaushikR-97/MedRAG.git || true
cd MedRAG
git pull origin main
```

Create API env:

```bash
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
FINETUNED_ADAPTER_PATH=/teamspace/drive/medrag/models/biomistral-medical
LOCAL_MODEL_DEVICE=auto
LOCAL_MODEL_LOAD_IN_4BIT=true
ALLOWED_ORIGIN_REGEX=https://.*\.cloudspaces\.litng\.ai
```

Set a real `JWT_SECRET` before any clinical pilot:

```env
JWT_SECRET=replace-with-a-long-random-secret-32-plus-chars
```

Install dependencies:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
python -m pip install -U pip
python -m pip install -e ".[dev,ocr,finetune]"
```

For web:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/web
npm install
```

## 3. Start Core Services

Use Studio terminals or Lightning services. Required:

- Postgres
- Redis
- Qdrant
- MinIO or S3-compatible object storage
- ClamAV, optional for demo if `MALWARE_SCAN_FAIL_OPEN=true`

If Docker is available:

```bash
cd /teamspace/studios/this_studio/MedRAG
docker compose up postgres redis qdrant minio clamav
```

Run migrations:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
alembic upgrade head
```

## 4. Load RAG Sources

Dry-run:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
python training/ingest_rag_sources.py \
  --manifest training/rag_source_manifest.json \
  --dry-run
```

Write chunks to Qdrant:

```bash
python training/ingest_rag_sources.py \
  --manifest training/rag_source_manifest.json
```

Put additional approved Indian medical source files in:

```text
apps/api/training/sources/
```

Then add them to:

```text
apps/api/training/rag_source_manifest.json
```

Each source entry should include publisher, URL, publication date, license status,
and file path.

## 5. Build SFT Dataset

Option A: use checked-in SFT file:

```text
apps/api/training/generated_medrag_sft.jsonl
```

Option B: rebuild RAG-templated SFT:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
python training/build_sft_from_sources.py \
  --manifest training/rag_source_manifest.json \
  --output training/rag_templated_sft.jsonl \
  --max-chunks-per-source 20
```

## 6. Use Jobs For Fine-Tuning

Do not run long fine-tuning only in a Studio terminal. Use a Lightning Job so it
survives Studio sleep and browser disconnects.

Job working directory:

```text
/teamspace/studios/this_studio/MedRAG/apps/api
```

Job command:

```bash
export HF_HOME=/teamspace/drive/medrag/hf_cache

python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/generated_medrag_sft.jsonl \
  --output-dir /teamspace/drive/medrag/models/biomistral-medical \
  --epochs 3 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 512 \
  --lora-r 8 \
  --lora-alpha 16 \
  --target-modules q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj \
  --max-memory-json '{"0":"14GiB","cpu":"24GiB"}' \
  2>&1 | tee /teamspace/drive/medrag/logs/train_lora.log
```

For smaller GPUs:

```bash
--max-length 256 --max-memory-json '{"0":"10GiB","cpu":"32GiB"}'
```

Expected output:

```text
/teamspace/drive/medrag/models/biomistral-medical/
  adapter_config.json
  adapter_model.safetensors
  tokenizer_config.json
```

If you still need to run a long manual command in Studio, use `tmux` and write
logs into Drive:

```bash
tmux new -s medrag
# run the command
# detach with Ctrl+b, then d
tmux attach -t medrag
```

Jobs are still preferred for fine-tuning, evaluation, and long ingestion.

## 7. Register Weights

After the Job finishes, register this folder as a Lightning Weight artifact:

```text
/teamspace/drive/medrag/models/biomistral-medical
```

Use name:

```text
medrag-biomistral-lora
```

Use this path in API `.env`:

```env
FINETUNED_ADAPTER_PATH=/teamspace/drive/medrag/models/biomistral-medical
```

## 8. Containers

Use Containers after the manual Studio flow is stable. Do not bake secrets or
patient data into images.

Recommended containers:

- API container: built from the API service image/Dockerfile.
- Worker container: same image as API, different command.
- Training container: API image plus GPU fine-tuning dependencies.

Suggested tags:

```text
medrag-api:demo
medrag-worker:demo
medrag-train:gpu
```

Runtime data should stay outside containers:

```text
/teamspace/drive/medrag/models/
/teamspace/drive/medrag/hf_cache/
/teamspace/drive/medrag/logs/
/teamspace/drive/medrag/eval_outputs/
```

## 9. Smoke Test Adapter

In Studio:

```bash
cd /teamspace/studios/this_studio/MedRAG/apps/api
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path /teamspace/drive/medrag/models/biomistral-medical \
  --prompt "Doctor role: provide a safe medication decision checklist."
```

For long prompts, the evaluator keeps the latest text that fits the model
context window and prints a warning if truncation is needed. You can override
the input token budget:

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path /teamspace/drive/medrag/models/biomistral-medical \
  --max-input-tokens 3500 \
  --max-new-tokens 384 \
  --prompt "Doctor role: paste a long clinical question or report summary here."
```

## 10. Run API And Worker In Studio

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

## 11. Readiness And Smoke Tests

From repo root:

```bash
cd /teamspace/studios/this_studio/MedRAG
python scripts/readiness_check.py --level demo
python scripts/demo_smoke.py --api-base https://YOUR-8000-CLOUDSPACE-URL
```

API checks:

```bash
curl https://YOUR-8000-CLOUDSPACE-URL/health
curl https://YOUR-8000-CLOUDSPACE-URL/ready
```

## 12. Evaluation

Generate model predictions into:

```text
apps/api/training/predictions.jsonl
```

Then run:

```bash
python apps/api/training/evaluate_clinical_quality.py \
  --cases apps/api/training/clinical_quality_cases.jsonl \
  --predictions apps/api/training/predictions.jsonl \
  --min-pass-rate 0.90
```

Save outputs:

```bash
cp apps/api/training/predictions.jsonl /teamspace/drive/medrag/eval_outputs/
```

## 13. Deployments

Use Deployments after Studio smoke tests pass.

Recommended deployments:

1. API deployment
   - Command:
     ```bash
     cd apps/api && uvicorn app.main:app --host 0.0.0.0 --port 8000
     ```
   - Mount or reference Drive path for model adapter.

2. Worker deployment
   - Command:
     ```bash
     cd apps/api && rq worker medrag --url redis://localhost:6379/0
     ```

3. Web deployment
   - Command:
     ```bash
     cd apps/web && npm install && npm run build && PORT=5173 npm run start
     ```
   - Set:
     ```env
     VITE_API_BASE=https://YOUR-API-DEPLOYMENT-URL
     ```

Deploy only after:

```bash
python scripts/readiness_check.py --level demo
python scripts/demo_smoke.py --api-base <api-url>
```

## 14. Experiments

Use Experiments to track:

- Dataset version
- RAG manifest version
- SFT file used
- Base model
- LoRA target modules
- Epochs
- Eval pass rate
- Urgent escalation pass rate
- Patient-prescribing violation count
- Doctor reviewer score

Suggested experiment name:

```text
medrag-biomistral-lora-v1
```

## 15. Pipelines Later

Create a pipeline after manual flow works:

```text
Validate source manifest
-> Ingest RAG sources
-> Build SFT JSONL
-> Fine-tune LoRA as Job
-> Evaluate clinical quality
-> Register Weight
-> Deploy API/worker/web
-> Run smoke tests
```

## 16. Closed Pilot Gate

Copy gate template:

```bash
cp docs/pilot_external_gates.example.json docs/pilot_external_gates.json
```

Set each gate to `true` only after evidence/sign-off.

```bash
python scripts/readiness_check.py \
  --level pilot \
  --external-gates-file docs/pilot_external_gates.json
```

Closed clinical testing should start only after this passes.

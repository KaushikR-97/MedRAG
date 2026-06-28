# Build The Local MedRAG LLM On One Lightning GPU

This reproduces the useful part of the original shell script: fine-tune
`BioMistral/BioMistral-7B` with 4-bit QLoRA and load the saved adapter inside
the API with `MODEL_PROVIDER=local_finetuned`.

## 1. Use Lightning's Default Environment

Lightning Studio does not allow creating a second venv. Use the default conda
environment:

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
python -m pip install -U pip
python -m pip install -e ".[dev,finetune]"
```

## 2. Verify GPU

```bash
nvidia-smi
python - <<'PY'
import torch
print("CUDA:", torch.cuda.is_available())
print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none")
PY
```

## 3. Train The BioMistral Adapter

For the checked-in starter SFT data:

```bash
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

To rebuild SFT style examples from the approved RAG source manifest:

```bash
python training/build_sft_from_sources.py \
  --manifest training/rag_source_manifest.json \
  --output training/generated_medrag_sft.jsonl \
  --max-chunks-per-source 20
```

To ingest approved guideline/reference sources into Qdrant:

```bash
python training/ingest_rag_sources.py \
  --manifest training/rag_source_manifest.json
```

Use `--dry-run` first to confirm chunk counts without writing to Qdrant.

If the GPU has less memory, reduce `--max-length 256` and use:

```bash
--max-memory-json '{"0":"10GiB","cpu":"32GiB"}'
```

## 4. Check Adapter Files

```bash
ls -lh models/biomistral-medical
```

You should see files like:

```text
adapter_config.json
adapter_model.safetensors
tokenizer.json
tokenizer_config.json
```

## 5. Smoke Test The Adapter

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path models/biomistral-medical \
  --prompt "Explain diabetes follow-up safely for a patient in India."
```

## 6. Enable Local LLM In The API

Edit `apps/api/.env`:

```env
MODEL_PROVIDER=local_finetuned
BASE_MODEL_NAME=BioMistral/BioMistral-7B
FINETUNED_ADAPTER_PATH=./models/biomistral-medical
LOCAL_MODEL_DEVICE=auto
LOCAL_MODEL_LOAD_IN_4BIT=true
```

Keep database service URLs as `localhost` when running directly in Lightning:

```env
DATABASE_URL=postgresql+psycopg://medrag:medrag@localhost:5432/medrag
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
S3_ENDPOINT_URL=http://localhost:9000
CLAMAV_HOST=localhost
```

## 7. Run API With Local Model

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

First request may be slow because the model and adapter are loaded.

## 8. Verify Through RAG Endpoint

```bash
TOKEN="paste-patient-token"
curl -X POST http://localhost:8000/clinical/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What should I know about diabetes follow up?"}'
```

The response should include a `trace_id`. The trace records the effective model
as:

```text
BioMistral/BioMistral-7B+./models/biomistral-medical
```

## 9. Evaluate Quality Gates

Save model predictions as JSONL with `id` and `answer`, then run:

```bash
python training/evaluate_clinical_quality.py \
  --cases training/clinical_quality_cases.jsonl \
  --predictions training/predictions.jsonl \
  --min-pass-rate 0.90
```

Run launch readiness checks from the repo root:

```bash
python scripts/readiness_check.py --level demo
python scripts/readiness_check.py --level pilot
```

The pilot check intentionally fails manual gates until legal/privacy review,
clinical governance sign-off, monitoring, backup/restore, dedicated video
infrastructure, and licensed corpus loading are completed.

## Important Safety Rule

Fine-tuning teaches style and task behavior. It does not replace RAG. The API
still retrieves verified context, applies patient/doctor safety policy, and logs
the prompt version, model, sources, answer, and audit event.

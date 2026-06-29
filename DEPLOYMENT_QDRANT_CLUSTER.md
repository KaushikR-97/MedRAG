# MedRAG India Lightning AI GPU Deployment Guide

This guide deploys MedRAG India on a single Lightning AI GPU Studio.

The clean setup is:

- Run GPU workloads natively in the Studio terminal: FastAPI, RQ worker, local HuggingFace models, OCR, and image embeddings.
- Run support services in Docker: Postgres, Redis, MinIO, and ClamAV.
- Use Qdrant Cloud or an external Qdrant server for vector search.
- Do not run the API or worker from the Docker Compose image for GPU deployment. The current API container is a slim CPU-oriented image and does not install the full GPU/OCR dependency set.

## 1. Target Architecture

```text
Lightning AI GPU Studio

  React/Vite web app       native process, port 5173
        |
        v
  FastAPI backend          native process, port 8000, CUDA enabled
        |
        +--> Postgres      Docker, localhost:5432
        +--> Redis         Docker, localhost:6379
        +--> MinIO         Docker, localhost:9000 and 9001
        +--> ClamAV        Docker, localhost:3310
        +--> Qdrant        remote Qdrant Cloud or external server

  RQ worker                native process, CUDA enabled
        |
        +--> Redis queue
        +--> OCR, malware scan, embeddings, Qdrant upserts
```

## 2. Qdrant Setup

Use Qdrant Cloud for the simplest deployment.

Create a Qdrant cluster and save:

- Cluster endpoint URL, for example `https://your-cluster.qdrant.io`
- API key

MedRAG uses two Qdrant collections:

- `medical_guidelines` for text RAG embeddings from `BAAI/bge-m3`
- `medical_image_embeddings` for BioMedCLIP image vectors

The code creates the collections automatically with the actual embedding vector size and cosine distance. You do not need to pre-create them.

If you self-host Qdrant on another VM, run it with persistent storage and an API key:

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v qdrant_storage:/qdrant/storage \
  -e QDRANT__SERVICE__API_KEY="replace-with-a-secure-key" \
  qdrant/qdrant:v1.11.0
```

Use `https://...` for Qdrant Cloud. Use `http://<host>:6333` only for a trusted private self-hosted instance.

## 3. Prepare Lightning Studio

Open a GPU Studio, preferably L4, A10G, or better. T4 can work for a proof of concept, but use 4-bit model loading and expect tighter VRAM limits.

From the Studio terminal:

```bash
cd "/teamspace/studios/this_studio/New project"
nvidia-smi
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no gpu')"
```

Set persistent HuggingFace cache paths so large models do not repeatedly download into the wrong location:

```bash
export HF_HOME="/teamspace/studios/this_studio/hf_cache"
export HF_HUB_CACHE="/teamspace/studios/this_studio/hf_cache/hub"
mkdir -p "$HF_HUB_CACHE"
```

Add the same exports to your shell startup file if you want them to persist across terminals.

## 4. Configure API Environment

Create the API environment file:

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
cp .env.example .env
```

Edit `.env` and set the important deployment values:

```env
ENVIRONMENT="staging"

DATABASE_URL="postgresql+psycopg://medrag:medrag@localhost:5432/medrag"
REDIS_URL="redis://localhost:6379/0"

QDRANT_URL="https://your-qdrant-cluster-url"
QDRANT_API_KEY="your-qdrant-api-key"
QDRANT_COLLECTION="medical_guidelines"
QDRANT_IMAGE_COLLECTION="medical_image_embeddings"

S3_ENDPOINT_URL="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="medrag-documents"

CLAMD_HOST="localhost"
CLAMD_PORT=3310

MODEL_PROVIDER="local_hf"
BASE_MODEL_NAME="BioMistral/BioMistral-7B"
FINETUNED_ADAPTER_PATH=""
LOCAL_MODEL_DEVICE="auto"
LOCAL_MODEL_LOAD_IN_4BIT="true"

EMBEDDING_MODEL="BAAI/bge-m3"
EMBEDDING_DEVICE="cpu"
EMBEDDING_BATCH_SIZE="4"
RERANKER_DEVICE="cpu"
IMAGE_EMBEDDING_MODEL="microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224"
IMAGE_EMBEDDING_DEVICE="cpu"

QUERY_ROUTER_PROVIDER="local_zero_shot"
QUERY_ROUTER_MODEL="MoritzLaurer/deberta-v3-base-zeroshot-v2.0"
QUERY_ROUTER_DEVICE="cpu"
QUERY_ROUTER_CONFIDENCE_THRESHOLD="0.92"

JWT_SECRET="replace-with-a-long-random-secret"
ALLOWED_ORIGIN_REGEX="https://.*\.cloudspaces\.litng\.ai"
```

Use `ENVIRONMENT="staging"` or another non-local value if you want the RQ worker to process jobs. With `ENVIRONMENT="local"`, the API runs background jobs inline and the separate RQ worker is bypassed.

For production, replace the MinIO defaults and all demo secrets.

## 5. Start Support Services

From the repo root, start only the services needed by the native GPU processes:

```bash
cd "/teamspace/studios/this_studio/New project"
docker compose up -d postgres redis minio clamav
```

If a previous full Compose stack is running, stop the containerized app services:

```bash
docker compose stop api worker web
```

Check service health:

```bash
docker compose ps
docker compose exec postgres pg_isready -U medrag -d medrag
docker compose logs --tail=80 clamav
```

ClamAV can take a few minutes to become ready on first startup.

## 6. Install Python Dependencies

Use the Studio Python environment or create your own virtual environment. Then install the API package with GPU/OCR extras:

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
python -m pip install -U pip
python -m pip install -e ".[dev,finetune,ocr]"
python -m pip install -U bitsandbytes accelerate
```

If PyTorch cannot see CUDA after installation, reinstall the correct CUDA-enabled PyTorch build for the Studio image before continuing.

## 7. Run Database Migrations

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"
export PYTHONPATH="."
alembic upgrade head
```

The API settings load `.env`, so keep the `.env` file in `apps/api`.

## 8. Start the Backend

Open Terminal 1:

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"

export PYTHONPATH="."
export CUDA_HOME="/usr/local/cuda"
export LD_LIBRARY_PATH="/usr/local/cuda/lib64:$LD_LIBRARY_PATH"
export HF_HOME="/teamspace/studios/this_studio/hf_cache"
export HF_HUB_CACHE="/teamspace/studios/this_studio/hf_cache/hub"
export PYTHONUNBUFFERED=1

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The first clinical/model request may be slow because HuggingFace models must download and initialize.

## 9. Start the Worker

Open Terminal 2:

```bash
cd "/teamspace/studios/this_studio/New project/apps/api"

export PYTHONPATH="."
export CUDA_HOME="/usr/local/cuda"
export LD_LIBRARY_PATH="/usr/local/cuda/lib64:$LD_LIBRARY_PATH"
export HF_HOME="/teamspace/studios/this_studio/hf_cache"
export HF_HUB_CACHE="/teamspace/studios/this_studio/hf_cache/hub"
export PYTHONUNBUFFERED=1

rq worker medrag --url redis://localhost:6379/0
```

On a T4 GPU, avoid running multiple heavy GPU tasks at the same time. BioMistral, BioMedCLIP, OCR, and embedding models can compete for VRAM.

## 10. Start the Web App

Open Terminal 3:

```bash
cd "/teamspace/studios/this_studio/New project/apps/web"
pnpm install --frozen-lockfile
```

Find the public URL Lightning assigns to port `8000` in the Studio ports/exposed apps UI. Use that as `VITE_API_BASE`.

Example:

```bash
VITE_API_BASE="https://8000-your-studio.cloudspaces.litng.ai" pnpm run dev -- --host 0.0.0.0 --port 5173
```

Then open the public URL Lightning assigns to port `5173`.

The exact public URL format can vary by Lightning workspace/studio configuration, so trust the Studio ports UI over a hardcoded hostname pattern.

## 11. Smoke Test

Check the API:

```bash
curl http://localhost:8000/health
```

Open the web app and verify:

- Sign in works.
- Patient dashboard loads.
- Doctor workspace loads.
- Uploading a document creates a background job.
- Worker logs show OCR/indexing activity.
- Qdrant dashboard shows the text and image collections after the first successful upload.
- Clinical AI responses include retrieved context or source metadata when documents are available.

Check Redis queue status if jobs do not run:

```bash
redis-cli -u redis://localhost:6379/0 llen rq:queue:medrag
```

Check backend logs and worker logs first if the UI looks idle.

## 12. Production Hardening Checklist

Before using this beyond a demo:

- Replace all demo secrets.
- Use strong MinIO credentials.
- Do not expose the MinIO console publicly unless it is protected.
- Use HTTPS Qdrant endpoints and API keys.
- Confirm CORS matches only your Lightning/public app origins.
- Use a larger GPU or split API and worker across machines for stable concurrent model workloads.
- Pin dependency versions once the Studio environment is working.
- Run database backups and Qdrant backups/snapshots.
- Store `.env` as a secret, not in git.

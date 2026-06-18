# Fine-Tuning Track

This folder adds supervised LoRA/QLoRA fine-tuning on top of the RAG architecture.
For the first POC you can skip fine-tuning and run `BioMistral/BioMistral-7B`
directly from Hugging Face with `MODEL_PROVIDER=local_hf`.

The intended production strategy is **fine-tuned model + RAG**, not fine-tuned model alone:

```text
Question
-> safety check
-> retrieve verified guideline/patient context
-> prompt BioMistral from Hugging Face, optionally with a fine-tuned adapter
-> answer with citations and trace
```

Fine-tuning teaches the model response style, Indian clinical terminology, structured SOAP/Rx behavior,
and safe refusal patterns. RAG supplies up-to-date, auditable facts.

## Dataset Format

Use JSONL with one training example per line:

```json
{"instruction":"Explain HbA1c follow-up for a diabetic patient in India.","context":"ICMR diabetes guideline excerpt...","response":"HbA1c is usually checked every 3 months... [source]"}
```

Do not fine-tune on raw PHI. De-identify patient data and keep source licensing documented.

## Train

```bash
cd apps/api
pip install -e ".[finetune]"
python training/train_lora.py \
  --base-model BioMistral/BioMistral-7B \
  --train-file training/sample_medrag_sft.jsonl \
  --output-dir models/biomistral-medical \
  --epochs 3 \
  --max-length 512 \
  --lora-r 8 \
  --lora-alpha 16 \
  --target-modules q_proj,v_proj
```

Then set:

```env
MODEL_PROVIDER="local_hf"
BASE_MODEL_NAME="BioMistral/BioMistral-7B"
FINETUNED_ADAPTER_PATH="./models/biomistral-medical"
LOCAL_MODEL_LOAD_IN_4BIT="true"
```

## Verify Adapter

```bash
python training/evaluate_adapter.py \
  --base-model BioMistral/BioMistral-7B \
  --adapter-path models/biomistral-medical \
  --prompt "Explain diabetes follow-up safely for a patient in India."
```

For a small Lightning GPU, keep `--batch-size 1`, `--grad-accum 8`, and short
`--max-length` values. The shell script used 256 tokens; this repo defaults to
512 for slightly better instruction examples.

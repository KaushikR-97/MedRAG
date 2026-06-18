from functools import lru_cache

from app.core.config import settings

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
except Exception:  # pragma: no cover - optional unless local inference is enabled
    AutoModelForCausalLM = None
    AutoTokenizer = None
    BitsAndBytesConfig = None
    torch = None

try:
    from peft import PeftModel
except Exception:  # pragma: no cover - only needed when adapter path is configured
    PeftModel = None


class LocalHuggingFaceModel:
    """Loads BioMistral directly from Hugging Face, with optional LoRA adapter.

    For the POC, set `MODEL_PROVIDER=local_hf` and leave
    `FINETUNED_ADAPTER_PATH` empty. Later, after QLoRA fine-tuning, set the
    adapter path and the same service will attach the PEFT adapter.
    """

    def __init__(self) -> None:
        if AutoTokenizer is None or AutoModelForCausalLM is None or torch is None:
            raise RuntimeError("Install local model dependencies with: pip install -e '.[finetune]'")

        self.tokenizer = AutoTokenizer.from_pretrained(settings.base_model_name, use_fast=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        quantization_config = None
        if settings.local_model_load_in_4bit and BitsAndBytesConfig is not None:
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
            )

        model = AutoModelForCausalLM.from_pretrained(
            settings.base_model_name,
            device_map=settings.local_model_device,
            quantization_config=quantization_config,
            torch_dtype=torch.float16,
        )
        self.adapter_path = settings.finetuned_adapter_path.strip()
        if self.adapter_path:
            if PeftModel is None:
                raise RuntimeError("Install PEFT dependencies with: pip install -e '.[finetune]'")
            model = PeftModel.from_pretrained(model, self.adapter_path)
        self.model = model
        self.model.eval()

    @property
    def effective_model_name(self) -> str:
        if self.adapter_path:
            return f"{settings.base_model_name}+{self.adapter_path}"
        return settings.base_model_name

    def generate(self, prompt: str, *, max_new_tokens: int = 512) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        with torch.no_grad():
            output = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=0.1,
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        decoded = self.tokenizer.decode(output[0], skip_special_tokens=True)
        return decoded[len(prompt) :].strip() if decoded.startswith(prompt) else decoded


@lru_cache
def get_local_huggingface_model() -> LocalHuggingFaceModel:
    return LocalHuggingFaceModel()


get_local_finetuned_model = get_local_huggingface_model

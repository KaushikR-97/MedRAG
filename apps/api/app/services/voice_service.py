class VoiceService:
    def transcribe(self, file_path: str, *, language: str = "en") -> str:
        try:
            import whisper
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("Install fine-tune extras with Whisper support to enable voice input") from exc
        model = whisper.load_model("base")
        result = model.transcribe(file_path, language=language)
        return str(result.get("text", "")).strip()


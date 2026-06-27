from app.rag.retriever import RetrievedChunk
from app.core.config import settings
from app.services.local_model_service import get_local_huggingface_model

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover - optional at import time for lightweight tooling
    ChatOpenAI = None
    ChatPromptTemplate = None


PROMPT_VERSION = "clinical-rag-v1"


class ClinicalGenerationService:
    """Generation boundary for source-grounded answers.

    Production deployments can swap this for a LangChain ChatModel chain using
    ChatPromptTemplate, structured output, and a model approved for the deployment
    environment. The graph depends on this boundary instead of directly depending
    on any one model vendor.
    """

    def generate(
        self,
        *,
        question: str,
        user_role: str,
        conversation_history: list[dict[str, str]],
        sources: list[RetrievedChunk],
        disclaimer: str | None,
        policy_instruction: str = "",
        policy_mode: str = "",
    ) -> str:
        source_text = "\n".join(f"- [{source.id}] {source.title}: {source.text}" for source in sources)
        history_text = self._format_conversation_history(conversation_history)
        if settings.model_provider in {"local_hf", "local_finetuned"}:
            prompt = self._build_prompt(
                question=question,
                user_role=user_role,
                history_text=history_text,
                source_text=source_text,
                disclaimer=disclaimer,
                policy_instruction=policy_instruction,
                policy_mode=policy_mode,
            )
            return get_local_huggingface_model().generate(prompt)

        if settings.openai_api_key and ChatOpenAI is not None and ChatPromptTemplate is not None:
            prompt = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "You are MedRAG India, a source-grounded clinical assistant. "
                        "Use only the supplied context. Do not diagnose. State uncertainty. "
                        "For emergency symptoms, tell the user to seek urgent care. "
                        "Use conversation history only to understand follow-up questions; "
                        "do not treat earlier assistant answers as clinical evidence. "
                        "Follow this role policy strictly: {policy_instruction}. "
                        "If the user asks about their personal or demographic details (like name, blood group, allergies, medications, or chronic conditions) and the information is in the context, you must answer directly using it. Stating facts from the retrieved profile is not a diagnosis. "
                        "Cite source ids inline like [source-id]. Prompt version: {prompt_version}.",
                    ),
                    (
                        "human",
                        "Role: {user_role}\nConversation history:\n{conversation_history}\n\n"
                        "Current question: {question}\nContext:\n{context}\n"
                        "Patient disclaimer: {disclaimer}",
                    ),
                ]
            )
            openai_kwargs = {
                "model": settings.model_name,
                "temperature": 0.1,
                "api_key": settings.openai_api_key,
            }
            if settings.openai_api_base.strip():
                openai_kwargs["base_url"] = settings.openai_api_base.strip()
            model = ChatOpenAI(**openai_kwargs)
            chain = prompt | model
            response = chain.invoke(
                {
                    "prompt_version": PROMPT_VERSION,
                    "user_role": user_role,
                    "conversation_history": history_text,
                    "question": question,
                    "context": source_text,
                    "disclaimer": disclaimer or "",
                    "policy_instruction": policy_instruction,
                }
            )
            return str(response.content)

        answer = (
            "Clinical answer scaffold\n\n"
            f"Conversation history:\n{history_text}\n\n"
            f"Question: {question}\n\n"
            f"Retrieved context:\n{source_text or 'No source context available.'}\n\n"
            "Response policy: answer only from retrieved/verified context, name uncertainty, "
            f"follow role policy ({policy_mode}): {policy_instruction}"
        )
        if user_role == "patient" and disclaimer:
            answer = f"{answer}\n\n{disclaimer}"
        return answer

    def _build_prompt(
        self,
        *,
        question: str,
        user_role: str,
        history_text: str,
        source_text: str,
        disclaimer: str | None,
        policy_instruction: str = "",
        policy_mode: str = "",
    ) -> str:
        return (
            "<s>[INST] You are MedRAG India, a source-grounded clinical assistant. "
            "Use only the retrieved context. Do not diagnose. Cite source ids inline. "
            "Use conversation history only to understand follow-up questions; do not treat "
            "earlier assistant answers as clinical evidence. "
            "State uncertainty and recommend clinician review when appropriate. "
            "If the user asks about their personal or demographic details (like name, blood group, allergies, medications, or chronic conditions) and the information is in the retrieved context (e.g. the patient-onboarding-profile), you must answer directly using it. Stating facts from the retrieved profile is not a diagnosis. "
            f"Role policy mode: {policy_mode}. Policy: {policy_instruction}. "
            f"Prompt version: {PROMPT_VERSION}.\n\n"
            f"Role: {user_role}\n"
            f"Conversation history:\n{history_text}\n\n"
            f"Current question: {question}\n"
            f"Retrieved context:\n{source_text or 'No retrieved context available.'}\n"
            f"Patient disclaimer: {disclaimer or ''}\n"
            "Answer: [/INST]"
        )

    @staticmethod
    def _format_conversation_history(messages: list[dict[str, str]]) -> str:
        if not messages:
            return "No previous turns in this conversation."
        return "\n".join(
            f"{'User' if message['role'] == 'user' else 'Assistant'}: {message['content']}"
            for message in messages
        )

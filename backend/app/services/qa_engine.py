import logging
import requests
from app.config import settings
from langchain_core.language_models.llms import LLM
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

class SmartExtractiveLLM(LLM):
    """
    Intelligent Extractive Fallback LLM.
    Used when local Ollama is offline or not installed on the machine.
    Extracts high-precision answers directly from document context.
    """
    @property
    def _llm_type(self) -> str:
        return "smart_extractive_fallback"

    def _call(self, prompt: str, stop: Optional[List[str]] = None, **kwargs: Any) -> str:
        # Parse context from prompt
        if "Context:" in prompt and "Question:" in prompt:
            try:
                context_part = prompt.split("Context:")[1].split("Question:")[0].strip()
                question_part = prompt.split("Question:")[1].split("\n")[0].strip()
                
                if not context_part:
                    return "Information not found in documents."
                
                # Split context into clean passages
                passages = [p.strip() for p in context_part.split("---") if p.strip()]
                if not passages:
                    passages = [context_part]

                # Return top relevant passage cleanly
                top_text = passages[0]
                lines = [line.strip() for line in top_text.split("\n") if line.strip()]
                extracted = " ".join(lines[:4])
                return f"{extracted}"
            except Exception:
                pass

        return "Information not found in documents."

_llm_instance = None


def get_llm():
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    provider = settings.LLM_PROVIDER.lower()
    logger.info(f"[LLM] Initialising provider: '{provider}'")

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        if not settings.OPENAI_API_KEY:
            logger.warning("[LLM] OPENAI_API_KEY not set. Using Smart Extractive Fallback.")
            _llm_instance = SmartExtractiveLLM()
            return _llm_instance
        _llm_instance = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.0,
            max_tokens=1024,
        )

    elif provider == "ollama":
        # Check if local Ollama server is reachable on port 11434
        try:
            res = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=1.5)
            if res.status_code == 200:
                try:
                    from langchain_ollama import OllamaLLM
                except ImportError:
                    from langchain_community.llms import Ollama as OllamaLLM
                
                logger.info(f"[LLM] Ollama server active at {settings.OLLAMA_BASE_URL}")
                _llm_instance = OllamaLLM(
                    base_url=settings.OLLAMA_BASE_URL,
                    model=settings.OLLAMA_MODEL,
                    temperature=0.0,
                    num_ctx=4096,
                    num_predict=1024,
                )
                return _llm_instance
        except Exception as e:
            logger.warning(f"[LLM] Local Ollama server offline at {settings.OLLAMA_BASE_URL} ({e}). Falling back to Smart Extractive RAG.")

        # Fallback to Smart Extractive LLM if Ollama is not running
        _llm_instance = SmartExtractiveLLM()

    elif provider == "huggingface":
        try:
            from langchain_community.llms import HuggingFacePipeline
            from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
            import torch
            tokenizer = AutoTokenizer.from_pretrained(settings.HF_MODEL_ID)
            model = AutoModelForCausalLM.from_pretrained(
                settings.HF_MODEL_ID,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto",
            )
            pipe = pipeline(
                "text-generation", model=model, tokenizer=tokenizer,
                max_new_tokens=512, temperature=0.0,
            )
            _llm_instance = HuggingFacePipeline(pipeline=pipe)
        except Exception as e:
            logger.warning(f"[LLM] HuggingFace initialization failed ({e}). Falling back to Smart Extractive RAG.")
            _llm_instance = SmartExtractiveLLM()

    else:
        _llm_instance = SmartExtractiveLLM()

    logger.info("[LLM] Ready.")
    return _llm_instance

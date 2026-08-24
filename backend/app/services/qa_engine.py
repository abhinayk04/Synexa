import logging
import re
import requests
from app.config import settings
from langchain_core.language_models.llms import LLM
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

class SmartExtractiveLLM(LLM):
    """
    Intelligent Extractive RAG Reader.
    Used when local Ollama is offline.
    Extracts facts and formats them into clean markdown bullet points and headings.
    """
    @property
    def _llm_type(self) -> str:
        return "smart_extractive_fallback"

    def _call(self, prompt: str, stop: Optional[List[str]] = None, **kwargs: Any) -> str:
        if "Context:" in prompt and "Question:" in prompt:
            try:
                context_part = prompt.split("Context:")[1].split("Question:")[0].strip()
                
                if not context_part:
                    return "Information not found in documents."
                
                # Fix line-break hyphens (e.g. "Trans- formers" -> "Transformers")
                clean_context = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', context_part)
                clean_context = re.sub(r'(\w+)-\s+(\w+)', r'\1\2', clean_context)
                
                passages = [p.strip() for p in clean_context.split("---") if p.strip()]
                if not passages:
                    passages = [clean_context]

                top_text = passages[0]
                raw_lines = [line.strip() for line in top_text.split("\n") if line.strip()]
                
                formatted_bullets = []
                for line in raw_lines[:10]:
                    if ":" in line and not line.startswith("-") and not line.startswith("•"):
                        parts = line.split(":", 1)
                        formatted_bullets.append(f"**{parts[0].strip()}:** {parts[1].strip()}")
                    elif line.startswith("- ") or line.startswith("* ") or line.startswith("• "):
                        formatted_bullets.append(line)
                    elif len(line) > 10:
                        formatted_bullets.append(f"• {line}")

                if formatted_bullets:
                    return "\n\n".join(formatted_bullets)
                
                return "\n\n".join([f"• {l}" for l in raw_lines[:5]])
            except Exception as e:
                logger.warning(f"[SmartExtractiveLLM] Formatting error: {e}")

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

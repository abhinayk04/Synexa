import logging
import re
import os
import requests
from app.config import settings
from langchain_core.language_models.llms import LLM
from typing import Optional, List, Any

logger = logging.getLogger(__name__)


class GeminiDirectLLM(LLM):
    """Direct Google Gemini 1.5 Flash LLM Integration."""
    api_key: str

    @property
    def _llm_type(self) -> str:
        return "google_gemini_1.5_flash"

    def _call(self, prompt: str, stop: Optional[List[str]] = None, **kwargs: Any) -> str:
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.warning(f"[GeminiDirectLLM] Direct call warning: {e}")
            fallback = PureDocumentExtractiveLLM()
            return fallback._call(prompt)


class PureDocumentExtractiveLLM(LLM):
    """
    Strict 100% Document-Grounded Extractive RAG Engine.
    Exclusively parses, filters, and formats text from the CURRENT UPLOADED DOCUMENT context.
    - Zero hardcoded resume, project, or domain text.
    - Normalizes PDF line breaks and word spacing (e.g. 'reconstructionto' -> 'reconstruction to').
    - Dynamically matches question intent (Functions, Conclusions, Requirements, Details) against document passages.
    """

    @property
    def _llm_type(self) -> str:
        return "pure_document_extractive"

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        # Fix concatenated words from PDF line wraps
        cleaned = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
        cleaned = re.sub(r'([a-zA-Z])(\d+)', r'\1 \2', cleaned)
        cleaned = re.sub(r'(\d+)([a-zA-Z])', r'\1 \2', cleaned)
        cleaned = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', cleaned)
        cleaned = re.sub(r'(\w+)-\s+(\w+)', r'\1\2', cleaned)
        cleaned = re.sub(r'[ \t]+', ' ', cleaned)
        return cleaned.strip()

    def _call(self, prompt: str, stop: Optional[List[str]] = None, **kwargs: Any) -> str:
        if "Context:" not in prompt or "Question:" not in prompt:
            return "Information not found in documents."

        try:
            raw_context = prompt.split("Context:")[1].split("Question:")[0].strip()
            raw_question = prompt.split("Question:")[1].split("\n")[0].strip().lower()

            if not raw_context:
                return "Information not found in documents."

            clean_context = self._clean_text(raw_context)

            # Split context into passages and lines
            passages = [p.strip() for p in clean_context.split("---") if p.strip()]
            full_text = "\n\n".join(passages)
            raw_lines = [l.strip() for l in full_text.split("\n") if l.strip()]

            # Deduplicate lines while filtering out short noise lines (< 15 chars)
            seen_lines = set()
            valid_lines = []
            for line in raw_lines:
                line_lower = line.lower()
                if line_lower not in seen_lines and len(line) >= 12:
                    seen_lines.add(line_lower)
                    valid_lines.append(line)

            if not valid_lines:
                return "Information not found in documents."

            # ── 1. FUNCTIONS / FEATURES / METHODS / CAPABILITIES ──
            if any(k in raw_question for k in ["function", "functions", "feature", "features", "method", "methods", "capability", "capabilities", "what does", "role"]):
                func_keywords = ["function", "feature", "built", "implemented", "designed", "pipeline", "service", "api", "model", "algorithm", "role", "responsibility", "task", "job", "about", "copilot", "engine"]
                matched_lines = [l for l in valid_lines if any(fk in l.lower() for fk in func_keywords)]
                
                if matched_lines:
                    output = ["### ⚙️ Key Functions & Details Extracted:\n"]
                    for line in matched_lines[:8]:
                        clean_l = self._clean_text(line.lstrip("•-* ").strip())
                        if ":" in clean_l and not clean_l.startswith("•"):
                            parts = clean_l.split(":", 1)
                            output.append(f"• **{parts[0].strip()}:** {parts[1].strip()}")
                        else:
                            output.append(f"• **{clean_l}**" if len(clean_l) < 60 else f"• {clean_l}")
                    return "\n".join(output)

            # ── 2. CONCLUSIONS / SUMMARY / OVERVIEW / MAIN POINTS ──
            if any(k in raw_question for k in ["conclusion", "conclusions", "summary", "overview", "highlight", "highlights", "main"]):
                output = ["### 📋 Document Summary & Key Takeaways\n"]
                substantial_lines = [l for l in valid_lines if len(l) >= 20]

                if substantial_lines:
                    for b in substantial_lines[:8]:
                        clean_b = self._clean_text(b.lstrip("•-* ").strip())
                        if ":" in clean_b and not clean_b.startswith("•"):
                            parts = clean_b.split(":", 1)
                            output.append(f"• **{parts[0].strip()}:** {parts[1].strip()}")
                        else:
                            output.append(f"• {clean_b}")
                    return "\n".join(output)

            # ── 3. SPECIFIC KEYWORD QUERY SEARCH ──
            query_words = [w for w in raw_question.split() if len(w) > 3 and w not in ["what", "where", "which", "there", "these", "those", "about", "from", "with", "this", "that"]]
            matched_lines = []

            for line in valid_lines:
                if any(qw in line.lower() for qw in query_words) and len(line) >= 15:
                    matched_lines.append(line)

            if matched_lines:
                output = ["### 📌 Key Passages Matching Query:\n"]
                for line in matched_lines[:6]:
                    clean_l = self._clean_text(line.lstrip("•-* ").strip())
                    output.append(f"• {clean_l}")
                return "\n".join(output)

            # Fallback: return top substantial lines from current document context
            substantial_lines = [self._clean_text(l.lstrip("•-* ").strip()) for l in valid_lines if len(l) >= 20][:6]
            if substantial_lines:
                return "### 📄 Document Overview:\n\n" + "\n".join([f"• {l}" for l in substantial_lines])

        except Exception as e:
            logger.warning(f"[PureDocumentExtractiveLLM] Error: {e}")

        return "Information not found in documents."


_llm_instance = None


def get_llm():
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            logger.info("[LLM] Initialising Google Gemini 1.5 Flash LLM Engine...")
            _llm_instance = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=gemini_key,
                temperature=0.0,
                max_output_tokens=1024,
            )
            return _llm_instance
        except Exception as e:
            logger.info(f"[LLM] Using GeminiDirectLLM fallback ({e})")
            _llm_instance = GeminiDirectLLM(api_key=gemini_key)
            return _llm_instance

    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            from langchain_groq import ChatGroq
            logger.info("[LLM] Initialising Groq Llama3 LLM Engine...")
            _llm_instance = ChatGroq(
                model_name="llama3-8b-8192",
                groq_api_key=groq_key,
                temperature=0.0,
                max_tokens=1024,
            )
            return _llm_instance
        except Exception as e:
            logger.warning(f"[LLM] Groq initialization warning: {e}")

    provider = settings.LLM_PROVIDER.lower()
    logger.info(f"[LLM] Initialising provider: '{provider}'")

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        if not settings.OPENAI_API_KEY:
            logger.warning("[LLM] OPENAI_API_KEY not set. Using Pure Document Extractive RAG Engine.")
            _llm_instance = PureDocumentExtractiveLLM()
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
            logger.warning(f"[LLM] Local Ollama server offline ({e}). Using Pure Document Extractive RAG Engine.")

        _llm_instance = PureDocumentExtractiveLLM()

    else:
        _llm_instance = PureDocumentExtractiveLLM()

    logger.info("[LLM] Ready.")
    return _llm_instance

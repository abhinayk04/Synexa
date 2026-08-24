import logging
import re
import os
import requests
from app.config import settings
from langchain_core.language_models.llms import LLM
from typing import Optional, List, Any

logger = logging.getLogger(__name__)


class GeminiDirectLLM(LLM):
    """Direct Google Gemini LLM Integration with google.genai SDK."""
    api_key: str

    @property
    def _llm_type(self) -> str:
        return "google_gemini_flash"

    def _call(self, prompt: str, stop: Optional[List[str]] = None, **kwargs: Any) -> str:
        # 1. Try official google.genai Client SDK
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            for m in ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"]:
                try:
                    res = client.models.generate_content(model=m, contents=prompt)
                    if res and res.text:
                        return res.text.strip()
                except Exception as inner_e:
                    logger.info(f"[GeminiDirectLLM] Model '{m}' failed: {inner_e}")
        except Exception as e:
            logger.warning(f"[GeminiDirectLLM] google.genai Client warning: {e}")

        # 2. Try legacy google.generativeai SDK fallback
        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=self.api_key)
            for m in ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"]:
                try:
                    mod = genai_legacy.GenerativeModel(m)
                    res = mod.generate_content(prompt)
                    if res and res.text:
                        return res.text.strip()
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"[GeminiDirectLLM] Legacy SDK warning: {e}")

        fallback = PureDocumentExtractiveLLM()
        return fallback._call(prompt)


class PureDocumentExtractiveLLM(LLM):
    """
    Strict 100% Document-Grounded Extractive RAG Engine.
    Exclusively parses, filters, and formats text from the CURRENT UPLOADED DOCUMENT context.
    - Normalizes PDF kerning and word spacing.
    - Dynamically matches question intent against document passages.
    """

    @property
    def _llm_type(self) -> str:
        return "pure_document_extractive"

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        # Collapse spaced-out kerning letters (e.g. 'A R T I F I C I A L' -> 'ARTIFICIAL')
        text = re.sub(r'(?:(?<=\s)|(?<=^))(?:[A-Za-z]\s+){2,}[A-Za-z](?=\s|$)', lambda m: m.group(0).replace(" ", ""), text)
        text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
        text = re.sub(r'([a-zA-Z])(\d+)', r'\1 \2', text)
        text = re.sub(r'(\d+)([a-zA-Z])', r'\1 \2', text)
        text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)
        text = re.sub(r'(\w+)-\s+(\w+)', r'\1\2', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

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

            # Deduplicate lines while filtering out short noise lines (< 10 chars)
            seen_lines = set()
            valid_lines = []
            for line in raw_lines:
                clean_l = self._clean_text(line)
                line_lower = clean_l.lower()
                if line_lower not in seen_lines and len(clean_l) >= 8:
                    seen_lines.add(line_lower)
                    valid_lines.append(clean_l)

            if not valid_lines:
                return "Information not found in documents."

            # ── 1. OVERVIEW / SUMMARY / ABOUT / PROJECT / PDF QUERIES ──
            overview_triggers = ["about", "summary", "overview", "pdf", "document", "project", "lab", "manual", "what is this", "tell me", "explain", "details", "main", "content"]
            if any(tr in raw_question for tr in overview_triggers):
                output = ["### Document Overview & Summary:\n"]
                for l in valid_lines[:8]:
                    clean_l = self._clean_text(l.lstrip("•-* ").strip())
                    if ":" in clean_l and not clean_l.startswith("•"):
                        parts = clean_l.split(":", 1)
                        output.append(f"• **{parts[0].strip()}:** {parts[1].strip()}")
                    else:
                        output.append(f"• {clean_l}")
                return "\n".join(output)

            # ── 2. FUNCTIONS / FEATURES / METHODS / CAPABILITIES ──
            if any(k in raw_question for k in ["function", "functions", "feature", "features", "method", "methods", "capability", "capabilities", "what does", "role"]):
                func_keywords = ["function", "feature", "built", "implemented", "designed", "pipeline", "service", "api", "model", "algorithm", "role", "responsibility", "task", "job", "about", "copilot", "engine"]
                matched_lines = [l for l in valid_lines if any(fk in l.lower() for fk in func_keywords)]
                
                if matched_lines:
                    output = ["### Key Functions & Details Extracted:\n"]
                    for line in matched_lines[:8]:
                        clean_l = self._clean_text(line.lstrip("•-* ").strip())
                        if ":" in clean_l and not clean_l.startswith("•"):
                            parts = clean_l.split(":", 1)
                            output.append(f"• **{parts[0].strip()}:** {parts[1].strip()}")
                        else:
                            output.append(f"• **{clean_l}**" if len(clean_l) < 60 else f"• {clean_l}")
                    return "\n".join(output)

            # ── 3. SPECIFIC KEYWORD QUERY SEARCH ──
            stop_words = {"what", "where", "which", "there", "these", "those", "about", "from", "with", "this", "that", "does", "have", "been"}
            query_words = [w for w in re.findall(r'\w+', raw_question) if len(w) > 2 and w not in stop_words]
            matched_lines = []

            for line in valid_lines:
                if any(qw in line.lower() for qw in query_words) and len(line) >= 10:
                    matched_lines.append(line)

            if matched_lines:
                output = ["### Key Passages Matching Query:\n"]
                for line in matched_lines[:6]:
                    clean_l = self._clean_text(line.lstrip("•-* ").strip())
                    output.append(f"• {clean_l}")
                return "\n".join(output)

            # ── 4. DEFAULT CONTEXT SUMMARY FALLBACK ──
            output = ["### Document Content Details:\n"]
            for l in valid_lines[:8]:
                clean_l = self._clean_text(l.lstrip("•-* ").strip())
                if ":" in clean_l and not clean_l.startswith("•"):
                    parts = clean_l.split(":", 1)
                    output.append(f"• **{parts[0].strip()}:** {parts[1].strip()}")
                else:
                    output.append(f"• {clean_l}")
            return "\n".join(output)

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
        logger.info("[LLM] Initialising Google Gemini 3.6 Flash Direct Engine...")
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

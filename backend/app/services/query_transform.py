import logging
from typing import List
from langchain_core.messages import HumanMessage

from app.services.qa_engine import get_llm

logger = logging.getLogger(__name__)

HYDE_PROMPT = """\
Please write a short, hypothetical passage from an official document or textbook that answers the question below.
If the question is in Telglish, Hinglish, Telugu, or Hindi, write the hypothetical passage in English to match document vectors.
Do NOT explain yourself. Write ONLY the hypothetical content passage (2-4 sentences).

Question: {question}
Hypothetical Answer Passage:"""

MULTI_QUERY_PROMPT = """\
You are an AI assistant helping to improve vector retrieval across multiple languages.
Generate 2 alternative search queries for the user question below.
If the question is in Telglish (Telugu in Roman script), Hinglish (Hindi in Roman script), Telugu, or Hindi, include at least 1 exact English translation query so vector and keyword search find relevant passages in English documents.
Separate each query with a newline. Do not number them or add extra text.

Original Question: {question}
Alternative Queries:"""


def _fix_common_typos(text: str) -> str:
    """Corrects common user query typos (e.g. 'noice' -> 'noise')."""
    typo_map = {
        "noice": "noise",
        "implimented": "implemented",
        "documnt": "document",
        "sumary": "summary",
        "concluson": "conclusion",
        "featur": "feature",
        "functon": "function",
        "recovry": "recovery",
    }
    words = text.split()
    fixed_words = [typo_map.get(w.lower(), w) for w in words]
    return " ".join(fixed_words)


def generate_hyde_passage(question: str) -> str:
    """
    Generate Hypothetical Document Embedding (HyDE) passage.
    Transforms raw question into a hypothetical answer passage for better dense vector alignment.
    """
    clean_q = _fix_common_typos(question)
    try:
        llm = get_llm()
        prompt = HYDE_PROMPT.format(question=clean_q)
        res = llm.invoke([HumanMessage(content=prompt)])
        passage = res.content if hasattr(res, "content") else str(res)
        passage = passage.strip()
        logger.info(f"[HyDE] Generated hypothetical passage ({len(passage)} chars)")
        return passage
    except Exception as e:
        logger.warning(f"[HyDE] Generation failed ({e}). Falling back to original question.")
        return clean_q


def generate_query_expansions(question: str) -> List[str]:
    """
    Multi-Query Expansion & Code-Switching Translation.
    Generates alternative search queries including English translations for Telglish / Hinglish / Multilingual input.
    """
    clean_q = _fix_common_typos(question)
    queries = [clean_q]
    if clean_q.lower() != question.lower():
        queries.append(question)

    try:
        llm = get_llm()
        prompt = MULTI_QUERY_PROMPT.format(question=clean_q)
        res = llm.invoke([HumanMessage(content=prompt)])
        raw = res.content if hasattr(res, "content") else str(res)
        
        for line in raw.strip().split("\n"):
            line = line.strip().lstrip("0123456789.- ")
            if line and line.lower() != clean_q.lower() and len(line) > 3:
                queries.append(line)
        
        logger.info(f"[MultiQuery] Expanded query into {len(queries)} search variations for multilingual RAG")
    except Exception as e:
        logger.warning(f"[MultiQuery] Expansion failed ({e}).")

    return queries[:4]

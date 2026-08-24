import logging
from typing import Dict, Any, List
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

def generate_document_intelligence(chunks: List[Document]) -> Dict[str, Any]:
    """
    Fast Document Intelligence.
    Computes instant word counts, estimated read times, and sample summaries
    without blocking the HTTP upload pipeline on slow LLM calls.
    """
    if not chunks:
        return {
            "summary": "Empty document.",
            "topics": [],
            "word_count": 0,
            "est_read_time_min": 0,
        }

    full_text = " ".join([c.page_content for c in chunks])
    word_count = len(full_text.split())
    read_time = max(1, round(word_count / 200))

    # Fast extractive summary from first 2 chunks
    sample_text = chunks[0].page_content.strip() if chunks else ""
    first_lines = [line.strip() for line in sample_text.split("\n") if len(line.strip()) > 10][:2]
    summary = " ".join(first_lines) if first_lines else f"Document contains {len(chunks)} indexed passages (~{word_count} words)."

    return {
        "summary": summary,
        "topics": ["Document"],
        "word_count": word_count,
        "est_read_time_min": read_time,
    }

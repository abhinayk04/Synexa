import logging
import os
import json
import asyncio
from typing import Dict, Any, List, Tuple, AsyncGenerator, Optional

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage

from app.config import settings
from app.services.hybrid_retriever import hybrid_retrieve
from app.services.reranker import rerank_documents
from app.services.qa_engine import get_llm
from app.services.vector_store import resolve_document_id
from app.services.query_transform import generate_query_expansions

logger = logging.getLogger(__name__)

NOT_FOUND = "Information not found in documents."
SIMILARITY_THRESHOLD = 0.10

_RULES = """\
STRICT RULES — follow without exception:
1. Answer ONLY using the text in the Context section below.
2. DO NOT use any prior knowledge or training data.
3. DO NOT generate code, formulas, or examples unless they appear word-for-word in the context.
4. If the answer is not found in the context, respond with EXACTLY: "Information not found in documents."
5. DO NOT guess, infer, or make up any information.
6. MULTILINGUAL & CODE-SWITCHING SUPPORT: If the user asks in Telugu, Hindi, Telglish, Hinglish, or any regional language, reply in that SAME language!
7. Keep answers factual and precise based strictly on the Context provided.\
"""

PROMPT_TEMPLATES = {
    "simple": """\
{rules}

{history_block}Context:
{context}

Question: {question}

Answer (from context only, concise, in the same language as question):""",

    "detailed": """\
{rules}

{history_block}Context:
{context}

Question: {question}

Detailed Answer (from context only, multi-paragraph, in the same language as question):""",

    "exam": """\
{rules}
Structure as:
- Definition
- Explanation
- Example (only if explicitly in context)

{history_block}Context:
{context}

Question: {question}

Exam-Style Answer (from context only, in the same language as question):""",

    "summary": """\
{rules}
Structure as:
- Executive Summary
- Top Key Highlights
- Core Takeaways

{history_block}Context:
{context}

Question: {question}

Executive Summary Answer (from context only, in the same language as question):""",
}


def _build_context_and_sources(
    results: List[Tuple[Document, float]]
) -> Tuple[str, List[Dict], List[float]]:
    context_parts: List[str] = []
    sources_seen: set = set()
    sources: List[Dict] = []
    scores: List[float] = []

    for doc, score in results:
        passage_text = doc.metadata.get("parent_text", doc.page_content.strip())
        context_parts.append(passage_text)
        scores.append(score)

        raw = doc.metadata.get("source", "unknown")
        display_name = doc.metadata.get("document_name", os.path.basename(raw))
        page_num = int(doc.metadata.get("page", 0)) + 1

        key = f"{display_name}::{page_num}"
        if key not in sources_seen:
            sources_seen.add(key)
            sources.append({"document": display_name, "page": page_num})

    return "\n\n---\n\n".join(context_parts), sources, scores


def _build_prompt(question: str, context: str, history: str, mode: str) -> str:
    history_block = f"Chat History:\n{history}\n\n" if history else ""
    template = PROMPT_TEMPLATES.get(mode, PROMPT_TEMPLATES["simple"])
    return template.format(
        rules=_RULES,
        history_block=history_block,
        context=context,
        question=question,
    )


async def _load_history_for_chat(chat_id: str) -> str:
    try:
        from app.services.memory import get_chat_history, format_history_for_prompt
        msgs = await get_chat_history(chat_id)
        return format_history_for_prompt(msgs)
    except Exception as e:
        logger.warning(f"[RAG] Could not load history: {e}")
        return ""


async def _save_pair_to_chat(chat_id: str, question: str, answer: str) -> None:
    try:
        from app.services.memory import save_message
        await save_message(chat_id, "user", question)
        await save_message(chat_id, "assistant", answer)
    except Exception as e:
        logger.warning(f"[RAG] Could not save to MongoDB: {e}")


def _extract_doc_id_from_chat_id(chat_id: str) -> str:
    """Robustly derives document_id from chat_id (e.g. 'chat_doc_abc123' -> 'doc_abc123')."""
    if not chat_id:
        return "default"
    cleaned = chat_id.replace("chat_", "")
    if not cleaned.startswith("doc_"):
        cleaned = "doc_" + cleaned
    return cleaned


async def run_rag_pipeline(
    question: str,
    mode: str = "simple",
    chat_id: str = None,
    user_id: str = "default",
    document_id: str = "default",
    document_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """High-Speed Parallel RAG Execution Pipeline."""
    resolved_chat_id = chat_id

    # 1. Derive document_id directly from chat_id if not explicitly passed
    if (not document_id or document_id == "default") and chat_id and not document_ids:
        document_id = _extract_doc_id_from_chat_id(chat_id)

    if chat_id:
        try:
            from app.services.memory import get_chat
            chat_doc = await get_chat(chat_id)
            if chat_doc:
                user_id = chat_doc.get("user_id", user_id)
                fetched_doc_id = chat_doc.get("document_id")
                if fetched_doc_id and fetched_doc_id != "default" and not document_ids:
                    document_id = fetched_doc_id
        except Exception as e:
            logger.warning(f"[RAG] get_chat lookup warning for '{chat_id}': {e}")
    
    document_id = resolve_document_id(user_id, document_id or "default")
    logger.info(f"[RAG Pipeline] Question: '{question[:50]}' | user='{user_id}' | doc='{document_id}' | docs='{document_ids}'")

    history_str = await _load_history_for_chat(resolved_chat_id) if resolved_chat_id else ""
    expanded_queries = generate_query_expansions(question)
    
    # Fast Parallel Retrieval across selected document_ids
    async def _fetch_candidates(q_var: str):
        return await asyncio.to_thread(
            hybrid_retrieve,
            q_var,
            user_id=user_id,
            document_id=document_id,
            document_ids=document_ids,
            top_k=settings.TOP_K_RESULTS * 2,
        )

    retrieval_tasks = [_fetch_candidates(q_var) for q_var in expanded_queries]
    retrieval_results = await asyncio.gather(*retrieval_tasks)

    all_candidates: List[Tuple[Document, float]] = []
    seen_keys: set = set()

    for candidates in retrieval_results:
        for doc, score in candidates:
            doc_key = doc.metadata.get("chunk_id", doc.page_content[:100])
            if doc_key not in seen_keys:
                seen_keys.add(doc_key)
                all_candidates.append((doc, score))

    if not all_candidates:
        if resolved_chat_id:
            await _save_pair_to_chat(resolved_chat_id, question, NOT_FOUND)
        return {
            "answer": NOT_FOUND,
            "sources": [],
            "confidence": 0.0,
            "mode": mode,
            "document_id": document_id,
            "chat_id": resolved_chat_id,
            "highlight_text": "",
        }

    # Parallel Reranking in background thread
    reranked = await asyncio.to_thread(
        rerank_documents,
        query=question,
        candidates=all_candidates,
        top_k=settings.TOP_K_RESULTS,
    )

    filtered = [(d, s) for d, s in reranked if s >= SIMILARITY_THRESHOLD]
    if not filtered:
        filtered = reranked[:3]

    context, sources, scores = _build_context_and_sources(filtered)
    confidence = round(sum(scores) / len(scores), 4) if scores else 0.0
    highlight_text = filtered[0][0].page_content.strip()[:300] if filtered else ""

    prompt = _build_prompt(question, context, history_str, mode)

    llm = get_llm()
    try:
        response = await asyncio.to_thread(llm.invoke, [HumanMessage(content=prompt)])
        answer = response.content if hasattr(response, "content") else str(response)
    except Exception:
        answer = str(await asyncio.to_thread(llm.invoke, prompt))

    answer = answer.strip()

    _signals = [
        "information not found", "not found in document",
        "not present in", "not mentioned in", "cannot be found",
        "no information", "i don't have", "i do not have",
    ]
    if any(sig in answer.lower() for sig in _signals):
        answer = NOT_FOUND
        sources = []
        highlight_text = ""

    if resolved_chat_id:
        asyncio.create_task(_save_pair_to_chat(resolved_chat_id, question, answer))

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "mode": mode,
        "document_id": document_id,
        "chat_id": resolved_chat_id,
        "highlight_text": highlight_text,
    }


async def stream_rag_pipeline(
    question: str,
    mode: str = "simple",
    chat_id: str = None,
    user_id: str = "default",
    document_id: str = "default",
    document_ids: Optional[List[str]] = None,
) -> AsyncGenerator[str, None]:
    """Server-Sent Events (SSE) streaming generator yielding word-by-word token payloads."""
    rag_res = await run_rag_pipeline(
        question=question,
        mode=mode,
        chat_id=chat_id,
        user_id=user_id,
        document_id=document_id,
        document_ids=document_ids,
    )

    meta_frame = {
        "type": "meta",
        "sources": rag_res["sources"],
        "confidence": rag_res["confidence"],
        "highlight_text": rag_res["highlight_text"],
        "chat_id": rag_res["chat_id"],
    }
    yield f"data: {json.dumps(meta_frame)}\n\n"
    await asyncio.sleep(0.005)

    full_answer = rag_res["answer"]

    words = full_answer.split(" ")
    for idx, word in enumerate(words):
        chunk_text = word + (" " if idx < len(words) - 1 else "")
        token_frame = {"type": "token", "content": chunk_text}
        yield f"data: {json.dumps(token_frame)}\n\n"
        await asyncio.sleep(0.005)

    yield "data: [DONE]\n\n"
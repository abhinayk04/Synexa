import os
import pickle
import logging
import re
from typing import List, Tuple, Dict, Any, Optional
from rank_bm25 import BM25Okapi
from langchain_core.documents import Document

from app.config import settings
from app.services.vector_store import load_vectorstore, load_all_user_vectorstores

logger = logging.getLogger(__name__)


def _tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase alphanumeric tokens for BM25 indexing."""
    return re.findall(r'\w+', text.lower())


def _bm25_path(user_id: str, document_id: str) -> str:
    path = os.path.join(settings.VECTORSTORE_DIR, user_id, document_id)
    os.makedirs(path, exist_ok=True)
    return os.path.join(path, "bm25.pkl")


def save_bm25_index(chunks: List[Document], user_id: str, document_id: str) -> None:
    """Build and save BM25 sparse index alongside FAISS index."""
    if not chunks:
        return

    corpus = [_tokenize(doc.page_content) for doc in chunks]
    bm25 = BM25Okapi(corpus)

    data = {
        "bm25": bm25,
        "chunks": chunks,
    }

    file_path = _bm25_path(user_id, document_id)
    with open(file_path, "wb") as f:
        pickle.dump(data, f)

    logger.info(f"[BM25] Saved sparse index with {len(chunks)} documents to '{file_path}'")


def get_document_overview_chunks(user_id: str, document_id: str, top_k: int = 6) -> List[Tuple[Document, float]]:
    """Returns top initial document chunks for summary/overview queries."""
    if not document_id or document_id in ("default", "all", "", None):
        return []

    try:
        store = load_vectorstore(user_id=user_id, document_id=document_id)
        if hasattr(store, "docstore") and hasattr(store.docstore, "_dict"):
            docs = list(store.docstore._dict.values())
            if docs:
                logger.info(f"[Overview] Loaded {len(docs[:top_k])} initial chunks for document '{document_id}'")
                return [(d, 0.95 - (i * 0.01)) for i, d in enumerate(docs[:top_k])]
    except Exception as e:
        logger.warning(f"[Overview] Failed loading initial chunks: {e}")
    return []


def is_summary_query(query: str) -> bool:
    """Detects if query is requesting a document overview or summary."""
    q_lower = query.lower().strip()
    summary_terms = [
        "summary", "summarize", "overview", "about", "takeaway", "takeaways",
        "main points", "what is this", "provide summary", "give summary",
        "explain document", "highlights", "details", "description", "document overview",
        "what this doc", "what is this doc", "what the pdf", "what is the pdf", "tell me about"
    ]
    return any(term in q_lower for term in summary_terms)


def search_bm25(
    query: str,
    user_id: str,
    document_ids: List[str],
    top_k: int = 10,
) -> List[Tuple[Document, float]]:
    """Query BM25 index for sparse keyword matches strictly for targeted document_ids."""
    results: List[Tuple[Document, float]] = []
    target_paths = []

    if document_ids:
        for doc_id in document_ids:
            bp = _bm25_path(user_id, doc_id)
            if os.path.exists(bp):
                target_paths.append(bp)
    else:
        user_dir = os.path.join(settings.VECTORSTORE_DIR, user_id)
        if os.path.isdir(user_dir):
            for entry in os.scandir(user_dir):
                if entry.is_dir():
                    bp = os.path.join(entry.path, "bm25.pkl")
                    if os.path.exists(bp):
                        target_paths.append(bp)

    tokenized_query = _tokenize(query)
    if not tokenized_query:
        return []

    for file_path in target_paths:
        try:
            with open(file_path, "rb") as f:
                data = pickle.load(f)

            bm25: BM25Okapi = data["bm25"]
            chunks: List[Document] = data["chunks"]

            scores = bm25.get_scores(tokenized_query)
            top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]

            for idx in top_indices:
                score = float(scores[idx])
                if score > 0:
                    results.append((chunks[idx], score))
        except Exception as e:
            logger.warning(f"[BM25] Search failed on '{file_path}': {e}")

    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


def reciprocal_rank_fusion(
    dense_results: List[Tuple[Document, float]],
    sparse_results: List[Tuple[Document, float]],
    top_k: int = 7,
    rrf_k: int = 60,
) -> List[Tuple[Document, float]]:
    """
    Reciprocal Rank Fusion (RRF) algorithm to combine Dense (FAISS) and Sparse (BM25) ranks.
    """
    rrf_scores: Dict[str, float] = {}
    doc_map: Dict[str, Document] = {}

    def _doc_key(doc: Document) -> str:
        content = doc.page_content.strip()
        doc_id = doc.metadata.get("chunk_id", content[:100])
        return f"{doc.metadata.get('document_name', '')}::{doc_id}"

    for rank, (doc, score) in enumerate(dense_results, start=1):
        key = _doc_key(doc)
        doc_map[key] = doc
        rrf_scores[key] = rrf_scores.get(key, 0.0) + (1.0 / (rrf_k + rank))

    for rank, (doc, score) in enumerate(sparse_results, start=1):
        key = _doc_key(doc)
        if key not in doc_map:
            doc_map[key] = doc
        rrf_scores[key] = rrf_scores.get(key, 0.0) + (1.0 / (rrf_k + rank))

    sorted_keys = sorted(rrf_scores.keys(), key=lambda k: rrf_scores[k], reverse=True)[:top_k]

    max_possible_rrf = 2.0 / (rrf_k + 1)
    
    fused_results = []
    for key in sorted_keys:
        norm_score = min(round(rrf_scores[key] / max_possible_rrf, 4), 1.0)
        fused_results.append((doc_map[key], norm_score))

    logger.info(f"[RRF] Fused {len(dense_results)} dense + {len(sparse_results)} sparse → {len(fused_results)} candidates")
    return fused_results


def hybrid_retrieve(
    query: str,
    user_id: str = "default",
    document_id: str = "default",
    document_ids: Optional[List[str]] = None,
    top_k: int = 7,
) -> List[Tuple[Document, float]]:
    """
    Execute Hybrid Dense (FAISS) + Sparse (BM25) search across single OR multiple selected documents.
    """
    target_doc_ids: List[str] = []
    if document_ids and isinstance(document_ids, list):
        target_doc_ids = [d for d in document_ids if d and d not in ("default", "all", "", None)]
    elif document_id and document_id not in ("default", "all", "", None):
        target_doc_ids = [document_id]

    # Overview fallback for summary queries on a single document
    if len(target_doc_ids) == 1 and is_summary_query(query):
        overview_chunks = get_document_overview_chunks(user_id, target_doc_ids[0], top_k=top_k)
        if overview_chunks:
            return overview_chunks

    dense_results: List[Tuple[Document, float]] = []

    if target_doc_ids:
        for doc_id in target_doc_ids:
            try:
                active_store = load_vectorstore(user_id=user_id, document_id=doc_id)
                docs_and_scores = active_store.similarity_search_with_score(query, k=top_k * 2)
                for doc, score in docs_and_scores:
                    sim = 1.0 / (1.0 + float(score))
                    dense_results.append((doc, sim))
            except Exception as e:
                logger.warning(f"[Hybrid] Search on document '{doc_id}' failed: {e}")
    else:
        # Multi-document fallback across all user stores
        user_stores = load_all_user_vectorstores(user_id=user_id)
        for doc_name, store in user_stores:
            try:
                docs_and_scores = store.similarity_search_with_score(query, k=top_k)
                for doc, score in docs_and_scores:
                    sim = 1.0 / (1.0 + float(score))
                    dense_results.append((doc, sim))
            except Exception as e:
                logger.warning(f"[Hybrid] Search failed on index '{doc_name}': {e}")

    dense_results.sort(key=lambda x: x[1], reverse=True)

    # Sparse BM25 search
    sparse_results = search_bm25(query, user_id=user_id, document_ids=target_doc_ids, top_k=top_k * 2)

    if not dense_results and not sparse_results:
        if len(target_doc_ids) == 1:
            return get_document_overview_chunks(user_id, target_doc_ids[0], top_k=top_k)
        return []

    if not dense_results:
        return sparse_results[:top_k]
    if not sparse_results:
        return dense_results[:top_k]

    return reciprocal_rank_fusion(dense_results, sparse_results, top_k=top_k)

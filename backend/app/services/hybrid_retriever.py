import os
import pickle
import logging
import re
from typing import List, Tuple, Dict, Any
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


def search_bm25(
    query: str,
    user_id: str,
    document_id: str,
    top_k: int = 10,
) -> List[Tuple[Document, float]]:
    """Query BM25 index for sparse keyword matches strictly for active document_id."""
    results: List[Tuple[Document, float]] = []
    
    target_paths = []
    
    # 1. If document_id is provided, strictly target ONLY active document_id BM25 index
    if document_id and document_id not in ("default", "all", "", None):
        bp = _bm25_path(user_id, document_id)
        if os.path.exists(bp):
            target_paths.append(bp)
    else:
        # Cross-document search fallback
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
    top_k: int = 7,
) -> List[Tuple[Document, float]]:
    """
    Execute Hybrid Dense (FAISS) + Sparse (BM25) search with STRICT document isolation.
    """
    dense_results: List[Tuple[Document, float]] = []
    
    # 1. If active document_id is provided, search STRICTLY inside active document_id FAISS store
    if document_id and document_id not in ("default", "all", "", None):
        try:
            active_store = load_vectorstore(user_id=user_id, document_id=document_id)
            docs_and_scores = active_store.similarity_search_with_score(query, k=top_k * 2)
            for doc, score in docs_and_scores:
                sim = 1.0 / (1.0 + float(score))
                dense_results.append((doc, sim))
            logger.info(f"[Hybrid] Strict retrieval on doc='{document_id}' returned {len(dense_results)} candidates")
        except Exception as e:
            logger.warning(f"[Hybrid] Strict retrieval on document '{document_id}' failed: {e}")

    # 2. Multi-document search fallback ONLY when document_id is 'all' or no specific document_id is set
    else:
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

    # 3. Sparse retrieval via BM25 strictly for target document
    sparse_results = search_bm25(query, user_id=user_id, document_id=document_id, top_k=top_k * 2)

    if not dense_results and not sparse_results:
        logger.warning(f"[Hybrid] Search returned 0 results for query '{query[:30]}' on doc '{document_id}'.")
        return []
    if not dense_results:
        return sparse_results[:top_k]
    if not sparse_results:
        return dense_results[:top_k]

    # 4. Reciprocal Rank Fusion
    return reciprocal_rank_fusion(dense_results, sparse_results, top_k=top_k)

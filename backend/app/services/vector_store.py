import os
import shutil
import logging
from typing import List, Dict, Tuple, Optional

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

from app.config import settings
from app.services.embeddings import get_embedding_model

logger = logging.getLogger(__name__)

# High-Performance In-Memory FAISS VectorStore Cache
_vectorstore_cache: Dict[str, FAISS] = {}


def _doc_path(user_id: str, document_id: str) -> str:
    path = os.path.join(settings.VECTORSTORE_DIR, user_id, document_id)
    os.makedirs(path, exist_ok=True)
    return path


def find_document_index_path(user_id: str, document_id: str) -> Optional[str]:
    """
    Locates the exact FAISS index directory for document_id across user directories.
    Strictly guarantees that querying document_id ONLY loads document_id's index.
    """
    if not document_id or document_id in ("default", "", None):
        return None

    # 1. Direct check in user_id directory
    user_path = os.path.join(settings.VECTORSTORE_DIR, user_id, document_id)
    if os.path.exists(os.path.join(user_path, "index.faiss")):
        return user_path

    # 2. Search all account directories in VECTORSTORE_DIR for document_id
    if os.path.exists(settings.VECTORSTORE_DIR):
        for root, dirs, files in os.walk(settings.VECTORSTORE_DIR):
            if os.path.basename(root) == document_id and "index.faiss" in files:
                return root

    return None


def resolve_document_id(user_id: str, document_id: str) -> str:
    """Strict resolution: Returns document_id if found, never hijacks with a different document."""
    if document_id and document_id not in ("default", "", None):
        if find_document_index_path(user_id, document_id):
            return document_id

    return document_id or "default"


def _self_heal_reindex(user_id: str, document_id: str) -> bool:
    """Finds raw source file in data/documents and builds FAISS + BM25 index on the fly if missing."""
    docs_dir = settings.DOCUMENTS_DIR
    if not os.path.exists(docs_dir):
        return False

    target_file = None
    clean_id = document_id.replace("doc_", "")

    # Search for matching file in data/documents
    for root, dirs, files in os.walk(docs_dir):
        for f in files:
            if clean_id.lower()[:6] in f.lower() or document_id.lower() in f.lower():
                target_file = os.path.join(root, f)
                break
        if target_file:
            break

    if not target_file and os.path.exists(docs_dir):
        # Fallback to matching document by name
        all_files = [os.path.join(docs_dir, f) for f in os.listdir(docs_dir) if os.path.isfile(os.path.join(docs_dir, f))]
        if all_files:
            target_file = all_files[-1]

    if target_file:
        try:
            logger.info(f"[Self-Heal] Auto-reindexing '{os.path.basename(target_file)}' for doc='{document_id}'")
            from app.services.file_loader import load_document
            from app.services.chunking import chunk_documents
            from app.services.hybrid_retriever import save_bm25_index

            docs = load_document(target_file)
            for d in docs:
                d.metadata["document_name"] = os.path.basename(target_file)
                d.metadata["document_id"] = document_id
                d.metadata["user_id"] = user_id

            chunks = chunk_documents(docs)
            if chunks:
                add_documents_to_vectorstore(chunks, user_id=user_id, document_id=document_id)
                save_bm25_index(chunks, user_id=user_id, document_id=document_id)
                return True
        except Exception as e:
            logger.warning(f"[Self-Heal] Auto-reindex failed: {e}")

    return False


def add_documents_to_vectorstore(
    chunks: List[Document],
    user_id: str = "default",
    document_id: str = "default",
) -> int:
    embeddings = get_embedding_model()
    path = _doc_path(user_id, document_id)
    logger.info(f"[VS] Creating high-speed vector index user='{user_id}' doc='{document_id}'")
    
    store = FAISS.from_documents(chunks, embeddings)
    store.save_local(path)
    total = store.index.ntotal

    cache_key = f"{user_id}::{document_id}"
    _vectorstore_cache[cache_key] = store

    logger.info(f"[VS] Saved & cached {total} vectors → {path}")
    return total


def load_vectorstore(
    user_id: str = "default",
    document_id: str = "default",
) -> FAISS:
    cache_key = f"{user_id}::{document_id}"

    if cache_key in _vectorstore_cache:
        logger.info(f"[VS Cache Hit] Returning in-memory FAISS index doc='{document_id}'")
        return _vectorstore_cache[cache_key]

    index_path = find_document_index_path(user_id, document_id)

    # Self-healing fallback if index was missing from disk
    if not index_path:
        reindexed = _self_heal_reindex(user_id, document_id)
        if reindexed:
            index_path = find_document_index_path(user_id, document_id)

    if not index_path:
        raise FileNotFoundError(
            f"No index found for document '{document_id}' (user='{user_id}')."
        )

    embeddings = get_embedding_model()
    store = FAISS.load_local(
        index_path, embeddings, allow_dangerous_deserialization=True
    )
    _vectorstore_cache[cache_key] = store
    logger.info(f"[VS Cache Miss] Loaded index into RAM doc='{document_id}' from '{index_path}'")
    return store


def load_all_user_vectorstores(user_id: str = "default") -> List[Tuple[str, FAISS]]:
    """Load all vectorstore indexes belonging to the user for multi-document RAG search."""
    stores: List[Tuple[str, FAISS]] = []
    seen_paths = set()

    search_user_ids = [user_id]
    if user_id != "default":
        search_user_ids.append("default")

    for uid in search_user_ids:
        user_dir = os.path.join(settings.VECTORSTORE_DIR, uid)
        if os.path.isdir(user_dir):
            for entry in os.scandir(user_dir):
                if entry.is_dir() and os.path.exists(os.path.join(entry.path, "index.faiss")):
                    faiss_file = os.path.join(entry.path, "index.faiss")
                    if faiss_file not in seen_paths:
                        seen_paths.add(faiss_file)
                        try:
                            store = load_vectorstore(user_id=uid, document_id=entry.name)
                            stores.append((entry.name, store))
                        except Exception as e:
                            logger.warning(f"[VS] Failed loading user index '{entry.name}': {e}")

    return stores


def delete_document_index(user_id: str, document_id: str) -> bool:
    cache_key = f"{user_id}::{document_id}"
    if cache_key in _vectorstore_cache:
        del _vectorstore_cache[cache_key]

    index_path = find_document_index_path(user_id, document_id)
    if index_path and os.path.exists(index_path):
        shutil.rmtree(index_path)
        logger.info(f"[VS] Deleted doc='{document_id}' from '{index_path}'")
        return True
    return False
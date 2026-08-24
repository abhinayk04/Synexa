import logging
import os
import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from app.config import settings
from app.models.response_models import UploadResponse
from app.services.file_loader import load_document, is_supported_file
from app.services.chunking import chunk_documents
from app.services.vector_store import add_documents_to_vectorstore
from app.utils.helpers import save_upload_file, get_supported_extensions_str
from app.services.auth import get_current_user
from app.services.pdf_converter import convert_to_pdf, is_convertible

logger = logging.getLogger(__name__)
router = APIRouter()

CONVERTED_DIR = os.path.join(settings.DOCUMENTS_DIR, "converted")

_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")


def _file_url(relative_to_docs_dir: str) -> str:
    docs_dir = os.path.abspath(settings.DOCUMENTS_DIR)
    abs_path = os.path.abspath(relative_to_docs_dir)
    rel = os.path.relpath(abs_path, docs_dir)
    rel = rel.replace("\\", "/")
    return f"{_BASE_URL}/files/{rel}"


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Upload and index a document",
    description=(
        "Upload a PDF, DOCX, or TXT file. Requires JWT auth. "
        "Returns document_id + chat_id + file_url (+ pdf_url for DOCX/TXT). "
        "Use chat_id in POST /ask."
    ),
    tags=["Documents"],
)
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    filename = file.filename or "unknown"
    document_id = "doc_" + uuid.uuid4().hex[:12]

    if not is_supported_file(filename):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: '{filename}'. "
                f"Accepted: {get_supported_extensions_str()}"
            ),
        )

    logger.info(f"[Upload] user='{user_id}' doc='{document_id}' file='{filename}'")

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        saved_path, original_filename = save_upload_file(
            upload_file_bytes=file_bytes,
            filename=filename,
            documents_dir=settings.DOCUMENTS_DIR,
        )

        raw_file_url = _file_url(saved_path)

        pdf_path: str | None = None
        pdf_url: str | None = None

        if is_convertible(original_filename):
            try:
                user_converted_dir = os.path.join(CONVERTED_DIR, user_id, document_id)
                pdf_path = await asyncio.to_thread(convert_to_pdf, saved_path, user_converted_dir)
                pdf_url = _file_url(pdf_path)
            except RuntimeError as e:
                logger.warning(f"[Upload] PDF conversion skipped: {e}")

        try:
            documents = await asyncio.to_thread(load_document, saved_path)
        except ImportError as e:
            raise HTTPException(status_code=501, detail=f"Dependency missing: {e}")
        except (RuntimeError, ValueError) as e:
            raise HTTPException(status_code=422, detail=str(e))

        for doc in documents:
            doc.metadata["document_name"] = original_filename
            doc.metadata["user_id"] = user_id
            doc.metadata["document_id"] = document_id

        chunks = await asyncio.to_thread(chunk_documents, documents)
        if not chunks:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"No text extracted from '{filename}'. "
                    "For scanned PDFs, ensure Tesseract OCR is installed."
                ),
            )

        # Offload heavy FAISS & BM25 vector indexing to worker thread so asyncio event loop never freezes
        await asyncio.to_thread(add_documents_to_vectorstore, chunks, user_id, document_id)

        try:
            from app.services.hybrid_retriever import save_bm25_index
            await asyncio.to_thread(save_bm25_index, chunks, user_id, document_id)
        except Exception as e:
            logger.warning(f"[Upload] BM25 indexing skipped: {e}")

        from app.services.summarizer import generate_document_intelligence
        doc_intel = generate_document_intelligence(chunks)

        chat_id = "chat_" + document_id[4:]

        # Fast background Mongo persistence
        async def _persist_bg():
            try:
                from app.services.memory import create_chat
                await asyncio.wait_for(
                    create_chat(user_id=user_id, document_id=document_id, title=original_filename),
                    timeout=1.0
                )
            except Exception:
                pass

            try:
                from app.services.database import get_documents_collection
                await asyncio.wait_for(
                    get_documents_collection().insert_one({
                        "_id": document_id,
                        "user_id": user_id,
                        "filename": original_filename,
                        "upload_time": datetime.now(timezone.utc),
                        "num_chunks": len(chunks),
                        "file_type": documents[0].metadata.get("file_type", "unknown"),
                        "saved_path": saved_path,
                        "pdf_path": pdf_path,
                        "file_url": raw_file_url,
                        "pdf_url": pdf_url,
                        "summary": doc_intel.get("summary", ""),
                        "topics": doc_intel.get("topics", []),
                        "word_count": doc_intel.get("word_count", 0),
                        "est_read_time_min": doc_intel.get("est_read_time_min", 0),
                    }),
                    timeout=1.0
                )
            except Exception:
                pass

        asyncio.create_task(_persist_bg())

        logger.info(f"[Upload] ✅ '{original_filename}' → {len(chunks)} chunks | chat='{chat_id}'")

        return UploadResponse(
            message="Document indexed successfully",
            filename=original_filename,
            document_id=document_id,
            chat_id=chat_id,
            chunks_created=len(chunks),
            file_url=raw_file_url,
            pdf_url=pdf_url,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Upload] Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/documents",
    summary="List all uploaded documents for the authenticated user",
    tags=["Documents"],
)
async def list_documents(user_id: str = Depends(get_current_user)):
    docs = []
    seen = set()

    # 1. Check MongoDB documents collection
    try:
        from app.services.database import get_documents_collection
        cursor = get_documents_collection().find({"user_id": user_id})
        async for d in cursor:
            doc_id = d["_id"]
            if doc_id not in seen:
                seen.add(doc_id)
                docs.append({
                    "document_id": doc_id,
                    "filename": d.get("filename", "Document"),
                    "chat_id": "chat_" + doc_id[4:],
                    "num_chunks": d.get("num_chunks", 12),
                    "file_url": d.get("file_url"),
                    "pdf_url": d.get("pdf_url"),
                    "upload_time": str(d.get("upload_time", "")),
                })
    except Exception as e:
        logger.warning(f"[ListDocs] Mongo search skipped: {e}")

    # 2. Scan disk directory vectorstore/<user_id>/ as fallback
    user_vec_dir = os.path.join(settings.VECTORSTORE_DIR, user_id)
    if os.path.exists(user_vec_dir):
        for entry in os.scandir(user_vec_dir):
            if entry.is_dir():
                doc_id = entry.name
                if doc_id not in seen:
                    seen.add(doc_id)
                    docs_dir = settings.DOCUMENTS_DIR
                    matched_file = f"Document_{doc_id[:8]}"
                    if os.path.exists(docs_dir):
                        for f in os.listdir(docs_dir):
                            if doc_id[4:10] in f:
                                matched_file = f
                                break

                    file_url = _file_url(os.path.join(docs_dir, matched_file))
                    docs.append({
                        "document_id": doc_id,
                        "filename": matched_file,
                        "chat_id": "chat_" + doc_id[4:],
                        "num_chunks": 12,
                        "file_url": file_url,
                        "pdf_url": file_url if matched_file.endswith(".pdf") else None,
                        "upload_time": None,
                    })

    # Also scan default user vectorstore if empty
    if not docs:
        default_dir = os.path.join(settings.VECTORSTORE_DIR, "default")
        if os.path.exists(default_dir):
            for entry in os.scandir(default_dir):
                if entry.is_dir():
                    doc_id = entry.name
                    if doc_id not in seen:
                        seen.add(doc_id)
                        docs.append({
                            "document_id": doc_id,
                            "filename": f"Document_{doc_id[4:10]}",
                            "chat_id": "chat_" + doc_id[4:],
                            "num_chunks": 12,
                            "file_url": None,
                            "pdf_url": None,
                            "upload_time": None,
                        })

    return docs
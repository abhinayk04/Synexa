import logging

from fastapi import APIRouter, HTTPException, Depends

from app.models.request_models import QueryRequest
from app.models.response_models import QueryResponse, SourceDocument
from app.services.rag_pipeline import run_rag_pipeline, stream_rag_pipeline
from app.services.auth import get_current_user
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/ask",
    response_model=QueryResponse,
    summary="Ask a question about a document via chat_id",
    tags=["Question Answering"],
)
async def ask_question(
    request: QueryRequest,
    user_id: str = Depends(get_current_user),
):
    chat_id = request.chat_id
    doc_id = request.document_id

    logger.info(
        f"[Query] user='{user_id}' chat='{chat_id}' "
        f"mode='{request.mode}' q='{request.question[:80]}'"
    )

    if chat_id:
        try:
            from app.services.memory import get_chat
            chat_doc = await get_chat(chat_id)
            if chat_doc and chat_doc.get("user_id") and chat_doc["user_id"] != user_id:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this chat.",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[Query] Chat lookup warning: {e}")

    try:
        result = await run_rag_pipeline(
            question=request.question,
            mode=request.mode,
            chat_id=chat_id,
            user_id=user_id,
            document_id=doc_id or "default",
            document_ids=request.document_ids,
        )

        sources = [
            SourceDocument(document=s["document"], page=s["page"])
            for s in result.get("sources", [])
        ]

        return QueryResponse(
            answer=result["answer"],
            sources=sources,
            confidence=result["confidence"],
            mode=result["mode"],
            chat_id=result.get("chat_id"),
            document_id=result.get("document_id"),
        )

    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Query] Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/ask/stream",
    summary="Ask a question with real-time SSE token streaming",
    tags=["Question Answering"],
)
async def ask_question_stream(
    request: QueryRequest,
    user_id: str = Depends(get_current_user),
):
    chat_id = request.chat_id
    doc_id = request.document_id

    if chat_id:
        try:
            from app.services.memory import get_chat
            chat_doc = await get_chat(chat_id)
            if chat_doc and chat_doc.get("user_id") and chat_doc["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Access denied.")
        except HTTPException:
            raise
        except Exception:
            pass

    generator = stream_rag_pipeline(
        question=request.question,
        mode=request.mode,
        chat_id=chat_id,
        user_id=user_id,
        document_id=doc_id or "default",
        document_ids=request.document_ids,
    )

    return StreamingResponse(generator, media_type="text/event-stream")


@router.get(
    "/chats",
    summary="List all chats for the authenticated user",
    tags=["Question Answering"],
)
async def list_chats(user_id: str = Depends(get_current_user)):
    try:
        from app.services.memory import get_user_chats
        chats = await get_user_chats(user_id)
        return [
            {
                "chat_id": c["_id"],
                "document_id": c["document_id"],
                "title": c.get("title", ""),
                "created_at": c["created_at"].isoformat() if hasattr(c.get("created_at"), "isoformat") else str(c.get("created_at", "")),
                "updated_at": c["updated_at"].isoformat() if hasattr(c.get("updated_at"), "isoformat") else str(c.get("updated_at", "")),
            }
            for c in chats
        ]
    except Exception as e:
        logger.error(f"[Query] list_chats error: {e}", exc_info=True)
        return []


@router.get(
    "/chat/{chat_id}/history",
    summary="Get message history for a specific chat",
    tags=["Question Answering"],
)
async def get_chat_history(
    chat_id: str,
    user_id: str = Depends(get_current_user),
):
    try:
        from app.services.memory import get_chat
        chat_doc = await get_chat(chat_id)
        if not chat_doc:
            return {"chat_id": chat_id, "document_id": "default", "title": "", "messages": []}
        if chat_doc.get("user_id") and chat_doc["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied.")
        return {
            "chat_id": chat_id,
            "document_id": chat_doc["document_id"],
            "title": chat_doc.get("title", ""),
            "messages": chat_doc.get("messages", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"chat_id": chat_id, "document_id": "default", "title": "", "messages": []}


@router.delete(
    "/chat/{chat_id}",
    summary="Delete a chat session",
    tags=["Question Answering"],
)
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user),
):
    try:
        from app.services.memory import delete_chat as _delete
        await _delete(chat_id, user_id)
        return {"message": f"Chat '{chat_id}' deleted."}
    except Exception as e:
        return {"message": f"Chat '{chat_id}' deleted."}


async def _perform_document_deletion(document_id: str, user_id: str):
    deleted = {"vectorstore": False, "document": False, "chats_deleted": 0}

    try:
        from app.services.vector_store import delete_document_index
        deleted["vectorstore"] = delete_document_index(user_id, document_id)
    except Exception as e:
        logger.warning(f"[DeleteDoc] Vectorstore deletion failed: {e}")

    try:
        from app.services.database import get_documents_collection
        result = await get_documents_collection().delete_one(
            {"_id": document_id, "user_id": user_id}
        )
        deleted["document"] = result.deleted_count > 0
    except Exception as e:
        logger.warning(f"[DeleteDoc] Document MongoDB deletion failed: {e}")

    try:
        from app.services.database import get_chats_collection
        result = await get_chats_collection().delete_many(
            {"document_id": document_id, "user_id": user_id}
        )
        deleted["chats_deleted"] = result.deleted_count
    except Exception as e:
        logger.warning(f"[DeleteDoc] Chat deletion failed: {e}")

    return {
        "message": f"Document '{document_id}' and all its data deleted.",
        "deleted": deleted,
    }


@router.delete("/document/{document_id}", summary="Delete a document and all its data", tags=["Documents"])
async def delete_document_singular(document_id: str, user_id: str = Depends(get_current_user)):
    return await _perform_document_deletion(document_id, user_id)


@router.delete("/documents/{document_id}", summary="Delete a document (plural endpoint)", tags=["Documents"])
async def delete_document_plural(document_id: str, user_id: str = Depends(get_current_user)):
    return await _perform_document_deletion(document_id, user_id)
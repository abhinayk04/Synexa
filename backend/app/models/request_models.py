from pydantic import BaseModel, Field
from typing import Literal, Optional, List


class QueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        example="What is this document about?",
    )

    mode: Literal["simple", "detailed", "exam"] = Field(
        default="simple",
    )

    chat_id: Optional[str] = Field(
        default=None,
        description="chat_id for the chat session.",
        example="chat_abc123def456",
    )

    document_id: Optional[str] = Field(
        default=None,
        description="Single active document_id.",
        example="doc_abc123def456",
    )

    document_ids: Optional[List[str]] = Field(
        default=None,
        description="List of document_ids for Multi-Document RAG search across multiple selected files.",
        example=["doc_123", "doc_456"],
    )
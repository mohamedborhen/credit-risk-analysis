"""
Pydantic schemas for chatbot endpoint.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """POST /chat request body."""

    user_id: str | int = Field(
        ...,
        description="User identifier. Accepts UUID string or numeric id.",
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User message for the AI assistant.",
    )


class ChatResponse(BaseModel):
    """POST /chat response body."""

    answer: str
    data: dict[str, Any]

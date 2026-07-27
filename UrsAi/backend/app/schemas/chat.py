"""Pydantic schemas for the chat persistence endpoints (Sprint 7 Part 3).

The endpoint surface is:

  POST   /api/v1/chat                 create a new conversation
  GET    /api/v1/chat                 list the user's conversations
  GET    /api/v1/chat/{id}            fetch a conversation + messages
  DELETE /api/v1/chat/{id}            delete a conversation
  POST   /api/v1/chat/{id}/message    append a user message, get a reply

All response models use :class:`pydantic.BaseModel` with
``model_config = ConfigDict(extra="forbid")`` so an upstream
refactor that adds a new field fails loudly at the API boundary
instead of silently shipping a shape the UI does not know how to
render.

Every schema is **owner-scoped** at the endpoint layer — a
conversation belongs to the authenticated user, and a request for
another user's conversation returns 404, never 403, so the
resource's existence is not leaked.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Conversation source — what the assistant reply drew on
# --------------------------------------------------------------------------- #


class ChatSource(BaseModel):
    """One source the assistant reply leaned on."""

    model_config = ConfigDict(extra="forbid")

    topic: Literal[
        "Twin",
        "Recommendations",
        "Roadmap",
        "Insights",
        "Rules",
        "Business DNA",
        "Export",
        # Sprint 7 Part 4 — knowledge retrieval sources.
        "Knowledge",
        "Rule",
        "Recommendation",
        "GovernmentScheme",
        "Glossary",
    ]
    detail: str = Field(min_length=1, max_length=500)


# --------------------------------------------------------------------------- #
# Messages
# --------------------------------------------------------------------------- #


class ChatMessageOut(BaseModel):
    """One message in a conversation. Returned by GET /chat/{id}."""

    model_config = ConfigDict(extra="forbid")

    id: int
    role: Literal["user", "assistant"]
    kind: str = ""
    content: str = Field(min_length=1)
    sources: list[ChatSource] = Field(default_factory=list)
    created_at: datetime


# --------------------------------------------------------------------------- #
# Conversation
# --------------------------------------------------------------------------- #


class ChatSessionSummary(BaseModel):
    """A conversation as it appears in the sidebar / list endpoint."""

    model_config = ConfigDict(extra="forbid")

    id: int
    title: str
    summary: str
    message_count: int = Field(ge=0)
    last_model: str = ""
    fallback_used: bool
    created_at: datetime
    updated_at: datetime


class ChatSessionDetail(BaseModel):
    """A conversation with every message inline."""

    model_config = ConfigDict(extra="forbid")

    id: int
    title: str
    summary: str
    message_count: int = Field(ge=0)
    last_model: str = ""
    fallback_used: bool
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Request envelopes
# --------------------------------------------------------------------------- #


class ChatSessionCreateRequest(BaseModel):
    """Body for POST /chat (create a new conversation)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="", max_length=120)


class ChatMessageCreateRequest(BaseModel):
    """Body for POST /chat/{id}/message (append a user message)."""

    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=4000)


# --------------------------------------------------------------------------- #
# Response envelopes
# --------------------------------------------------------------------------- #


class ChatMessageAppendResponse(BaseModel):
    """Reply body for POST /chat/{id}/message."""

    model_config = ConfigDict(extra="forbid")

    user_message: ChatMessageOut
    assistant_message: ChatMessageOut
    session: ChatSessionDetail


class ChatSessionListResponse(BaseModel):
    """Reply body for GET /chat."""

    model_config = ConfigDict(extra="forbid")

    sessions: list[ChatSessionSummary]
    count: int = Field(ge=0)


class ChatDeleteResponse(BaseModel):
    """Reply body for DELETE /chat/{id}."""

    model_config = ConfigDict(extra="forbid")

    deleted: bool
    id: int
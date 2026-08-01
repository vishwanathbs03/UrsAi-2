"""ORM models for the chat persistence layer (Sprint 7 Part 3).

Two tables back the assistant conversation memory:

  * :class:`ChatSession` — one row per conversation. Owner-scoped.
  * :class:`ChatMessage` — one row per turn. Append-only.

The models are intentionally narrow:

  * No relationship back to the Business row. The chat is
    business-aware through the assistant provider's
    :class:`AssistantContext`, but the chat itself is a
    user-level artefact, not a business-level one. Multiple
    conversations can share the same business profile.

  * No vector / embedding column. RAG and semantic search are
    out of scope.

  * No "share with collaborator" column. Multi-user
    collaboration is out of scope.

The cascade is set at the FK level: deleting a user drops
their sessions, and deleting a session drops its messages.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


if TYPE_CHECKING:
    from app.models.user import User


class ChatSession(Base):
    """A conversation between a user and the AI Assistant."""

    __tablename__ = "chat_sessions"

    # SQLite's autoincrement only works on INTEGER (32-bit),
    # not BIGINT. Every other backend in this project uses
    # Integer for primary keys, so we follow the same
    # convention here. The Integer range (~2.1e9 rows) is
    # far beyond any realistic chat-history count.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_model: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ChatMessage.id",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<ChatSession id={self.id} owner={self.owner_id} title={self.title!r}>"


class ChatMessage(Base):
    """One turn in a :class:`ChatSession`. Append-only by convention."""

    __tablename__ = "chat_messages"

    # See ChatSession.id for why Integer, not BigInteger.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Role: "user" or "assistant". Keep it a string column so
    # future roles (e.g. "system") do not require a migration.
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    # Kind: matches the QueryKind strings in
    # frontend/features/assistant/classify-query.ts. Empty
    # string when the message is not yet classified.
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="")

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Per-message sources echoed for the UI. Empty list for
    # user messages. JSON-encoded so a future schema change can
    # add fields without a migration.
    sources_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    session: Mapped["ChatSession"] = relationship(back_populates="messages")

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<ChatMessage id={self.id} session={self.session_id} role={self.role}>"
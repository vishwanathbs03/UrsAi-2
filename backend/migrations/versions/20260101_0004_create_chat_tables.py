"""create chat_sessions + chat_messages tables

Revision ID: 20260101_0004
Revises: 20260101_0003
Create Date: 2026-07-26 00:00:00

Sprint 7 — Part 3 (Conversation Memory).

Two new tables that back the Assistant conversation persistence
layer:

  * chat_sessions
      One row per conversation a user has started. Owner-scoped
      via FK to users.id. A title (auto-derived from the first
      message, never empty) + a rolling summary (capped) so the
      UI can render a sidebar without fetching every message.

  * chat_messages
      One row per turn (user prompt or assistant reply).
      Append-only by convention; never edited in place. The
      ``role`` column is a string literal "user" or "assistant".
      The ``kind`` column is the classifier's QueryKind
      (improve_business, low_score, ... "fallback") so the UI
      can badge the message and the backend can replay it into
      the assistant's history without re-classifying.

Both tables follow the existing Atlas AI conventions:

  * id is a BIGINT autoincrement primary key
  * created_at / updated_at are tz-aware datetimes
  * every foreign key uses ON DELETE CASCADE so deleting a user
    or a session cleans up the rows automatically
  * indexes on the owner_id + updated_at combo so the
    "list my conversations, newest first" query is a single
    index scan

What this migration is NOT
--------------------------

  * It does NOT add conversation-level ACLs or sharing. The
    brief explicitly forbids multi-user collaboration.
  * It does NOT add a vector / embedding column. The brief
    forbids RAG and semantic search.
  * It does NOT add conversation memory to the AI Decision
    Engine or the Copilot. The new tables are owned by the
    chat surface only.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260101_0004"
down_revision: Union[str, None] = "20260101_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- chat_sessions ------------------------------------------------- #
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # A short human-readable title. Auto-derived from the
        # first user message (truncated to 120 chars); the
        # caller may pass an explicit title when creating a
        # session.
        sa.Column("title", sa.String(length=120), nullable=False, server_default=""),
        # The conversation summary, recomputed lazily by the
        # service on append-message. Stored so the UI can
        # render the sidebar without joining chat_messages.
        # Capped at 500 chars.
        sa.Column("summary", sa.String(length=500), nullable=False, server_default=""),
        sa.Column(
            "message_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        # The model that produced the most recent assistant
        # reply ("deterministic-fallback", "ollama:llama3.1",
        # etc.). Empty when the session has only user
        # messages.
        sa.Column("last_model", sa.String(length=80), nullable=False, server_default=""),
        sa.Column(
            "fallback_used",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("owner_id", "id", name="uq_chat_sessions_owner_id"),
    )
    op.create_index(
        "ix_chat_sessions_owner_updated",
        "chat_sessions",
        ["owner_id", "updated_at"],
    )

    # ---- chat_messages ------------------------------------------------- #
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Role + kind: see app.services.chat.types for the
        # allowed values. role is "user" or "assistant";
        # kind is one of the QueryKind strings from
        # classify-query.ts (e.g. "improve_business",
        # "fallback").
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False, server_default=""),
        # The literal message body. Plain text — the assistant
        # renders it as paragraphs / bullets the same way the
        # Sprint 7 Part 1 builder does.
        sa.Column("content", sa.Text(), nullable=False),
        # Per-message sources echoed in the API response so the
        # UI can re-render the source list without a separate
        # call. Empty for user messages.
        sa.Column("sources_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_chat_messages_session_id",
        "chat_messages",
        ["session_id", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_session_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_sessions_owner_updated", table_name="chat_sessions")
    op.drop_table("chat_sessions")
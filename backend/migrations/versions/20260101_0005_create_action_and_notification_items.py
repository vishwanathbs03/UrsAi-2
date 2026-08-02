"""create action_items + notification_items tables

Revision ID: 20260101_0005
Revises: 20260101_0004
Create Date: 2026-08-02 00:00:00

Sprint H2 — Database, Migration & Deployment Integrity.

The Action Board (Sprint 4 Part 2) and Notification surface (Sprint 4
Part 3) were added to the application code, but the corresponding
ORM models were never registered with the models package nor captured
by a migration. As a result:

  * ``app.models.__init__`` did not re-export
    ``ActionItem`` / ``NotificationItem``
  * ``Base.metadata`` only knew about 10 of the 12 declarative
    classes, so a ``create_all`` from a clean process produced a
    partial schema
  * ``alembic upgrade head`` on a brand-new database created all
    the other tables but left ``action_items`` /
    ``notification_items`` missing, which made
    ``GET /api/v1/action-board`` and
    ``GET /api/v1/notifications`` fail with
    ``OperationalError: no such table``.

This migration adds the two missing tables so the migration history
is the single source of truth for the schema. The columns mirror
the ORM models 1:1.

Why this is a fresh migration (not an edit of an earlier one)
------------------------------------------------------------

The four earlier migrations were shipped in the v1.0.0 release
tag. Re-writing them to add new tables would force every existing
operator to re-run ``alembic stamp`` or rebuild their database.
A new revision with a fresh ``down_revision`` of
``20260101_0004`` keeps the existing history immutable and the
upgrade path linear.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260101_0005"
down_revision: Union[str, None] = "20260101_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- action_items ------------------------------------------------- #
    op.create_table(
        "action_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="To Do"),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="Medium"),
        sa.Column("due_date", sa.String(length=50), nullable=True),
        sa.Column(
            "is_completed",
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
    )
    op.create_index("ix_action_items_owner_id", "action_items", ["owner_id"])

    # ---- notification_items ------------------------------------------ #
    op.create_table(
        "notification_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="general"),
        sa.Column(
            "is_read",
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
    )
    op.create_index("ix_notification_items_owner_id", "notification_items", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_items_owner_id", table_name="notification_items")
    op.drop_table("notification_items")
    op.drop_index("ix_action_items_owner_id", table_name="action_items")
    op.drop_table("action_items")

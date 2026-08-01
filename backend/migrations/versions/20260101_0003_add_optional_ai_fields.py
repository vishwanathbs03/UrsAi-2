"""add optional AI-support fields

Revision ID: 20260101_0003
Revises: 20260101_0002
Create Date: 2026-01-01 00:00:00

Adds two nullable columns for future AI support. Existing rows
remain valid (NULL is acceptable on both).

  * businesses.production_capacity_unit  String(50)
      Free-text unit label paired with production_capacity
      (e.g. "meters / month", "kg / week", "units / shift").
  * business_goals.target_date          Date
      Optional deadline for a goal — distinct from the existing
      ``timeframe`` free-text field ("6m", "Q3").

All other fields from the AI-support request
(revenue_currency, goal_priority, challenge_severity) already
exist on the schema; this migration only adds the two brand-new
columns.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260101_0003"
down_revision: Union[str, None] = "20260101_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("production_capacity_unit", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "business_goals",
        sa.Column("target_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("business_goals", "target_date")
    op.drop_column("businesses", "production_capacity_unit")

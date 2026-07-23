"""create business digital twin tables

Revision ID: 20260101_0002
Revises: 20260101_0001
Create Date: 2026-01-01 00:00:00

Adds the normalized schema for the Business Digital Twin:

  businesses
  products
  certifications
  digital_presence         (one-to-one)
  export_history
  business_goals
  business_challenges

Every child table FKs ``businesses.id`` with ON DELETE CASCADE so
deleting a business cleans up its nested rows in a single statement.
``digital_presence.business_id`` is also UNIQUE to enforce the
one-to-one shape at the storage layer.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260101_0002"
down_revision: Union[str, None] = "20260101_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- businesses --------------------------------------------------
    op.create_table(
        "businesses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("owner_id", name="uq_businesses_owner_id"),
        sa.Column("legal_name", sa.String(length=200), nullable=False),
        sa.Column("trade_name", sa.String(length=200), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=False),
        sa.Column("sub_industry", sa.String(length=100), nullable=True),
        sa.Column("business_type", sa.String(length=50), nullable=True),
        sa.Column("established_year", sa.Integer(), nullable=False),
        sa.Column("employee_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("annual_revenue", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "revenue_currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
        ),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("state_region", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("production_capacity", sa.String(length=500), nullable=True),
        sa.Column("capacity_utilization_pct", sa.Integer(), nullable=True),
        sa.Column("monthly_production_units", sa.Integer(), nullable=True),
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
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_businesses_owner_id", "businesses", ["owner_id"])
    op.create_index("ix_businesses_industry", "businesses", ["industry"])

    # ---- products ----------------------------------------------------
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_id",
            sa.Integer(),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("hs_code", sa.String(length=20), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("unit_price", sa.Float(), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
        ),
        sa.Column("monthly_volume", sa.Integer(), nullable=True),
        sa.Column(
            "is_exported",
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
    )
    op.create_index("ix_products_business_id", "products", ["business_id"])

    # ---- certifications ---------------------------------------------
    op.create_table(
        "certifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_id",
            sa.Integer(),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("issuing_body", sa.String(length=200), nullable=True),
        sa.Column("issued_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("certificate_number", sa.String(length=100), nullable=True),
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
    op.create_index("ix_certifications_business_id", "certifications", ["business_id"])

    # ---- digital_presence (1:1) -------------------------------------
    op.create_table(
        "digital_presence",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_id",
            sa.Integer(),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("business_id", name="uq_digital_presence_business_id"),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("linkedin_url", sa.String(length=500), nullable=True),
        sa.Column("facebook_url", sa.String(length=500), nullable=True),
        sa.Column("instagram_url", sa.String(length=500), nullable=True),
        sa.Column("twitter_url", sa.String(length=500), nullable=True),
        sa.Column("youtube_url", sa.String(length=500), nullable=True),
        sa.Column(
            "has_ecommerce",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("ecommerce_platform", sa.String(length=100), nullable=True),
        sa.Column(
            "uses_digital_marketing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "uses_cloud_systems",
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
    )
    op.create_index("ix_digital_presence_business_id", "digital_presence", ["business_id"])

    # ---- export_history ---------------------------------------------
    op.create_table(
        "export_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_id",
            sa.Integer(),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("destination_country", sa.String(length=100), nullable=False),
        sa.Column("product_category", sa.String(length=100), nullable=True),
        sa.Column("first_export_date", sa.Date(), nullable=True),
        sa.Column("annual_export_value", sa.Float(), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
        ),
        sa.Column("iec_number", sa.String(length=50), nullable=True),
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
    op.create_index("ix_export_history_business_id", "export_history", ["business_id"])

    # ---- business_goals ---------------------------------------------
    op.create_table(
        "business_goals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_id",
            sa.Integer(),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("timeframe", sa.String(length=50), nullable=True),
        sa.Column(
            "priority",
            sa.String(length=20),
            nullable=False,
            server_default="medium",
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
    )
    op.create_index("ix_business_goals_business_id", "business_goals", ["business_id"])

    # ---- business_challenges ----------------------------------------
    op.create_table(
        "business_challenges",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_id",
            sa.Integer(),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "severity",
            sa.String(length=20),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("category", sa.String(length=100), nullable=True),
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
        "ix_business_challenges_business_id", "business_challenges", ["business_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_business_challenges_business_id", table_name="business_challenges")
    op.drop_table("business_challenges")

    op.drop_index("ix_business_goals_business_id", table_name="business_goals")
    op.drop_table("business_goals")

    op.drop_index("ix_export_history_business_id", table_name="export_history")
    op.drop_table("export_history")

    op.drop_index("ix_digital_presence_business_id", table_name="digital_presence")
    op.drop_table("digital_presence")

    op.drop_index("ix_certifications_business_id", table_name="certifications")
    op.drop_table("certifications")

    op.drop_index("ix_products_business_id", table_name="products")
    op.drop_table("products")

    op.drop_index("ix_businesses_industry", table_name="businesses")
    op.drop_index("ix_businesses_owner_id", table_name="businesses")
    op.drop_table("businesses")

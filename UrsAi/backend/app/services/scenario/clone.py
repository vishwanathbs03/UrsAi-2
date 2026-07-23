"""Deep-clone a Business row + nested collections into
an isolated in-memory session.

The cloner is the *only* place that mutates the cloned
Business. After :func:`clone_business_into` returns, the
cloned business is a fully-detached, fully-populated
ORM row living in the in-memory session — no reference
to the request session remains.

The cloning strategy is:

  1. Read every field on the source row.
  2. Construct a fresh ORM instance with those fields.
  3. Add the instance to the in-memory session.
  4. Repeat for every nested row (one-to-many and the
     one-to-one ``DigitalPresence``).

The new instance has a fresh ``id`` (autoincrement), so
the in-memory schema's primary key sequences are used.
The in-memory session's foreign keys are satisfied
because we add the parent first, then the children.

Determinism note
----------------

The clone preserves the *order* of nested collections
because the source's lists are iterated in their
SQLAlchemy-cached order (insertion order for
relationship-loaded lists). The new in-memory rows are
inserted in the same order, so the engines see the
same iteration sequence.
"""

from __future__ import annotations

import copy
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.business_challenge import BusinessChallenge
from app.models.business_goal import BusinessGoal
from app.models.certification import Certification
from app.models.digital_presence import DigitalPresence
from app.models.export_history import ExportHistory
from app.models.product import Product


def clone_business_into(
    *,
    source: Business,
    target_session: Session,
    new_owner_id: int,
) -> Business:
    """Clone ``source`` (a fully-loaded Business row) into
    ``target_session`` and return the new row.

    The new row is fully detached from the source
    session — mutating it does not affect the source
    row or any other row in the request database.

    ``new_owner_id`` is the owner_id the cloned row
    should report. The simulation uses a sentinel
    owner_id (``-1``) so the in-memory row never
    collides with a real user.
    """
    new_row = Business(
        owner_id=new_owner_id,
        legal_name=source.legal_name,
        trade_name=source.trade_name,
        industry=source.industry,
        sub_industry=source.sub_industry,
        business_type=source.business_type,
        established_year=source.established_year,
        employee_count=source.employee_count,
        annual_revenue=source.annual_revenue,
        revenue_currency=source.revenue_currency,
        description=source.description,
        country=source.country,
        state_region=source.state_region,
        city=source.city,
        production_capacity=source.production_capacity,
        production_capacity_unit=source.production_capacity_unit,
        capacity_utilization_pct=source.capacity_utilization_pct,
        monthly_production_units=source.monthly_production_units,
        is_completed=source.is_completed,
    )
    target_session.add(new_row)
    target_session.flush()  # assigns new_row.id

    # ---- One-to-one: digital presence -------------------- #
    if source.digital_presence is not None:
        src = source.digital_presence
        presence = DigitalPresence(
            business_id=new_row.id,
            website_url=src.website_url,
            linkedin_url=src.linkedin_url,
            facebook_url=src.facebook_url,
            instagram_url=src.instagram_url,
            twitter_url=src.twitter_url,
            youtube_url=src.youtube_url,
            has_ecommerce=src.has_ecommerce,
            ecommerce_platform=src.ecommerce_platform,
            uses_digital_marketing=src.uses_digital_marketing,
            uses_cloud_systems=src.uses_cloud_systems,
        )
        target_session.add(presence)

    # ---- One-to-many collections ------------------------- #
    for src in source.products:
        target_session.add(
            Product(
                business_id=new_row.id,
                name=src.name,
                category=src.category,
                hs_code=src.hs_code,
                description=src.description,
                unit_price=src.unit_price,
                currency=src.currency,
                monthly_volume=src.monthly_volume,
                is_exported=src.is_exported,
            )
        )

    for src in source.certifications:
        target_session.add(
            Certification(
                business_id=new_row.id,
                name=src.name,
                issuing_body=src.issuing_body,
                issued_date=_copy_date(src.issued_date),
                expiry_date=_copy_date(src.expiry_date),
                certificate_number=src.certificate_number,
            )
        )

    for src in source.export_history:
        target_session.add(
            ExportHistory(
                business_id=new_row.id,
                destination_country=src.destination_country,
                product_category=src.product_category,
                first_export_date=_copy_date(src.first_export_date),
                annual_export_value=src.annual_export_value,
                currency=src.currency,
                iec_number=src.iec_number,
            )
        )

    for src in source.goals:
        target_session.add(
            BusinessGoal(
                business_id=new_row.id,
                title=src.title,
                description=src.description,
                timeframe=src.timeframe,
                priority=src.priority,
                target_date=_copy_date(src.target_date),
            )
        )

    for src in source.challenges:
        target_session.add(
            BusinessChallenge(
                business_id=new_row.id,
                title=src.title,
                description=src.description,
                severity=src.severity,
                category=src.category,
            )
        )

    target_session.flush()
    # Refresh so relationships load after the flush.
    target_session.refresh(new_row)
    return new_row


def _copy_date(value: date | None) -> date | None:
    """Return a fresh ``date`` object so the in-memory
    row does not share a Python reference with the
    source row's date. SQLAlchemy does not require a
    fresh reference, but the explicit copy makes the
    isolation intent obvious in the diff."""
    if value is None:
        return None
    return date(value.year, value.month, value.day)

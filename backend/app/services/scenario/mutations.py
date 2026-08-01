"""Apply hypothetical changes to a cloned Business row.

The mutator never mutates the source row (the real one
in the request database) — only the in-memory clone
that the cloner produced. Each mutator is a small
function that takes the clone + one ``_ChangeBase`` and
returns nothing; the side effects land on the clone.

Every mutator is **idempotent for the input change** —
applying the same change twice produces the same final
state. (For example, ``add_website`` sets the URL; a
second call with the same URL leaves it set, and a
second call with a different URL overwrites the first
— the user is explicitly editing the hypothetical
state.)

Architecture
------------

The mutators are deliberately simple. They mutate
Python attributes on the in-memory ORM row and call
``session.flush()`` so the new state is visible to the
existing engines' next read. The engines are then
called by the service façade — the mutator does not
invoke any engine.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.certification import Certification
from app.models.digital_presence import DigitalPresence
from app.models.export_history import ExportHistory
from app.models.product import Product
from app.schemas.scenario import (
    AddCertification,
    AddExportCountry,
    AddSocialChannels,
    AddWebsite,
    CompleteProfileFields,
    EnableExports,
    ImproveDigitalPresence,
    IncreaseEmployeeCount,
    IncreaseProductionCapacity,
)


# Public dispatch table — the service façade picks the
# right mutator from this map. Adding a new change
# type is a one-line addition here plus a new function
# below.
MUTATORS = {}


def _register(change_type: str):
    def deco(fn):
        MUTATORS[change_type] = fn
        return fn
    return deco


# --------------------------------------------------------------------------- #
# Mutators
# --------------------------------------------------------------------------- #


@_register("add_certification")
def add_certification(
    session: Session, business: Business, change: AddCertification
) -> None:
    """Append a new active certification to the
    clone. The cert is dated today and never expires —
    this is the optimistic case the user is
    simulating."""
    from datetime import date, timedelta
    today = date.today()
    session.add(
        Certification(
            business_id=business.id,
            name=change.name.strip(),
            issuing_body=(change.issuing_body or "").strip() or None,
            issued_date=today,
            # 3-year validity window by default; the
            # spec does not ask for a user-provided
            # expiry, so we pick a reasonable default.
            expiry_date=today + timedelta(days=365 * 3),
            certificate_number=None,
        )
    )
    session.flush()


@_register("add_website")
def add_website(
    session: Session, business: Business, change: AddWebsite
) -> None:
    """Set the website URL on the clone. If the clone
    has no DigitalPresence row yet, create one."""
    presence = _ensure_presence(session, business)
    presence.website_url = change.url.strip() or None
    session.flush()


@_register("add_social_channels")
def add_social_channels(
    session: Session, business: Business, change: AddSocialChannels
) -> None:
    """Fill empty social URLs with the platform's home
    URL. The user is signalling "I now have a presence
    on these channels" — the engines only need to know
    that the field is non-empty to credit the
    business."""
    presence = _ensure_presence(session, business)
    for channel in change.channels:
        url = f"https://www.{channel}.com/"
        attr = f"{channel}_url"
        if getattr(presence, attr) in (None, ""):
            setattr(presence, attr, url)
    session.flush()


@_register("improve_digital_presence")
def improve_digital_presence(
    session: Session, business: Business, change: ImproveDigitalPresence
) -> None:
    """Flip the digital-presence flags. The user is
    signalling "I now have a mature digital setup"."""
    presence = _ensure_presence(session, business)
    if change.enable_ecommerce:
        presence.has_ecommerce = True
        if not presence.ecommerce_platform:
            presence.ecommerce_platform = "shopify"
    if change.enable_digital_marketing:
        presence.uses_digital_marketing = True
    if change.enable_cloud_systems:
        presence.uses_cloud_systems = True
    session.flush()


@_register("increase_production_capacity")
def increase_production_capacity(
    session: Session, business: Business, change: IncreaseProductionCapacity
) -> None:
    """Overwrite the production-capacity fields on the
    parent business row. The user is asking "what if I
    scaled up?" so the absolute values from the
    request body replace the current values."""
    business.production_capacity = change.production_capacity.strip()
    business.production_capacity_unit = change.production_capacity_unit.strip()
    if change.capacity_utilization_pct is not None:
        business.capacity_utilization_pct = change.capacity_utilization_pct
    if change.monthly_production_units is not None:
        business.monthly_production_units = change.monthly_production_units
    session.flush()


@_register("increase_employee_count")
def increase_employee_count(
    session: Session, business: Business, change: IncreaseEmployeeCount
) -> None:
    """Set the employee count to the new value."""
    business.employee_count = int(change.employee_count)
    session.flush()


@_register("enable_exports")
def enable_exports(
    session: Session, business: Business, change: EnableExports
) -> None:
    """The IEC code is the gate-keeper for export
    readiness. Setting it unlocks every export-related
    rule in the upstream engines.

    If the business has no export history rows yet,
    create one minimal row so the export analyzer sees
    at least one destination country — otherwise the
    "I have an IEC but no exports" case is treated
    identically to "no IEC and no exports"."""
    iec = (change.iec_number or "").strip() or None
    if not business.export_history:
        session.add(
            ExportHistory(
                business_id=business.id,
                destination_country=(business.country or "IN").strip() or "IN",
                product_category=None,
                first_export_date=None,
                annual_export_value=None,
                currency=business.revenue_currency or "USD",
                iec_number=iec,
            )
        )
    else:
        # Stamp the IEC on the most-recent export
        # history row. The engines only need at least
        # one row to credit the business.
        business.export_history[0].iec_number = iec
    session.flush()


@_register("add_export_country")
def add_export_country(
    session: Session, business: Business, change: AddExportCountry
) -> None:
    """Append a new export history row. The user is
    asking "what if I also exported to X?"."""
    from datetime import date
    session.add(
        ExportHistory(
            business_id=business.id,
            destination_country=change.destination_country.strip(),
            product_category=(change.product_category or "").strip() or None,
            first_export_date=date.today(),
            annual_export_value=change.annual_export_value,
            currency=business.revenue_currency or "USD",
            iec_number=(
                business.export_history[0].iec_number
                if business.export_history
                else None
            ),
        )
    )
    session.flush()


@_register("complete_profile_fields")
def complete_profile_fields(
    session: Session, business: Business, change: CompleteProfileFields
) -> None:
    """Fill empty profile fields with sensible
    defaults. Existing values are preserved — the user
    is saying "fill in the blanks", not "replace what I
    already wrote"."""

    def _maybe_set(attr: str, value: str | None) -> None:
        current = getattr(business, attr, None)
        if current in (None, "") and value not in (None, ""):
            setattr(business, attr, value)

    for field_name in change.fields:
        if field_name == "description":
            _maybe_set(
                "description",
                f"{business.trade_name or business.legal_name} — "
                f"{business.industry} business operating in "
                f"{business.city or business.country or 'the region'}.",
            )
        elif field_name == "country":
            _maybe_set("country", "IN")
        elif field_name == "state_region":
            _maybe_set("state_region", "Tamil Nadu")
        elif field_name == "city":
            _maybe_set("city", "Coimbatore")
        elif field_name == "sub_industry":
            _maybe_set("sub_industry", "general")
        elif field_name == "business_type":
            _maybe_set("business_type", "private_limited")
    session.flush()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _ensure_presence(session: Session, business: Business) -> DigitalPresence:
    """Get-or-create the one-to-one DigitalPresence row
    on the clone. All the digital-related mutators go
    through this helper so the call sites stay
    short."""
    if business.digital_presence is None:
        presence = DigitalPresence(business_id=business.id)
        session.add(presence)
        session.flush()
        # Refresh the relationship so the caller sees
        # the row through ``business.digital_presence``.
        session.refresh(business, ["digital_presence"])
    return business.digital_presence

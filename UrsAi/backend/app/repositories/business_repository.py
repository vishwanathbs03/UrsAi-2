"""Repository for the Business Digital Twin.

The repository owns SQL access for every business-related table. The
service layer is the only consumer; endpoints never touch the
session directly.

Design notes
------------

* One business per user. ``get_by_owner`` enforces that invariant on
  the read path. ``create`` enforces it on the write path by raising
  ``BusinessAlreadyExists`` if the owner already has a row.
* The nested tables (products, certifications, ...) are not loaded
  lazily through relationships. The repository hydrates them with
  explicit queries after the parent row is fetched so we can compose
  them into a single ``BusinessOut`` deterministically.
* Updates replace the nested collections wholesale. This is the
  simplest contract for a wizard: PUT is the source of truth, the
  client sends the full new state for any section it changed.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.business import Business
from app.models.business_challenge import BusinessChallenge
from app.models.business_goal import BusinessGoal
from app.models.certification import Certification
from app.models.digital_presence import DigitalPresence
from app.models.export_history import ExportHistory
from app.models.product import Product


class BusinessError(Exception):
    """Base for business repository / service errors."""


class BusinessAlreadyExists(BusinessError):
    """Raised when a user tries to create a second business row."""


class BusinessNotFound(BusinessError):
    """Raised when the authenticated user has no business row."""


# Default relationship loaders — used by every read so the service
# never has to think about lazy loading.
_FULL_LOAD = (
    selectinload(Business.products),
    selectinload(Business.certifications),
    selectinload(Business.digital_presence),
    selectinload(Business.export_history),
    selectinload(Business.goals),
    selectinload(Business.challenges),
)


class BusinessRepository:
    """Data-access layer for the Business Digital Twin."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ---- Read ----------------------------------------------------------

    def get_by_owner(self, owner_id: int) -> Business | None:
        """Return the single business belonging to ``owner_id`` with
        every nested collection eagerly loaded, or ``None`` if the
        user has not created one yet.

        ``populate_existing`` forces SQLAlchemy to overwrite the
        cached relationship state on the in-session Business with a
        fresh read from the database. This is the contract callers
        rely on after a ``commit()`` — the post-commit read must be
        byte-identical to a follow-up GET.
        """
        stmt = (
            select(Business)
            .where(Business.owner_id == owner_id)
            .options(*_FULL_LOAD)
            .execution_options(populate_existing=True)
        )
        return self._db.scalar(stmt)

    def exists_for_owner(self, owner_id: int) -> bool:
        stmt = select(Business.id).where(Business.owner_id == owner_id)
        return self._db.scalar(stmt) is not None

    # ---- Create --------------------------------------------------------

    def create(
        self,
        *,
        owner_id: int,
        legal_name: str,
        industry: str,
        established_year: int,
        employee_count: int,
        annual_revenue: float,
        revenue_currency: str,
        trade_name: str | None = None,
        sub_industry: str | None = None,
        business_type: str | None = None,
        description: str | None = None,
        country: str | None = None,
        state_region: str | None = None,
        city: str | None = None,
        production_capacity: str | None = None,
        production_capacity_unit: str | None = None,
        capacity_utilization_pct: int | None = None,
        monthly_production_units: int | None = None,
        is_completed: bool = False,
    ) -> Business:
        """Insert a new business row for the owner. Raises
        ``BusinessAlreadyExists`` if the owner already has one."""
        if self.exists_for_owner(owner_id):
            raise BusinessAlreadyExists(
                "A business profile already exists for this account."
            )

        business = Business(
            owner_id=owner_id,
            legal_name=legal_name.strip(),
            trade_name=_clean(trade_name),
            industry=industry.strip(),
            sub_industry=_clean(sub_industry),
            business_type=business_type,
            established_year=established_year,
            employee_count=employee_count,
            annual_revenue=annual_revenue,
            revenue_currency=revenue_currency.upper(),
            description=_clean(description),
            country=_clean(country),
            state_region=_clean(state_region),
            city=_clean(city),
            production_capacity=_clean(production_capacity),
            production_capacity_unit=_clean(production_capacity_unit),
            capacity_utilization_pct=capacity_utilization_pct,
            monthly_production_units=monthly_production_units,
            is_completed=is_completed,
        )
        self._db.add(business)
        self._db.flush()  # assigns id, makes business.id available below
        return business

    # ---- Update --------------------------------------------------------

    def update_basic(
        self,
        business: Business,
        *,
        legal_name: str,
        industry: str,
        established_year: int,
        employee_count: int,
        annual_revenue: float,
        revenue_currency: str,
        trade_name: str | None = None,
        sub_industry: str | None = None,
        business_type: str | None = None,
        description: str | None = None,
        country: str | None = None,
        state_region: str | None = None,
        city: str | None = None,
    ) -> Business:
        business.legal_name = legal_name.strip()
        business.trade_name = _clean(trade_name)
        business.industry = industry.strip()
        business.sub_industry = _clean(sub_industry)
        business.business_type = business_type
        business.established_year = established_year
        business.employee_count = employee_count
        business.annual_revenue = annual_revenue
        business.revenue_currency = revenue_currency.upper()
        business.description = _clean(description)
        business.country = _clean(country)
        business.state_region = _clean(state_region)
        business.city = _clean(city)
        return business

    def update_capacity(
        self,
        business: Business,
        *,
        production_capacity: str | None = None,
        production_capacity_unit: str | None = None,
        capacity_utilization_pct: int | None = None,
        monthly_production_units: int | None = None,
    ) -> Business:
        business.production_capacity = _clean(production_capacity)
        business.production_capacity_unit = _clean(production_capacity_unit)
        business.capacity_utilization_pct = capacity_utilization_pct
        business.monthly_production_units = monthly_production_units
        return business

    def mark_complete(self, business: Business, completed: bool = True) -> Business:
        business.is_completed = completed
        return business

    # ---- Delete --------------------------------------------------------

    def delete(self, business: Business) -> None:
        self._db.delete(business)

    # ---- Nested collection helpers ------------------------------------
    #
    # The wizard replaces each nested collection wholesale. The pattern
    # is the same for every collection: clear + bulk insert. Cascade
    # delete on the relationship handles the cleanup.

    def replace_products(
        self, business: Business, products: list[dict]
    ) -> list[Product]:
        return _replace_collection(
            self._db,
            business,
            business_attr="products",
            model=Product,
            items=products,
            normalize=_normalize_product,
        )

    def replace_certifications(
        self, business: Business, certifications: list[dict]
    ) -> list[Certification]:
        return _replace_collection(
            self._db,
            business,
            business_attr="certifications",
            model=Certification,
            items=certifications,
            normalize=_normalize_certification,
        )

    def replace_export_history(
        self, business: Business, export_history: list[dict]
    ) -> list[ExportHistory]:
        return _replace_collection(
            self._db,
            business,
            business_attr="export_history",
            model=ExportHistory,
            items=export_history,
            normalize=_normalize_export,
        )

    def replace_goals(
        self, business: Business, goals: list[dict]
    ) -> list[BusinessGoal]:
        return _replace_collection(
            self._db,
            business,
            business_attr="goals",
            model=BusinessGoal,
            items=goals,
            normalize=_normalize_goal,
        )

    def replace_challenges(
        self, business: Business, challenges: list[dict]
    ) -> list[BusinessChallenge]:
        return _replace_collection(
            self._db,
            business,
            business_attr="challenges",
            model=BusinessChallenge,
            items=challenges,
            normalize=_normalize_challenge,
        )

    def upsert_digital_presence(
        self, business: Business, payload: dict | None
    ) -> DigitalPresence | None:
        """One-to-one relationship. Replace-or-create in a single call."""
        if payload is None:
            return business.digital_presence

        if business.digital_presence is None:
            presence = DigitalPresence(business_id=business.id)
            self._db.add(presence)
        else:
            presence = business.digital_presence

        presence.website_url = _clean(payload.get("website_url"))
        presence.linkedin_url = _clean(payload.get("linkedin_url"))
        presence.facebook_url = _clean(payload.get("facebook_url"))
        presence.instagram_url = _clean(payload.get("instagram_url"))
        presence.twitter_url = _clean(payload.get("twitter_url"))
        presence.youtube_url = _clean(payload.get("youtube_url"))
        presence.has_ecommerce = bool(payload.get("has_ecommerce", False))
        presence.ecommerce_platform = _clean(payload.get("ecommerce_platform"))
        presence.uses_digital_marketing = bool(payload.get("uses_digital_marketing", False))
        presence.uses_cloud_systems = bool(payload.get("uses_cloud_systems", False))
        return presence


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #


def _clean(value: str | None) -> str | None:
    """Strip whitespace, coerce empty strings to None."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _replace_collection(
    db: Session,
    business: Business,
    *,
    business_attr: str,
    model: type,
    items: list[dict],
    normalize,
) -> list:
    """Clear the existing collection on ``business`` and insert the
    new items in a single transaction. Returns the freshly-loaded
    collection."""
    collection = getattr(business, business_attr)
    # Mutate the live collection; SQLAlchemy will issue DELETEs for
    # orphans and INSERTs for new rows. The relationship is configured
    # with cascade="all, delete-orphan" so this is safe.
    collection.clear()
    db.flush()

    for raw in items:
        normalized = normalize(raw)
        obj = model(business_id=business.id, **normalized)
        db.add(obj)
    db.flush()

    # Re-read so the caller gets ORM objects with ids + timestamps.
    db.refresh(business, [business_attr])
    return list(getattr(business, business_attr))


def _normalize_product(raw: dict) -> dict:
    return {
        "name": raw["name"].strip(),
        "category": _clean(raw.get("category")),
        "hs_code": _clean(raw.get("hs_code")),
        "description": _clean(raw.get("description")),
        "unit_price": raw.get("unit_price"),
        "currency": (raw.get("currency") or "USD").upper(),
        "monthly_volume": raw.get("monthly_volume"),
        "is_exported": bool(raw.get("is_exported", False)),
    }


def _normalize_certification(raw: dict) -> dict:
    return {
        "name": raw["name"].strip(),
        "issuing_body": _clean(raw.get("issuing_body")),
        "issued_date": raw.get("issued_date"),
        "expiry_date": raw.get("expiry_date"),
        "certificate_number": _clean(raw.get("certificate_number")),
    }


def _normalize_export(raw: dict) -> dict:
    return {
        "destination_country": raw["destination_country"].strip(),
        "product_category": _clean(raw.get("product_category")),
        "first_export_date": raw.get("first_export_date"),
        "annual_export_value": raw.get("annual_export_value"),
        "currency": (raw.get("currency") or "USD").upper(),
        "iec_number": _clean(raw.get("iec_number")),
    }


def _normalize_goal(raw: dict) -> dict:
    return {
        "title": raw["title"].strip(),
        "description": _clean(raw.get("description")),
        "timeframe": _clean(raw.get("timeframe")),
        "priority": raw.get("priority") or "medium",
        "target_date": raw.get("target_date"),
    }


def _normalize_challenge(raw: dict) -> dict:
    return {
        "title": raw["title"].strip(),
        "description": _clean(raw.get("description")),
        "severity": raw.get("severity") or "medium",
        "category": _clean(raw.get("category")),
    }

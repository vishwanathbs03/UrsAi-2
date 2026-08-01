"""Business service — orchestration + business rules for the
Business Digital Twin.

The service is the only place that knows what "complete" means. The
repository owns SQL, the service owns decisions:

  * One business per user (enforced; raises ``BusinessAlreadyExists``)
  * Profile completeness rubric (deterministic, documented)
  * Replace-on-update semantics for nested collections
  * Mark-as-complete on the final PUT if completeness >= 100

Endpoints stay thin: they convert HTTP into a service call, map
service exceptions to status codes, and serialize the result.
"""

from __future__ import annotations

from typing import Any

from app.models.business import Business
from app.repositories.business_repository import (
    BusinessAlreadyExists,
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.business import (
    BusinessCreate,
    BusinessMeta,
    BusinessOut,
    BusinessUpdate,
    BusinessWithCompleteness,
    CompletenessMissingField,
    ProfileCompleteness,
)


class BusinessService:
    """Stateless façade over :class:`BusinessRepository`."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    # ---- Read ----------------------------------------------------------

    def get_for_owner(self, owner_id: int) -> BusinessWithCompleteness:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile for this user yet.")
        return self._build(business)

    def exists(self, owner_id: int) -> bool:
        return self._repo.exists_for_owner(owner_id)

    # ---- Create --------------------------------------------------------

    def create(self, owner_id: int, payload: BusinessCreate) -> BusinessWithCompleteness:
        if self._repo.exists_for_owner(owner_id):
            raise BusinessAlreadyExists(
                "A business profile already exists for this account. Use PUT to update it."
            )

        basic = payload.basic
        capacity = payload.capacity

        business = self._repo.create(
            owner_id=owner_id,
            legal_name=basic.legal_name,
            industry=basic.industry,
            established_year=basic.established_year,
            employee_count=basic.employee_count,
            annual_revenue=basic.annual_revenue,
            revenue_currency=basic.revenue_currency,
            trade_name=basic.trade_name,
            sub_industry=basic.sub_industry,
            business_type=basic.business_type,
            description=basic.description,
            country=basic.country,
            state_region=basic.state_region,
            city=basic.city,
            production_capacity=(capacity.production_capacity if capacity else None),
            production_capacity_unit=(capacity.production_capacity_unit if capacity else None),
            capacity_utilization_pct=(capacity.capacity_utilization_pct if capacity else None),
            monthly_production_units=(capacity.monthly_production_units if capacity else None),
        )

        # Nested collections — created in the same transaction so a
        # failed insert rolls everything back.
        if payload.products:
            self._repo.replace_products(business, [p.model_dump() for p in payload.products])
        if payload.certifications:
            self._repo.replace_certifications(
                business, [c.model_dump() for c in payload.certifications]
            )
        if payload.export_history:
            self._repo.replace_export_history(
                business, [e.model_dump() for e in payload.export_history]
            )
        if payload.goals:
            self._repo.replace_goals(business, [g.model_dump() for g in payload.goals])
        if payload.challenges:
            self._repo.replace_challenges(
                business, [c.model_dump() for c in payload.challenges]
            )
        if payload.digital_presence is not None:
            self._repo.upsert_digital_presence(
                business, payload.digital_presence.model_dump()
            )

        self._repo._db.commit()  # commit before refreshing nested rows
        fresh = self._repo.get_by_owner(owner_id)
        assert fresh is not None  # we just created it

        # Same mark-complete logic as update(): the user lands on
        # the dashboard / re-fetches immediately, so the first
        # response must already reflect "complete" when applicable.
        completeness = self._compute_completeness(fresh)
        self._repo.mark_complete(fresh, completed=completeness.completed)
        self._repo._db.commit()
        return self._build(self._repo.get_by_owner(owner_id) or fresh)

    # ---- Update --------------------------------------------------------

    def update(self, owner_id: int, payload: BusinessUpdate) -> BusinessWithCompleteness:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound(
                "No business profile to update. POST /business first."
            )

        if payload.basic is not None:
            b = payload.basic
            self._repo.update_basic(
                business,
                legal_name=b.legal_name,
                industry=b.industry,
                established_year=b.established_year,
                employee_count=b.employee_count,
                annual_revenue=b.annual_revenue,
                revenue_currency=b.revenue_currency,
                trade_name=b.trade_name,
                sub_industry=b.sub_industry,
                business_type=b.business_type,
                description=b.description,
                country=b.country,
                state_region=b.state_region,
                city=b.city,
            )

        if payload.capacity is not None:
            self._repo.update_capacity(
                business,
                production_capacity=payload.capacity.production_capacity,
                production_capacity_unit=payload.capacity.production_capacity_unit,
                capacity_utilization_pct=payload.capacity.capacity_utilization_pct,
                monthly_production_units=payload.capacity.monthly_production_units,
            )

        if payload.products is not None:
            self._repo.replace_products(
                business, [p.model_dump() for p in payload.products]
            )
        if payload.certifications is not None:
            self._repo.replace_certifications(
                business, [c.model_dump() for c in payload.certifications]
            )
        if payload.export_history is not None:
            self._repo.replace_export_history(
                business, [e.model_dump() for e in payload.export_history]
            )
        if payload.goals is not None:
            self._repo.replace_goals(
                business, [g.model_dump() for g in payload.goals]
            )
        if payload.challenges is not None:
            self._repo.replace_challenges(
                business, [c.model_dump() for c in payload.challenges]
            )
        if payload.digital_presence is not None:
            self._repo.upsert_digital_presence(
                business, payload.digital_presence.model_dump()
            )

        # If everything is filled in, flip is_completed. The service
        # owns this rule; the repository stays dumb.
        fresh = self._repo.get_by_owner(owner_id)
        assert fresh is not None
        completeness = self._compute_completeness(fresh)
        self._repo.mark_complete(fresh, completed=completeness.completed)
        self._repo._db.commit()
        return self._build(self._repo.get_by_owner(owner_id) or fresh)

    # ---- Delete --------------------------------------------------------

    def delete(self, owner_id: int) -> int:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile to delete.")
        business_id = business.id
        self._repo.delete(business)
        self._repo._db.commit()
        return business_id

    # ---- Internal ------------------------------------------------------

    def _build(self, business: Business) -> BusinessWithCompleteness:
        completeness = self._compute_completeness(business)
        return BusinessWithCompleteness(
            business=BusinessOut.model_validate(business),
            completeness=completeness,
            meta=BusinessMeta(
                profile_completion=completeness.score,
                profile_status=_status_from_score(completeness.score),
                last_updated=business.updated_at,
            ),
        )

    # ------------------------------------------------------------------- #
    # Completeness rubric
    # ------------------------------------------------------------------- #
    #
    # The rubric is explicit (not derived from a vague "is anything
    # empty" check) so the UI can show the user *which* fields are
    # missing, and the server stays the source of truth.
    #
    # Score = round(100 * completed_fields / total_fields). When all
    # fields are present the profile is marked complete.
    #
    # Sections map 1:1 to the wizard steps so the frontend can deep
    # link to the missing field.

    @staticmethod
    def _compute_completeness(business: Business) -> ProfileCompleteness:
        fields: list[tuple[str, str, str, Any]] = [
            # (section, key, label, value)
            ("basic", "legal_name", "Business name", business.legal_name),
            ("basic", "industry", "Industry", business.industry),
            ("basic", "established_year", "Established year", business.established_year),
            ("basic", "employee_count", "Employee count", business.employee_count),
            ("basic", "annual_revenue", "Annual revenue", business.annual_revenue),
            ("basic", "country", "Country", business.country),
            ("products", "products", "At least one product", business.products),
            ("capacity", "production_capacity", "Production capacity", business.production_capacity),
            ("digital_presence", "website_url", "Website", _attr(business.digital_presence, "website_url")),
            ("compliance", "certifications", "At least one certification", business.certifications),
            ("export_history", "export_history", "Export history", business.export_history),
            ("export_history", "iec_number", "IEC", _has_iec(business)),
            ("goals", "goals", "Business goals", business.goals),
            ("challenges", "challenges", "Business challenges", business.challenges),
        ]

        completed = 0
        missing: list[CompletenessMissingField] = []
        for section, key, label, value in fields:
            if _is_present(value):
                completed += 1
            else:
                missing.append(
                    CompletenessMissingField(section=section, field=key, label=label)
                )

        total = len(fields)
        score = round(100 * completed / total) if total else 0
        return ProfileCompleteness(
            score=score,
            completed=score >= 100,
            total_fields=total,
            completed_fields=completed,
            missing=missing,
        )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _is_present(value: Any) -> bool:
    """Truthy + non-empty. Used for both scalar and collection fields."""
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, (list, tuple, set)):
        return len(value) > 0
    if isinstance(value, (int, float)):
        return value > 0 or value == 0  # 0 is a valid revenue / employee count
    return bool(value)


def _attr(obj, name: str) -> Any:
    return getattr(obj, name, None) if obj is not None else None


def _has_iec(business: Business) -> Any:
    """IEC counts as present if any export row has an IEC number set."""
    for row in business.export_history:
        if row.iec_number and row.iec_number.strip():
            return row.iec_number
    return None


def _status_from_score(score: int) -> str:
    """Map a 0..100 completeness score to the three-step status the UI
    uses for chip / pill rendering.

      score == 0          -> "draft"        (no fields filled in)
      0  < score <  100   -> "in_progress"
      score == 100        -> "complete"
    """
    if score <= 0:
        return "draft"
    if score >= 100:
        return "complete"
    return "in_progress"

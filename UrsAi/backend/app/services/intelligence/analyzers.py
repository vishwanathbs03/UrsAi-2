"""Rule-based analyzers — one class per intelligence lens.

Each analyzer implements :class:`Analyzer` (see below). Analyzers
are deliberately self-contained: they read directly from the
SQLAlchemy ``Business`` model and return an
:class:`~app.services.intelligence.base.AnalyzerResult`.

Why composition over a giant function
------------------------------------

A 1000-line ``analyze_business`` would work but it would be
impossible to test or to evolve. Splitting it into five small
analyzers means each one:

  * has a single responsibility (one question about the business)
  * can be unit-tested with a hand-built ORM object
  * can be replaced or extended without touching the others
  * can be reasoned about independently in a code review

Scoring model
-------------

Every analyzer uses the same shape:

  * each ``ScoreItem`` declares a ``weight`` (max contribution)
    and an ``earned`` value (actual contribution)
  * the headline ``score`` is the sum of ``earned`` across all
    items, clamped to [0, 100]
  * weights are tuned so the headline score is the percentage of
    "credit available" the business has earned. This keeps the
    0..100 contract honest — a fully-complete business hits 100,
    an empty one hits 0.

Keeping the weights summing to 100 per analyzer is a
convention, not a hard requirement. The :meth:`Analyzer.run`
helper normalises the final score for safety.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from app.models.business import Business
from app.services.intelligence.base import (
    AnalyzerResult,
    ScoreItem,
    missing_labels,
)
from app.services.intelligence.rules import (
    has_collection,
    is_meaningful_number,
    is_real_year,
    has_text,
    is_past,
    is_future,
)

# --------------------------------------------------------------------------- #
# Abstract base
# --------------------------------------------------------------------------- #


class Analyzer(ABC):
    """Contract every analyzer implements."""

    #: Stable identifier used in the API response.
    key: str = "analyzer"
    #: Human-readable title for the UI.
    title: str = "Analyzer"

    @abstractmethod
    def evaluate(self, business: Business) -> list[ScoreItem]:
        """Return the breakdown items for ``business``. Each item's
        ``earned`` is the points awarded. The headline score is the
        sum of ``earned`` values, clamped to 0..100."""

    def run(self, business: Business) -> AnalyzerResult:
        items = self.evaluate(business)
        raw = sum(item.earned for item in items)
        max_total = sum(item.weight for item in items) or 1
        # Normalise to 0..100 so adding a new item never silently
        # reduces the score of an existing perfect business.
        score = max(0, min(100, round(100 * raw / max_total)))
        return AnalyzerResult(
            key=self.key,
            title=self.title,
            score=score,
            breakdown=items,
            summary=self._summary(business, items, score),
            missing=missing_labels(items),
        )

    @abstractmethod
    def _summary(
        self, business: Business, items: list[ScoreItem], score: int
    ) -> str:
        """One-sentence plain-English verdict."""


# --------------------------------------------------------------------------- #
# 1. Profile Completeness
# --------------------------------------------------------------------------- #


class ProfileCompletenessAnalyzer(Analyzer):
    """Reuses the canonical 14-field rubric so the engine's
    'completeness' lens matches the meta card on the wizard."""

    key = "profile_completeness"
    title = "Profile Completeness"

    def evaluate(self, business: Business) -> list[ScoreItem]:
        items: list[ScoreItem] = [
            ScoreItem(
                key="basic.legal_name",
                label="Business name",
                weight=10,
                earned=10 if has_text(business.legal_name) else 0,
                present=has_text(business.legal_name),
            ),
            ScoreItem(
                key="basic.industry",
                label="Industry",
                weight=10,
                earned=10 if has_text(business.industry) else 0,
                present=has_text(business.industry),
            ),
            ScoreItem(
                key="basic.established_year",
                label="Established year",
                weight=5,
                earned=5 if is_real_year(business.established_year) else 0,
                present=is_real_year(business.established_year),
            ),
            ScoreItem(
                key="basic.employee_count",
                label="Employee count",
                weight=5,
                earned=5 if is_meaningful_number(business.employee_count) else 0,
                present=is_meaningful_number(business.employee_count),
            ),
            ScoreItem(
                key="basic.annual_revenue",
                label="Annual revenue",
                weight=5,
                earned=5 if is_meaningful_number(business.annual_revenue) else 0,
                present=is_meaningful_number(business.annual_revenue),
            ),
            ScoreItem(
                key="basic.country",
                label="Country",
                weight=5,
                earned=5 if has_text(business.country) else 0,
                present=has_text(business.country),
            ),
            ScoreItem(
                key="products",
                label="At least one product",
                weight=10,
                earned=10 if has_collection(business.products) else 0,
                present=has_collection(business.products),
            ),
            ScoreItem(
                key="capacity.production_capacity",
                label="Production capacity",
                weight=5,
                earned=5 if has_text(business.production_capacity) else 0,
                present=has_text(business.production_capacity),
            ),
            ScoreItem(
                key="digital_presence.website_url",
                label="Website",
                weight=10,
                earned=10
                if business.digital_presence and has_text(business.digital_presence.website_url)
                else 0,
                present=bool(
                    business.digital_presence and business.digital_presence.website_url
                ),
            ),
            ScoreItem(
                key="compliance.certifications",
                label="At least one certification",
                weight=10,
                earned=10 if has_collection(business.certifications) else 0,
                present=has_collection(business.certifications),
            ),
            ScoreItem(
                key="export_history",
                label="Export history",
                weight=10,
                earned=10 if has_collection(business.export_history) else 0,
                present=has_collection(business.export_history),
            ),
            ScoreItem(
                key="export_history.iec_number",
                label="IEC number",
                weight=5,
                earned=5 if any(
                    has_text(row.iec_number) for row in business.export_history
                )
                else 0,
                present=any(
                    has_text(row.iec_number) for row in business.export_history
                ),
            ),
            ScoreItem(
                key="goals",
                label="Business goals",
                weight=10,
                earned=10 if has_collection(business.goals) else 0,
                present=has_collection(business.goals),
            ),
            ScoreItem(
                key="challenges",
                label="Business challenges",
                weight=5,
                earned=5 if has_collection(business.challenges) else 0,
                present=has_collection(business.challenges),
            ),
        ]
        return items

    def _summary(
        self, business: Business, items: list[ScoreItem], score: int
    ) -> str:
        if score >= 100:
            return "Your business profile is fully complete."
        if score >= 70:
            return f"Profile is nearly complete ({score}%) — a few sections remain."
        if score >= 40:
            return f"Profile is partially complete ({score}%) — fill in the missing sections to unlock more insights."
        return f"Profile is in early draft ({score}%) — start with the basics to enable analysis."


# --------------------------------------------------------------------------- #
# 2. Export Readiness
# --------------------------------------------------------------------------- #


class ExportReadinessAnalyzer(Analyzer):
    """How ready is the business to take its products abroad?

    A high score requires:
      * at least one product in the catalog
      * at least one export-history row (a market is documented)
      * an IEC number (legal prerequisite in many jurisdictions)
      * at least one product flagged ``is_exported=True``
      * a non-zero annual export value
    """

    key = "export_readiness"
    title = "Export Readiness"

    # Weights sum to 100.
    _WEIGHTS = {
        "products_catalog": 15,
        "is_exported_flag": 20,
        "export_history": 20,
        "iec_number": 20,
        "export_value": 15,
        "export_diversity": 10,
    }

    def evaluate(self, business: Business) -> list[ScoreItem]:
        products = list(business.products or [])
        exports = list(business.export_history or [])
        exported_products = [p for p in products if p.is_exported]
        has_iec = any(has_text(row.iec_number) for row in exports)
        total_value = sum(
            float(row.annual_export_value or 0) for row in exports
        )
        unique_destinations = {
            (row.destination_country or "").strip().lower()
            for row in exports
            if row.destination_country
        }
        # Diversity bonus caps at 3 destinations so a single
        # market doesn't artificially hit the cap.
        diversity_count = min(len(unique_destinations), 3)

        return [
            ScoreItem(
                key="products_catalog",
                label="Product catalog defined",
                weight=self._WEIGHTS["products_catalog"],
                earned=self._WEIGHTS["products_catalog"] if products else 0,
                present=bool(products),
                hint=None if products else "Add at least one product to your catalog.",
            ),
            ScoreItem(
                key="is_exported_flag",
                label="Products flagged for export",
                weight=self._WEIGHTS["is_exported_flag"],
                earned=self._WEIGHTS["is_exported_flag"] if exported_products else 0,
                present=bool(exported_products),
                hint=None if exported_products else "Mark at least one product as exported.",
            ),
            ScoreItem(
                key="export_history",
                label="Export history recorded",
                weight=self._WEIGHTS["export_history"],
                earned=self._WEIGHTS["export_history"] if exports else 0,
                present=bool(exports),
                hint=None if exports else "Record at least one past or current export.",
            ),
            ScoreItem(
                key="iec_number",
                label="IEC number registered",
                weight=self._WEIGHTS["iec_number"],
                earned=self._WEIGHTS["iec_number"] if has_iec else 0,
                present=has_iec,
                hint=None if has_iec else "Add an IEC number to at least one export row.",
            ),
            ScoreItem(
                key="export_value",
                label="Annual export value reported",
                weight=self._WEIGHTS["export_value"],
                earned=self._WEIGHTS["export_value"] if total_value > 0 else 0,
                present=total_value > 0,
                hint=None if total_value > 0 else "Report an annual export value to unlock this credit.",
            ),
            ScoreItem(
                key="export_diversity",
                label="Destination diversity",
                weight=self._WEIGHTS["export_diversity"],
                # 0 destinations -> 0, 1 -> weight/3, 2 -> 2*weight/3, 3+ -> full
                earned=round(self._WEIGHTS["export_diversity"] * diversity_count / 3),
                present=diversity_count > 0,
                hint="Add up to 3 distinct destination countries for full credit.",
            ),
        ]

    def _summary(
        self, business: Business, items: list[ScoreItem], score: int
    ) -> str:
        if score >= 70:
            return "You are well-positioned for export."
        if score >= 40:
            return "Export readiness is in progress — close the gaps in export documentation."
        return "Export readiness is low — add products, IEC, and export history to begin."


# --------------------------------------------------------------------------- #
# 3. Digital Readiness
# --------------------------------------------------------------------------- #


class DigitalReadinessAnalyzer(Analyzer):
    """How visible and active is the business online?

    A high score requires:
      * a website (the baseline)
      * at least 2 of the social channels filled in
      * an active e-commerce presence
      * digital marketing + cloud systems as adoption signals
    """

    key = "digital_readiness"
    title = "Digital Readiness"

    _WEIGHTS = {
        "website": 30,
        "social_channels": 20,
        "ecommerce": 20,
        "digital_marketing": 15,
        "cloud_systems": 15,
    }

    def evaluate(self, business: Business) -> list[ScoreItem]:
        dp = business.digital_presence
        social_count = 0
        if dp is not None:
            for field in (
                "linkedin_url",
                "facebook_url",
                "instagram_url",
                "twitter_url",
                "youtube_url",
            ):
                if has_text(getattr(dp, field, None)):
                    social_count += 1

        # Social credit is 0 / weight/2 / weight for 0 / 1 / 2+ channels.
        if social_count >= 2:
            social_earned = self._WEIGHTS["social_channels"]
        elif social_count == 1:
            social_earned = self._WEIGHTS["social_channels"] // 2
        else:
            social_earned = 0

        has_website = bool(dp and has_text(dp.website_url))
        has_ecom = bool(dp and dp.has_ecommerce)
        has_marketing = bool(dp and dp.uses_digital_marketing)
        has_cloud = bool(dp and dp.uses_cloud_systems)

        return [
            ScoreItem(
                key="website",
                label="Business website",
                weight=self._WEIGHTS["website"],
                earned=self._WEIGHTS["website"] if has_website else 0,
                present=has_website,
                hint=None if has_website else "Add a website URL to your digital presence.",
            ),
            ScoreItem(
                key="social_channels",
                label="Social media presence (2+ channels)",
                weight=self._WEIGHTS["social_channels"],
                earned=social_earned,
                present=social_count > 0,
                hint=f"You have {social_count} channel(s); 2+ unlock full credit.",
            ),
            ScoreItem(
                key="ecommerce",
                label="E-commerce active",
                weight=self._WEIGHTS["ecommerce"],
                earned=self._WEIGHTS["ecommerce"] if has_ecom else 0,
                present=has_ecom,
                hint=None if has_ecom else "Enable e-commerce to sell online.",
            ),
            ScoreItem(
                key="digital_marketing",
                label="Digital marketing in use",
                weight=self._WEIGHTS["digital_marketing"],
                earned=self._WEIGHTS["digital_marketing"] if has_marketing else 0,
                present=has_marketing,
            ),
            ScoreItem(
                key="cloud_systems",
                label="Cloud systems in use",
                weight=self._WEIGHTS["cloud_systems"],
                earned=self._WEIGHTS["cloud_systems"] if has_cloud else 0,
                present=has_cloud,
            ),
        ]

    def _summary(
        self, business: Business, items: list[ScoreItem], score: int
    ) -> str:
        if score >= 70:
            return "Digital presence is mature and multi-channel."
        if score >= 40:
            return "Digital presence is established but could be expanded (e-commerce, more channels)."
        return "Digital presence is minimal — start with a website."


# --------------------------------------------------------------------------- #
# 4. Compliance Readiness
# --------------------------------------------------------------------------- #


class ComplianceReadinessAnalyzer(Analyzer):
    """How ready is the business from a compliance standpoint?

    A high score requires:
      * at least one certification row
      * the certification has a non-empty name and issuing body
      * the certification is still in force (issued today or
        earlier, and not expired)
    """

    key = "compliance_readiness"
    title = "Compliance Readiness"

    _WEIGHTS = {
        "any_certification": 30,
        "active_certification": 40,
        "issuing_body_recorded": 20,
        "multiple_certifications": 10,
    }

    def evaluate(self, business: Business) -> list[ScoreItem]:
        certs = list(business.certifications or [])
        any_cert = bool(certs)
        certs_with_body = [c for c in certs if has_text(c.issuing_body)]
        active_certs = [
            c
            for c in certs
            if has_text(c.name)
            # issued_date is unknown, or it is not in the future
            # (a cert can't be issued in the future — flag it as suspect)
            and (c.issued_date is None or not is_future(c.issued_date))
            # expiry_date is unknown, or it is not in the past
            # (an expired cert is not "active")
            and (c.expiry_date is None or not is_past(c.expiry_date))
        ]
        today = date.today()
        # "Multiple" credit kicks in when the business has 2+ active
        # certifications — a single cert is fine but the bonus
        # rewards a broader compliance posture.
        multi_count = min(len(active_certs), 3)

        return [
            ScoreItem(
                key="any_certification",
                label="At least one certification",
                weight=self._WEIGHTS["any_certification"],
                earned=self._WEIGHTS["any_certification"] if any_cert else 0,
                present=any_cert,
                hint=None if any_cert else "Add a certification (e.g. ISO 9001).",
            ),
            ScoreItem(
                key="active_certification",
                label="At least one active certification",
                weight=self._WEIGHTS["active_certification"],
                earned=(
                    self._WEIGHTS["active_certification"] if active_certs else 0
                ),
                present=bool(active_certs),
                hint=None
                if active_certs
                else "Ensure issued_date is in the past and expiry_date is today or later.",
            ),
            ScoreItem(
                key="issuing_body_recorded",
                label="Issuing body recorded",
                weight=self._WEIGHTS["issuing_body_recorded"],
                earned=(
                    self._WEIGHTS["issuing_body_recorded"]
                    if certs_with_body
                    else 0
                ),
                present=bool(certs_with_body),
            ),
            ScoreItem(
                key="multiple_certifications",
                label="Multiple active certifications",
                weight=self._WEIGHTS["multiple_certifications"],
                # 0 -> 0, 1 -> 1/3, 2 -> 2/3, 3+ -> full
                earned=round(
                    self._WEIGHTS["multiple_certifications"] * multi_count / 3
                ),
                present=multi_count > 0,
                hint=f"{len(active_certs)} active certification(s) recorded; 3+ unlock full credit.",
            ),
        ]

    def _summary(
        self, business: Business, items: list[ScoreItem], score: int
    ) -> str:
        if score >= 70:
            return "Compliance posture is strong."
        if score >= 40:
            return "Some compliance evidence on file; more active certifications would help."
        return "Compliance readiness is low — record at least one active certification."


# --------------------------------------------------------------------------- #
# 5. Growth Readiness
# --------------------------------------------------------------------------- #


class GrowthReadinessAnalyzer(Analyzer):
    """How ready is the business to grow?

    A high score requires:
      * at least one declared business goal
      * production capacity declared (text or unit count)
      * a healthy capacity utilisation (>= 60% suggests the
        business is operating near full tilt; below 30% may
        suggest spare capacity for growth)
      * a positive employee count and a positive monthly
        production volume (the business is actively producing)
    """

    key = "growth_readiness"
    title = "Growth Readiness"

    _WEIGHTS = {
        "goals_declared": 25,
        "production_capacity_text": 15,
        "capacity_utilization": 20,
        "monthly_production": 20,
        "employee_count": 20,
    }

    def evaluate(self, business: Business) -> list[ScoreItem]:
        has_goals = has_collection(business.goals)
        has_capacity_text = has_text(business.production_capacity)
        util = business.capacity_utilization_pct
        monthly = business.monthly_production_units
        employees = business.employee_count

        # Healthy utilisation = >= 60 (operating well) OR <= 30
        # (lots of headroom). Mid-range (31..59) only gets partial
        # credit because the business is neither under- nor
        # over-utilised.
        if util is None:
            util_earned = 0
            util_present = False
        elif util >= 60 or util <= 30:
            util_earned = self._WEIGHTS["capacity_utilization"]
            util_present = True
        else:
            util_earned = self._WEIGHTS["capacity_utilization"] // 2
            util_present = True

        return [
            ScoreItem(
                key="goals_declared",
                label="Business goals declared",
                weight=self._WEIGHTS["goals_declared"],
                earned=self._WEIGHTS["goals_declared"] if has_goals else 0,
                present=has_goals,
                hint=None if has_goals else "Add at least one business goal.",
            ),
            ScoreItem(
                key="production_capacity_text",
                label="Production capacity declared",
                weight=self._WEIGHTS["production_capacity_text"],
                earned=(
                    self._WEIGHTS["production_capacity_text"] if has_capacity_text else 0
                ),
                present=has_capacity_text,
            ),
            ScoreItem(
                key="capacity_utilization",
                label="Capacity utilization in healthy range",
                weight=self._WEIGHTS["capacity_utilization"],
                earned=util_earned,
                present=util_present,
                hint="60%+ (high) or 30%- (lots of headroom) earns full credit.",
            ),
            ScoreItem(
                key="monthly_production",
                label="Monthly production reported",
                weight=self._WEIGHTS["monthly_production"],
                earned=(
                    self._WEIGHTS["monthly_production"]
                    if (monthly is not None and monthly > 0)
                    else 0
                ),
                present=monthly is not None and monthly > 0,
            ),
            ScoreItem(
                key="employee_count",
                label="Employees reported",
                weight=self._WEIGHTS["employee_count"],
                earned=(
                    self._WEIGHTS["employee_count"]
                    if (employees is not None and employees > 0)
                    else 0
                ),
                present=employees is not None and employees > 0,
            ),
        ]

    def _summary(
        self, business: Business, items: list[ScoreItem], score: int
    ) -> str:
        if score >= 70:
            return "You have the operational foundation and goals to grow."
        if score >= 40:
            return "Growth readiness is mixed — declare goals and confirm production."
        return "Growth readiness is low — add goals, employees, and capacity data to begin."

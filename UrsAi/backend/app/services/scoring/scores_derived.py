"""Derived Business Scores: Risk, Innovation, Sustainability.

These three scores are *not* one-to-one with a single intelligence
analyzer. Each one is a deterministic composite of signals pulled
from the analyzer breakdown map. The contract is the same as the
lifted scores: 0..100, 4-band level, explanation, contributing
factors.

Why derived and not analyzed?
-----------------------------

The Business Digital Twin intentionally does not collect "risk
incidents", "R&D spend", or "ESG metrics" as first-class fields at
this milestone. So a true ``RiskAnalyzer`` would have no
legitimate input. The honest move is to derive these three scores
from the *negative space* of what we already collect — e.g. a
business with no certifications and no export history is exposed
to more risk; a business with no digital presence is unlikely to
be innovating; a business with no products and no capacity cannot
be sustainable.

Every factor below is annotated with its ``source_key`` so a code
reviewer can audit the chain from raw data to score.

All weights are in the 0..100 range so each derived score is a
sum-and-clamp, not a percentage of an arbitrary budget. The
weights are tuned to keep each score in the same 0..100 band as
the lifted scores, and to make a fully-complete business score
between 80 and 100 (the "Excellent" band).
"""

from __future__ import annotations

from typing import Iterable

from app.services.intelligence.base import AnalyzerResult
from app.services.scoring.base import BusinessScore
from app.services.scoring.factors import ContributingFactor
from app.services.scoring.levels import clamp, level_for


# --------------------------------------------------------------------------- #
# 6. Risk Score
#
# A *high* risk score means the business is exposed. We invert the
# sense for the user: "Risk Score" is reported as the *resilience*
# of the business (so 100 = no risk, 0 = very exposed). The level
# bands (Low / Medium / High / Excellent) then read naturally:
# "Low" risk score = "High" risk exposure. The explanation makes
# the inversion explicit so the UI can label it clearly.
# --------------------------------------------------------------------------- #


class RiskScore:
    """Resilience score — *higher is safer*.

    100 = well-diversified, documented, compliant, multi-channel.
      0 = single-product, no certifications, no digital presence.
    """

    key = "risk"
    title = "Risk Score"

    # Weights sum to 100 — each is a raw max contribution.
    _WEIGHTS = {
        "compliance_active": 25,        # has an active certification
        "export_diversification": 20,   # 3+ destination countries
        "product_diversification": 15,  # 2+ products
        "digital_presence": 15,         # website + 2+ social channels
        "operational_capacity": 15,     # employee_count + monthly_production
        "revenue_presence": 10,         # annual_revenue > 0
    }

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        # Pull specific breakdown items by key (stable across runs).
        compliance = analyzers["compliance_readiness"]
        export = analyzers["export_readiness"]
        digital = analyzers["digital_readiness"]
        growth = analyzers["growth_readiness"]
        profile = analyzers["profile_completeness"]

        # compliance: any active cert?
        active_cert_item = _find(compliance, "active_certification")
        compliance_active = active_cert_item is not None and active_cert_item.earned > 0

        # export: destination diversity
        diversity_item = _find(export, "export_diversity")
        diversity_count = diversity_item.present_count if diversity_item else 0
        # 0 -> 0, 1 -> ~7, 2 -> ~13, 3 -> 20
        export_div_earned = diversity_item.earned if diversity_item else 0

        # product diversification: count products flagged is_exported
        products_item = _find(export, "is_exported_flag")
        products_present = products_item is not None and products_item.earned > 0

        # digital presence: website + social
        website_item = _find(digital, "website")
        social_item = _find(digital, "social_channels")
        digital_website = website_item is not None and website_item.earned > 0
        digital_social = social_item is not None and social_item.earned > 0

        # operational: employee + monthly production
        emp_item = _find(growth, "employee_count")
        prod_item = _find(growth, "monthly_production")
        has_employees = emp_item is not None and emp_item.earned > 0
        has_production = prod_item is not None and prod_item.earned > 0

        # revenue: the annual_revenue field's presence flag in the
        # profile breakdown (key is ``basic.annual_revenue``)
        rev_item = _find(profile, "basic.annual_revenue")
        has_revenue = rev_item is not None and rev_item.earned > 0

        # Build the weighted sum, capped at 100.
        # Each component contributes a fraction of its weight based
        # on how strong the signal is — the "graded" feel of the
        # risk score is important.
        def grad(weight: int, fraction: float) -> int:
            return int(round(weight * max(0.0, min(1.0, fraction))))

        # The export analyzer awards 0/3/6/10 for diversity_count
        # 0/1/2/3+ (its `_WEIGHTS["export_diversity"]` is 10). Map
        # that earned value onto the 0..1 fraction the risk
        # weight expects.
        earned = 0
        earned += self._WEIGHTS["compliance_active"] if compliance_active else 0
        earned += grad(self._WEIGHTS["export_diversification"], export_div_earned / 10.0)
        earned += self._WEIGHTS["product_diversification"] if products_present else 0
        earned += grad(
            self._WEIGHTS["digital_presence"],
            (0.6 if digital_website else 0.0) + (0.4 if digital_social else 0.0),
        )
        earned += grad(
            self._WEIGHTS["operational_capacity"],
            (0.5 if has_employees else 0.0) + (0.5 if has_production else 0.0),
        )
        earned += self._WEIGHTS["revenue_presence"] if has_revenue else 0

        score = clamp(earned)

        # Contributing factors — one per signal, both positive and
        # negative, so the UI can show a balanced list.
        factors: list[ContributingFactor] = [
            ContributingFactor(
                label="Active certification on file",
                impact="positive" if compliance_active else "negative",
                weight=self._WEIGHTS["compliance_active"] if compliance_active else 0,
                source_key="compliance_readiness.active_certification",
                detail="An active certification lowers compliance risk." if compliance_active else "No active certification increases compliance risk.",
            ),
            ContributingFactor(
                label="Destination diversification",
                impact="positive" if diversity_count > 0 else "negative",
                weight=export_div_earned,
                source_key="export_readiness.export_diversity",
                detail=f"{diversity_count} destination(s) on file; 3+ lowers market risk." if diversity_count else "No export history — single-market risk.",
            ),
            ContributingFactor(
                label="Product diversification",
                impact="positive" if products_present else "negative",
                weight=self._WEIGHTS["product_diversification"] if products_present else 0,
                source_key="export_readiness.is_exported_flag",
                detail="Multiple exportable products lower portfolio risk." if products_present else "No exported products — single-product risk.",
            ),
            ContributingFactor(
                label="Digital presence",
                impact="positive" if (digital_website and digital_social) else ("neutral" if (digital_website or digital_social) else "negative"),
                weight=int(round(self._WEIGHTS["digital_presence"] * ((0.6 if digital_website else 0.0) + (0.4 if digital_social else 0.0)))),
                source_key="digital_readiness.website+social_channels",
                detail="Website + multi-channel social lowers channel risk." if (digital_website and digital_social) else "Digital footprint is thin; channel risk is elevated.",
            ),
            ContributingFactor(
                label="Operational capacity",
                impact="positive" if (has_employees and has_production) else ("neutral" if (has_employees or has_production) else "negative"),
                weight=int(round(self._WEIGHTS["operational_capacity"] * ((0.5 if has_employees else 0.0) + (0.5 if has_production else 0.0)))),
                source_key="growth_readiness.employee_count+monthly_production",
                detail="Headcount + production evidence reduces execution risk." if (has_employees and has_production) else "Limited operational evidence; execution risk is higher.",
            ),
            ContributingFactor(
                label="Revenue on record",
                impact="positive" if has_revenue else "negative",
                weight=self._WEIGHTS["revenue_presence"] if has_revenue else 0,
                source_key="profile_completeness.basic.annual_revenue",
                detail="Reported revenue lowers financial opacity." if has_revenue else "No revenue reported — financial risk is opaque.",
            ),
        ]

        explanation = _risk_explanation(score)

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# 7. Innovation Score
#
# A *high* innovation score means the business has the signals that
# correlate with product/operational innovation: digital channel
# adoption, an e-commerce line, declared growth goals, and active
# certifications (often a leading indicator of process investment).
# --------------------------------------------------------------------------- #


class InnovationScore:
    key = "innovation"
    title = "Innovation Score"

    _WEIGHTS = {
        "ecommerce": 25,           # sells online
        "digital_marketing": 20,   # runs digital marketing
        "cloud_systems": 15,       # uses cloud tools
        "growth_goals": 15,        # has declared growth goals
        "compliance_active": 15,   # active cert = process investment
        "export_diversification": 10,  # 2+ markets = experimentation
    }

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        digital = analyzers["digital_readiness"]
        growth = analyzers["growth_readiness"]
        compliance = analyzers["compliance_readiness"]
        export = analyzers["export_readiness"]

        ecommerce = _find(digital, "ecommerce")
        dmarketing = _find(digital, "digital_marketing")
        cloud = _find(digital, "cloud_systems")
        goals = _find(growth, "goals_declared")
        active = _find(compliance, "active_certification")
        diversity = _find(export, "export_diversity")

        has_ecom = ecommerce is not None and ecommerce.earned > 0
        has_dm = dmarketing is not None and dmarketing.earned > 0
        has_cloud = cloud is not None and cloud.earned > 0
        has_goals = goals is not None and goals.earned > 0
        has_active = active is not None and active.earned > 0
        div_count = diversity.present_count if diversity else 0

        earned = 0
        earned += self._WEIGHTS["ecommerce"] if has_ecom else 0
        earned += self._WEIGHTS["digital_marketing"] if has_dm else 0
        earned += self._WEIGHTS["cloud_systems"] if has_cloud else 0
        earned += self._WEIGHTS["growth_goals"] if has_goals else 0
        earned += self._WEIGHTS["compliance_active"] if has_active else 0
        # Diversity scales the export weight 0..1 with min(count,3)/3.
        earned += int(round(self._WEIGHTS["export_diversification"] * min(div_count, 3) / 3))

        score = clamp(earned)

        factors: list[ContributingFactor] = [
            _bool_factor("E-commerce channel", has_ecom, self._WEIGHTS["ecommerce"], "digital_readiness.ecommerce",
                         "Selling online is a direct innovation signal.",
                         "No online sales channel — limited innovation reach."),
            _bool_factor("Digital marketing in use", has_dm, self._WEIGHTS["digital_marketing"], "digital_readiness.digital_marketing",
                         "Active digital marketing = experimentation with channels.",
                         "No digital marketing — limited experimentation."),
            _bool_factor("Cloud systems adopted", has_cloud, self._WEIGHTS["cloud_systems"], "digital_readiness.cloud_systems",
                         "Cloud adoption = modern, iterative operations.",
                         "No cloud adoption — legacy operations."),
            _bool_factor("Growth goals declared", has_goals, self._WEIGHTS["growth_goals"], "growth_readiness.goals_declared",
                         "Declared goals = explicit commitment to evolve.",
                         "No declared goals — direction is unclear."),
            _bool_factor("Active certification", has_active, self._WEIGHTS["compliance_active"], "compliance_readiness.active_certification",
                         "Active certs require process investment — a leading indicator.",
                         "No active certification — no process investment signal."),
            ContributingFactor(
                label="Market experimentation",
                impact="positive" if div_count > 0 else "negative",
                weight=int(round(self._WEIGHTS["export_diversification"] * min(div_count, 3) / 3)),
                source_key="export_readiness.export_diversity",
                detail=f"{div_count} market(s) reached; 3+ shows willingness to experiment." if div_count else "Single market — no experimentation signal.",
            ),
        ]

        explanation = _generic_explanation(
            score,
            high="Your business shows strong innovation signals across digital, growth, and process.",
            mid="Your business has some innovation signals; a few channels are unexplored.",
            low="Your business shows few innovation signals — start with one new channel or goal.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# 8. Sustainability Score
#
# A *high* sustainability score is the deterministic composite of
# signals that correlate with long-term operational sustainability:
# revenue on record, declared employees (so the business is not a
# one-person shop), production capacity, multi-product catalog,
# long-running active certifications, and a diversified export
# base.
# --------------------------------------------------------------------------- #


class SustainabilityScore:
    key = "sustainability"
    title = "Sustainability Score"

    _WEIGHTS = {
        "revenue": 20,                  # annual_revenue > 0
        "employees": 15,                # employee_count > 0
        "production_capacity": 15,      # production_capacity text + utilization in band
        "product_catalog": 15,          # 1+ products
        "long_running_cert": 15,        # 1+ active certs with issued_date in past
        "export_diversification": 10,   # 2+ destinations
        "goals": 10,                    # declared growth goals
    }

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        profile = analyzers["profile_completeness"]
        growth = analyzers["growth_readiness"]
        export = analyzers["export_readiness"]
        compliance = analyzers["compliance_readiness"]

        revenue_item = _find(profile, "basic.annual_revenue")
        emp_item = _find(growth, "employee_count")
        cap_text_item = _find(growth, "production_capacity_text")
        util_item = _find(growth, "capacity_utilization")
        products_item = _find(export, "products_catalog")
        active_item = _find(compliance, "active_certification")
        diversity = _find(export, "export_diversity")
        goals_item = _find(growth, "goals_declared")

        has_revenue = revenue_item is not None and revenue_item.earned > 0
        has_emp = emp_item is not None and emp_item.earned > 0
        has_cap_text = cap_text_item is not None and cap_text_item.earned > 0
        util_present = util_item is not None and util_item.earned > 0
        has_products = products_item is not None and products_item.earned > 0
        has_active = active_item is not None and active_item.earned > 0
        div_count = diversity.present_count if diversity else 0
        has_goals = goals_item is not None and goals_item.earned > 0

        earned = 0
        earned += self._WEIGHTS["revenue"] if has_revenue else 0
        earned += self._WEIGHTS["employees"] if has_emp else 0
        # Capacity is half-text-half-band: both are needed for full credit.
        earned += int(round(self._WEIGHTS["production_capacity"] * (
            (0.5 if has_cap_text else 0.0) + (0.5 if util_present else 0.0)
        )))
        earned += self._WEIGHTS["product_catalog"] if has_products else 0
        earned += self._WEIGHTS["long_running_cert"] if has_active else 0
        earned += int(round(self._WEIGHTS["export_diversification"] * min(div_count, 3) / 3))
        earned += self._WEIGHTS["goals"] if has_goals else 0

        score = clamp(earned)

        factors: list[ContributingFactor] = [
            _bool_factor("Revenue on record", has_revenue, self._WEIGHTS["revenue"], "profile_completeness.basic.annual_revenue",
                         "Reported revenue indicates commercial viability.",
                         "No revenue reported — commercial viability is unknown."),
            _bool_factor("Employees reported", has_emp, self._WEIGHTS["employees"], "growth_readiness.employee_count",
                         "Headcount indicates the business can survive a single departure.",
                         "No employees — single-point-of-failure risk."),
            ContributingFactor(
                label="Production capacity declared",
                impact="positive" if (has_cap_text and util_present) else ("neutral" if (has_cap_text or util_present) else "negative"),
                weight=int(round(self._WEIGHTS["production_capacity"] * (
                    (0.5 if has_cap_text else 0.0) + (0.5 if util_present else 0.0)
                ))),
                source_key="growth_readiness.production_capacity_text+capacity_utilization",
                detail="Capacity text + utilization band = operational maturity." if (has_cap_text and util_present) else "Capacity is partially documented.",
            ),
            _bool_factor("Product catalog", has_products, self._WEIGHTS["product_catalog"], "export_readiness.products_catalog",
                         "A catalog means the business can serve multiple customers.",
                         "No products — nothing to sell sustainably."),
            _bool_factor("Long-running certification", has_active, self._WEIGHTS["long_running_cert"], "compliance_readiness.active_certification",
                         "An active cert means the business is investing in long-term quality.",
                         "No active certification — no long-term quality signal."),
            ContributingFactor(
                label="Market diversification",
                impact="positive" if div_count > 0 else "negative",
                weight=int(round(self._WEIGHTS["export_diversification"] * min(div_count, 3) / 3)),
                source_key="export_readiness.export_diversity",
                detail=f"{div_count} destination(s); 3+ supports long-term resilience." if div_count else "Single market — long-term concentration risk.",
            ),
            _bool_factor("Growth goals declared", has_goals, self._WEIGHTS["goals"], "growth_readiness.goals_declared",
                         "Declared goals show the business is planning beyond next quarter.",
                         "No declared goals — no long-term planning signal."),
        ]

        explanation = _generic_explanation(
            score,
            high="Your business shows strong long-term sustainability signals.",
            mid="Your business is sustainable on most dimensions; one or two signals are weak.",
            low="Your business is in early stages of long-term sustainability.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #


def _find(analyzer: AnalyzerResult, key: str):
    """Return the breakdown item with the given key, or None.

    Returns a small wrapper that exposes ``earned``, ``present``,
    and ``present_count`` (used by the diversity score). We
    avoid touching the dataclass directly so we can mock it in
    tests with a plain object.
    """
    for item in analyzer.breakdown:
        if item.key == key:
            return _ItemView(item)
    return None


class _ItemView:
    __slots__ = ("_item",)

    def __init__(self, item) -> None:
        self._item = item

    @property
    def earned(self) -> int:
        return int(self._item.earned)

    @property
    def present(self) -> bool:
        return bool(getattr(self._item, "present", self._item.earned > 0))

    @property
    def hint(self) -> str | None:
        return getattr(self._item, "hint", None)

    @property
    def present_count(self) -> int:
        """For the diversity item: how many destinations are
        documented? The export analyzer doesn't store the raw
        count on the breakdown row (only the earned points), so
        we infer from the earned value (0/3/6/10 -> 0/1/2/3)."""
        if not self.present:
            return 0
        # The export_readiness analyzer awards 0/3/6/10 for
        # diversity_count 0/1/2/3+.
        e = self.earned
        if e <= 0:
            return 0
        if e <= 3:
            return 1
        if e <= 6:
            return 2
        return 3


def _bool_factor(
    label: str,
    present: bool,
    weight: int,
    source_key: str,
    positive_detail: str,
    negative_detail: str,
) -> ContributingFactor:
    return ContributingFactor(
        label=label,
        impact="positive" if present else "negative",
        weight=weight if present else 0,
        source_key=source_key,
        detail=positive_detail if present else negative_detail,
    )


def _generic_explanation(score: int, *, high: str, mid: str, low: str) -> str:
    if score >= 80:
        return high
    if score >= 60:
        return high.replace("strong", "broadly strong").replace("Excellent", "Strong")
    if score >= 40:
        return mid
    return low


def _risk_explanation(score: int) -> str:
    """Risk score is inverted: high score = low risk. The text has
    to make that explicit so the UI can label the meter
    correctly (e.g. "Risk: Low" when the score is high)."""
    if score >= 80:
        return "Your business is well-diversified and low-risk across the dimensions we track."
    if score >= 60:
        return "Your business risk is moderate; a few concentration gaps remain."
    if score >= 40:
        return "Your business is exposed to several risks; diversification would help."
    return "Your business carries significant risk exposure; multiple foundations are missing."

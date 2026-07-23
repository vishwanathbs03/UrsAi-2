"""Immediate-action rules.

These fire when a *single* critical gap blocks the business
from being evaluated at all — a profile so empty that the
engine has nothing to work with, or a contradiction between
documented export activity and missing legal prerequisites.

These are the rules the UI should surface at the top of the
rules list, in a "before anything else" block.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


def _no_profile_basics(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    """Profile is missing the most basic basics.

    Fires when the business has not entered an industry,
    revenue, or country. With those missing, no other
    intelligence is actionable.
    """
    industry = sig.score("intelligence.profile_completeness.basic.industry", 0)
    revenue = sig.score("intelligence.profile_completeness.basic.annual_revenue", 0)
    country = sig.score("intelligence.profile_completeness.basic.country", 0)
    filled = (industry > 0) + (revenue > 0) + (country > 0)
    if filled >= 2:
        return None
    missing = []
    if industry == 0: missing.append("industry")
    if revenue == 0: missing.append("annual revenue")
    if country == 0: missing.append("country")
    gap = 100 - sig.score("intelligence.profile_completeness.score", 0)
    reason = f"Profile basics missing: {', '.join(missing)}."
    return reason, gap, 1.6  # high weight — without basics nothing else fires


def _contradictory_export(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    """Export history is documented but the IEC number is not.

    Exports without an IEC are a legal exposure in most
    jurisdictions — every recorded export is a future
    customs problem. The gap is the IEC item weight.
    """
    if not sig.flag("flag.has_export_history"):
        return None
    if sig.flag("flag.has_iec"):
        return None
    gap = sig.score("intelligence.export_readiness.iec_number.max", 0) or 20
    return ("Export history is recorded but no IEC number is on file.", 20, 1.4)


def _products_but_no_capacity(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    """A product catalog exists but no production capacity is declared.

    Selling a product without declared production capacity is a
    fulfillment-risk contradiction.
    """
    if not sig.flag("flag.has_products"):
        return None
    if sig.flag("flag.has_production_capacity"):
        return None
    gap = sig.score("intelligence.growth_readiness.production_capacity_text.max", 0) or 5
    return ("Products are listed but no production capacity is declared.", 5, 1.0)


ALL: tuple[RuleDef, ...] = (
    RuleDef(
        id="immediate.no_profile_basics",
        title="Profile basics are missing",
        description=(
            "Industry, revenue, and country are the three baseline "
            "fields every business profile must include. Without "
            "them, no downstream score is reliable."
        ),
        category="immediate_actions",
        priority="Critical",
        source_keys=(
            "profile_completeness.basic.industry",
            "profile_completeness.basic.annual_revenue",
            "profile_completeness.basic.country",
        ),
        firer=_no_profile_basics,
    ),
    RuleDef(
        id="immediate.contradictory_export",
        title="Export without IEC",
        description=(
            "Export history exists but the IEC number is missing. "
            "Exports without an IEC are a customs and licensing "
            "exposure in most jurisdictions."
        ),
        category="immediate_actions",
        priority="Critical",
        source_keys=("export_readiness.iec_number", "export_readiness.export_history"),
        firer=_contradictory_export,
    ),
    RuleDef(
        id="immediate.products_without_capacity",
        title="Products listed without production capacity",
        description=(
            "A product catalog exists but no production capacity "
            "is declared. Fulfillment risk is unmanaged."
        ),
        category="immediate_actions",
        priority="High",
        source_keys=(
            "profile_completeness.products",
            "growth_readiness.production_capacity_text",
        ),
        firer=_products_but_no_capacity,
    ),
)

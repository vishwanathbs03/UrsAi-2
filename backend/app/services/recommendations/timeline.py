"""Timeline + phase helpers.

A recommendation carries two time-related fields:

  * ``phase`` (Immediate / Short-Term / Medium-Term / Long-Term)
  * ``estimated_timeline`` (human-readable string like
    "~2 weeks" or "~1 month")

The phase is a bucketed value the UI uses to render the
recommendation on a Gantt-style timeline; the timeline is
the precise estimate shown in the details panel.

Both are derived from the same inputs: the rule's category
and the business_impact. The mapping is documented inline
so the next agent can adjust the bucketing without
reverse-engineering the call sites.
"""

from __future__ import annotations

from app.services.recommendations.base import Category, Phase


# Category → default phase. The order of the values matches
# the "when should I start this?" intuition: an immediate-
# actions rule fires because something is *already* wrong;
# a long-term rule is a strategic move.
CATEGORY_PHASE: dict[Category, Phase] = {
    "immediate_actions": "Immediate",
    "high_priority": "Short-Term",
    "medium_priority": "Medium-Term",
    "long_term": "Long-Term",
    "risk_alerts": "Immediate",
    "compliance_actions": "Short-Term",
    "export_readiness_actions": "Medium-Term",
    "digital_transformation_actions": "Medium-Term",
}


# Default weeks per phase. Used to render a coarse
# estimated_timeline when the business_impact is at the
# category's "typical" value (50). The actual timeline
# is then nudged by impact — higher impact = more work.
PHASE_DEFAULT_WEEKS: dict[Phase, int] = {
    "Immediate": 1,
    "Short-Term": 3,
    "Medium-Term": 8,
    "Long-Term": 16,
}


def phase_for(category: Category) -> Phase:
    """Return the phase for a rule-engine category."""
    return CATEGORY_PHASE[category]


def timeline_for(category: Category, business_impact: int) -> str:
    """Return a human-readable timeline string.

    Formula:
        weeks = phase_default * (impact / 50), clipped to 1..52

    A business_impact of 50 lands exactly on the phase's
    default. Higher impact → longer (more to do); lower
    impact → shorter (quick win).

    The result is rendered as a "~N weeks" / "~N months"
    string. The "~" prefix signals that the number is a
    heuristic estimate, not a guaranteed delivery date.
    """
    phase = CATEGORY_PHASE[category]
    base = PHASE_DEFAULT_WEEKS[phase]
    impact = max(0, min(100, int(business_impact)))
    # Scale: impact 50 → base weeks, impact 100 → ~2x, impact 0 → 1 week.
    weeks = max(1, round(base * (impact / 50.0) if impact > 0 else 1))
    weeks = min(52, weeks)
    if weeks == 1:
        return "~1 week"
    if weeks < 4:
        return f"~{weeks} weeks"
    months = round(weeks / 4)
    if months <= 1:
        return "~1 month"
    return f"~{months} months"


def cost_for(category: Category, business_impact: int) -> int:
    """Return an estimated cost in USD (0..100,000) for a
    recommendation.

    The cost is a deterministic function of category and
    impact. The unit is USD; the UI is free to localise
    the display. The function is purely an estimate —
    we do not have a cost catalogue yet.

    The 100,000 ceiling is intentional: a single
    recommendation rarely costs more than this, and
    capping the value keeps the summary field readable.
    """
    base = {
        "immediate_actions": 500,
        "high_priority": 2000,
        "medium_priority": 5000,
        "long_term": 15000,
        "risk_alerts": 1500,
        "compliance_actions": 4000,
        "export_readiness_actions": 8000,
        "digital_transformation_actions": 10000,
    }[category]
    impact = max(0, min(100, int(business_impact)))
    # Scale linearly with impact relative to 50.
    cost = int(round(base * (impact / 50.0) if impact > 0 else 0))
    return max(0, min(100_000, cost))

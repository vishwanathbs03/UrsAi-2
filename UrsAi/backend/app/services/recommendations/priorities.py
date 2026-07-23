"""Priority helpers for the Recommendation Engine.

The Rule Engine already assigns a :class:`RulePriority` to
every firing (``Critical`` / ``High`` / ``Medium`` / ``Low``).
The Recommendation Engine does NOT change that label — the
priorities below are deterministic weights used for
*internal* ranking and cost / ROI / confidence shaping, not
for re-labelling the recommendation.

The four weights are pinned to the same values the
``frontend`` uses in ``use-action-board-data.ts`` so the
backend ranking matches the frontend sort order.
"""

from __future__ import annotations

from app.services.recommendations.base import Priority


# Priority weight used to:
#   1. compute a numeric priority score for ranking
#   2. nudge the cost / ROI / difficulty heuristics
#
# Higher = more urgent. The exact values are pinned so the
# ranking is reproducible across releases.
PRIORITY_WEIGHT: dict[Priority, int] = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


def priority_weight(priority: Priority) -> int:
    """Numeric weight for a priority label. Used by every
    helper that needs to convert a label into a number."""
    return PRIORITY_WEIGHT[priority]


def rank_value(priority: Priority, business_impact: int) -> float:
    """Single number used to sort the recommendation list.

    Sort key = weight * 100 + business_impact, with the
    business_impact as tiebreaker. This is the exact same
    expression the frontend Kanban uses to sort cards
    (see ``use-action-board-filters.priorityWeight``), so
    the API and the UI will agree on the order.

    Why a single float instead of a tuple: the helpers
    in this module sometimes need to compare two
    recommendations; a single number is enough.
    """
    return priority_weight(priority) * 100.0 + float(business_impact)


def compare(a_priority: Priority, a_impact: int, b_priority: Priority, b_impact: int) -> int:
    """Stable comparator for two recommendations. Returns -1
    if ``a`` should come first, +1 if ``b`` should come first,
    0 if they are tied (caller breaks the tie by id)."""
    a = rank_value(a_priority, a_impact)
    b = rank_value(b_priority, b_impact)
    if a < b:
        return 1  # a ranks lower (we want desc, so a comes after b)
    if a > b:
        return -1
    return 0

"""Estimated business impact + score-gain helpers.

Two numbers come out of this module:

  * ``business_impact`` (0..100) — a unitless severity
    number. Currently a 1:1 mirror of the source rule's
    ``estimated_impact``; kept as a separate function so
    a future milestone can layer in additional signals
    (e.g. the user's DNA archetype, the current score
    distribution) without changing the call site.

  * ``estimated_score_gain`` (0..25) — the expected
    percentage-point lift the recommendation would
    contribute to the user's overall business score.
    Same formula as the frontend's
    ``deriveExpectedScoreImprovement`` so the UI and the
    API agree on the number.

  * ``confidence`` (0..100) — how confident the engine
    is that the recommendation is the right one. Driven
    by:

        base confidence      = 50
        + priority bonus     (Critical=30, High=20, Medium=10, Low=0)
        + impact bonus       = min(20, business_impact // 5)
        + knowledge bonus    = min(10, 5 * len(articles))

    Capped at 100. Two calls with the same inputs produce
    the same number (no time, no random).
"""

from __future__ import annotations

from app.services.recommendations.base import Priority
from app.services.recommendations.priorities import priority_weight


def estimate_score_gain(priority: Priority, business_impact: int) -> float:
    """Expected % lift on the overall business score.

    Same formula the frontend uses (see
    ``use-action-board-data.ts::deriveExpectedScoreImprovement``).

    Returns a float rounded to one decimal place.
    """
    weight = priority_weight(priority)
    impact = max(0, min(100, int(business_impact)))
    delta = impact * 0.6 + weight * 1.5
    return round(max(0, min(25, delta)), 1)


def business_impact_from_rule(estimated_impact: int) -> int:
    """Mirror the rule's estimated_impact into the
    recommendation's business_impact. Today this is a
    no-op; the function exists so a future milestone can
    layer in extra signals without changing the call
    site.
    """
    return max(0, min(100, int(estimated_impact)))


def confidence_for(
    priority: Priority,
    business_impact: int,
    article_count: int,
) -> int:
    """Confidence score (0..100).

    See the module docstring for the formula.
    """
    base = 50
    priority_bonus = {
        "Critical": 30,
        "High": 20,
        "Medium": 10,
        "Low": 0,
    }[priority]
    impact = max(0, min(100, int(business_impact)))
    impact_bonus = min(20, impact // 5)
    article_bonus = min(10, 5 * max(0, int(article_count)))
    return int(max(0, min(100, base + priority_bonus + impact_bonus + article_bonus)))

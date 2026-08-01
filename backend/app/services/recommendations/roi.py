"""Estimated ROI helper.

The Recommendation Engine needs a single ``estimated_roi``
number per recommendation (0..100). The spec does not pin
a formula; this module defines the rule of thumb and
documents it inline.

Why we don't reuse the Business Score Engine's ROI score
--------------------------------------------------------
The score service has no ROI lens (it surfaces Export,
Digital, Compliance, Growth, Risk, Innovation, Sustainability
and Overall). The closest existing signal is the
``score.overall.score`` itself. A standalone derivation is
simpler and more explainable than synthesising a new lens
on the score service just for one number.

The formula
-----------
::

    priority_weight  : Critical=4, High=3, Medium=2, Low=1
    raw_roi          : clamp(weight * 12 + business_impact * 0.4, 0, 100)

The same formula is used by the frontend's
``use-action-board-data.ts::deriveEstimatedRoi`` so the
backend and the UI agree on the number for any given
recommendation.
"""

from __future__ import annotations

from app.services.recommendations.base import Priority
from app.services.recommendations.priorities import priority_weight


def estimate_roi(priority: Priority, business_impact: int) -> int:
    """Return the estimated ROI for a recommendation as a
    0..100 integer.

    The derivation rule is pinned in this module's
    docstring so the next agent can adjust the heuristic
    without grepping the codebase.
    """
    weight = priority_weight(priority)
    impact = max(0, min(100, int(business_impact)))
    raw = weight * 12 + impact * 0.4
    return int(max(0, min(100, round(raw))))

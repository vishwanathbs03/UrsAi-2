"""Per-recommendation ROI computation.

The ROI module is a pure function of the
upstream recommendation payload. It does NOT
modify the recommendation list or call any
external service.

Formula
-------

For each recommendation ``r``::

    cost            = r.estimated_cost
                       OR
                       (r.estimated_roi / cost_roi_ratio)
    expected_roi    = r.estimated_roi
    expected_gain   = cost * (expected_roi / 100.0)
    expected_revenue_gain = expected_gain
    expected_profit_gain  = expected_gain * profit_margin
    payback_period  = cost / (expected_gain / effort_weeks)
                       = effort_weeks * cost_roi_ratio / expected_roi
                       (algebra: cost = roi/cost_roi_ratio;
                        gain = cost * roi/100;
                        payback_weeks = effort_weeks * cost / gain
                                       = effort_weeks * (roi/cost_roi_ratio)
                                          / (roi/100)
                                       = effort_weeks * 100 / cost_roi_ratio)
                       ⇒ independent of ``r.estimated_roi``
                         (which is a feature — the engine's
                         payback reflects the *effort* the user
                         is committing, not the arbitrary ROI
                         number the upstream emitted).

    investment_level = low if cost <= LOW_INVESTMENT_MAX
                       high if cost >= HIGH_INVESTMENT_MIN
                       else medium

    business_value  = clamp(
        w_roi * min(100, expected_roi)        # the upstream ROI
      + w_impact * min(100, business_impact) # the upstream impact
      + w_effort_inv * (100 - effort_score)  # inverted effort
        , 0, 100
    )

    risk_level      = low    if payback_period <= low_risk_payback_weeks
                       high   if payback_period >= medium_risk_payback_weeks
                       else medium

``business_value`` is bounded 0..100. The
weights are documented in
:class:`CostCalibration`.
"""

from __future__ import annotations

from typing import Any

from app.services.finance.base import (
    DEFAULT_EFFORT_WEEKS,
    HIGH_INVESTMENT_MIN,
    LOW_INVESTMENT_MAX,
    COST_CALIBRATION,
    parse_timeline_to_weeks,
)


def _band_investment(cost: int) -> str:
    if cost <= LOW_INVESTMENT_MAX:
        return "low"
    if cost >= HIGH_INVESTMENT_MIN:
        return "high"
    return "medium"


def _band_risk(payback_weeks: float) -> str:
    if payback_weeks <= COST_CALIBRATION.low_risk_payback_weeks:
        return "low"
    if payback_weeks >= COST_CALIBRATION.medium_risk_payback_weeks:
        return "high"
    return "medium"


def _effort_score(weeks: float) -> float:
    """Map a duration in weeks to a 0..100
    "effort" score, where 0 = no effort and
    100 = very long. A 4-week project scores
    25; a 12-week project scores 50; a
    52-week project scores 100. The
    business_value formula inverts this so
    short projects are more valuable per
    unit of ROI."""
    if weeks <= 0:
        return 0.0
    return min(100.0, (weeks / 52.0) * 100.0)


def build_recommendation_finance(rec: dict[str, Any]) -> dict[str, Any]:
    """Compute the finance view of a single
    recommendation.

    Parameters
    ----------
    rec : dict
        One entry from
        ``bundle.recommendations["recommendations"]``.

    Returns
    -------
    dict
        A dict shaped to match
        :class:`RecommendationFinanceOut`.
    """
    cal = COST_CALIBRATION
    upstream_roi = int(rec.get("estimated_roi", 0) or 0)
    business_impact = int(
        rec.get("business_impact", 0) or 0
    )
    score_gain = float(rec.get("estimated_score_gain", 0) or 0)

    # Cost: trust the upstream if it
    # emitted one; otherwise derive
    # deterministically from the upstream
    # ROI.
    upstream_cost = rec.get("estimated_cost")
    if upstream_cost is not None and int(upstream_cost) > 0:
        cost = int(upstream_cost)
    else:
        cost = int(upstream_roi / cal.cost_roi_ratio)

    # Effort in weeks.
    timeline = rec.get("estimated_timeline")
    effort_weeks = parse_timeline_to_weeks(timeline)
    if effort_weeks <= 0:
        effort_weeks = DEFAULT_EFFORT_WEEKS

    # Gain.
    expected_gain = int(cost * (upstream_roi / 100.0))
    expected_revenue_gain = expected_gain
    expected_profit_gain = int(expected_gain * cal.profit_margin)

    # Payback (independent of upstream_roi
    # algebraically — see module docstring).
    payback_weeks = (
        effort_weeks * 100.0 / cal.cost_roi_ratio
    )
    # Convert to months for the response
    # (1 month = 4.345 weeks).
    payback_period_months = round(payback_weeks / 4.345, 1)

    # Business value: weighted blend.
    effort_score = _effort_score(effort_weeks)
    bv = (
        cal.w_roi * min(100.0, float(upstream_roi))
        + cal.w_impact * min(100.0, float(business_impact))
        + cal.w_effort_inv * (100.0 - effort_score)
    )
    business_value = int(max(0, min(100, round(bv))))

    return {
        "recommendation_id": str(rec.get("id", "")),
        "title": str(rec.get("title", "")),
        "category": str(rec.get("category", "")),
        "priority": str(rec.get("priority", "Low")),
        "phase": str(rec.get("phase", "Medium-Term")),
        "estimated_cost": cost,
        "expected_roi": upstream_roi,
        "expected_revenue_gain": expected_revenue_gain,
        "expected_profit_gain": expected_profit_gain,
        "expected_score_gain": score_gain,
        "payback_period": float(payback_period_months),
        "investment_level": _band_investment(cost),
        "business_value": business_value,
        "risk_level": _band_risk(payback_weeks),
    }


def build_recommendation_finance_list(
    recs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Apply :func:`build_recommendation_finance`
    to every entry. The function is pure."""
    return [build_recommendation_finance(r) for r in recs]

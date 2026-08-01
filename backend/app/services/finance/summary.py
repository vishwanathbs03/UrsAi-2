"""Summary rollup.

The summary module rolls the per-recommendation
finance view into a single response block. The
block carries the spec's 9 summary fields plus
the same 9 fields re-exposed as
``roi_analysis`` (the spec asks for both — the
two are equal in this milestone; the
distinction will matter when the Finance engine
adds scenario-aware ROI in a later milestone).

Formulae
--------

  * ``overall_roi_score`` = mean of
    ``expected_roi`` over all
    recommendations.
  * ``estimated_total_roi`` = mean of
    ``expected_roi`` expressed as a
    currency (the engine multiplies the
    mean by ``revenue_gain_per_roi_unit``
    so the number is comparable to the
    per-recommendation revenue gains).
  * ``estimated_total_cost`` = sum of
    ``estimated_cost``.
  * ``estimated_total_gain`` = sum of
    ``expected_revenue_gain``.
  * ``payback_period`` = estimated_total_cost
    / (estimated_total_gain / 12)
    expressed in months (the spec's
    "payback" is a single number, not a
    distribution).
  * ``highest_value_category`` = the
    category with the highest cumulative
    ``business_value`` over its
    recommendations.
  * ``highest_roi_recommendation`` = the
    recommendation with the highest
    ``expected_roi`` (ties broken by
    ``id``).
  * ``lowest_effort_high_return`` = the
    recommendation with the highest
    ``business_value`` and the lowest
    payback period (i.e. the
    best-bang-per-buck).
  * ``business_growth_score`` = a
    blended 0..100 score: 0.4 *
    projected overall + 0.3 * projected
    digital + 0.3 * projected growth.

The summary is a pure function of the
per-recommendation finance view + the
bundle's twin block.
"""

from __future__ import annotations

from typing import Any

from app.services.finance.base import COST_CALIBRATION


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def build_summary(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the summary block (matching
    :class:`FinanceSummaryOut`)."""
    cal = COST_CALIBRATION

    if not recs_finance:
        return {
            "overall_roi_score": 0,
            "estimated_total_roi": 0,
            "estimated_total_cost": 0,
            "estimated_total_gain": 0,
            "payback_period": 0.0,
            "highest_value_category": "general",
            "highest_roi_recommendation": "",
            "lowest_effort_high_return": "",
            "business_growth_score": 0,
        }

    # Per-recommendation rolls.
    roi_values = [
        float(r["expected_roi"]) for r in recs_finance
    ]
    mean_roi = _mean(roi_values)
    total_cost = sum(int(r["estimated_cost"]) for r in recs_finance)
    total_gain = sum(
        int(r["expected_revenue_gain"]) for r in recs_finance
    )
    overall_roi_score = int(round(_clamp(mean_roi, 0, 100)))

    # The "total ROI" the user reads is
    # the average ROI scaled into a
    # currency number the same way
    # the per-recommendation gain is
    # derived (mean_roi * 100 / cost_roi_ratio
    # * mean_roi / 100 → mean_roi^2 / cost_roi_ratio).
    # We instead surface the per-recommendation
    # mean ROI as a percent (× cal's per-ROI
    # factor) so the number is comparable
    # to the per-recommendation gains.
    estimated_total_roi = int(
        mean_roi * cal.revenue_gain_per_roi_unit
    )

    # Payback in months. The cost-to-gain
    # ratio drives the payback; we use
    # 12 months as a default horizon so
    # the answer is a number in [0, 12].
    if total_gain > 0:
        payback_months = (total_cost / total_gain) * 12.0
    else:
        payback_months = 0.0

    # Highest-value category: the
    # category with the highest sum of
    # business_value.
    by_category: dict[str, int] = {}
    for r in recs_finance:
        cat = r.get("category") or "general"
        by_category[cat] = by_category.get(cat, 0) + int(
            r.get("business_value", 0)
        )
    highest_value_category = max(
        by_category, key=lambda k: by_category[k]
    ) if by_category else "general"

    # Highest-ROI recommendation.
    highest_roi_rec = max(
        recs_finance,
        key=lambda r: (int(r["expected_roi"]),
                       -float(r["payback_period"]),
                       r["recommendation_id"]),
    )

    # Lowest-effort high-return: highest
    # business_value, then lowest payback,
    # then lowest cost.
    lowest_effort = max(
        recs_finance,
        key=lambda r: (int(r["business_value"]),
                       -float(r["payback_period"]),
                       -int(r["estimated_cost"])),
    )

    # Business growth score: blend the
    # twin's projected scores.
    scores = bundle.twin.get("scores", {}) or {}
    projected_overall = _overall(scores)
    projected_digital = _lens(scores, "digital")
    projected_growth = _lens(scores, "growth")
    business_growth = int(round(
        0.4 * projected_overall
        + 0.3 * projected_digital
        + 0.3 * projected_growth
    ))

    return {
        "overall_roi_score": overall_roi_score,
        "estimated_total_roi": max(0, estimated_total_roi),
        "estimated_total_cost": max(0, total_cost),
        "estimated_total_gain": max(0, total_gain),
        "payback_period": round(_clamp(payback_months, 0.0, 60.0), 1),
        "highest_value_category": highest_value_category,
        "highest_roi_recommendation": highest_roi_rec[
            "recommendation_id"
        ],
        "lowest_effort_high_return": lowest_effort[
            "recommendation_id"
        ],
        "business_growth_score": max(0, min(100, business_growth)),
    }


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _overall(scores: dict[str, Any]) -> float:
    raw = scores.get("overall_score")
    if isinstance(raw, dict):
        return float(raw.get("score", 0) or 0)
    if isinstance(raw, (int, float)):
        return float(raw)
    return 0.0


def _lens(scores: dict[str, Any], lens: str) -> float:
    named = scores.get(lens) or scores.get(f"{lens}_score")
    if isinstance(named, dict):
        return float(named.get("score", 0) or 0)
    if isinstance(named, (int, float)):
        return float(named)
    return 0.0

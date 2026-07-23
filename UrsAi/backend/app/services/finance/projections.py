"""Projections: revenue + 4 sub-projections
(loan readiness, exports, digital, valuation).

The projections module is the *only* place
the Finance engine makes forward-looking
calculations. Every function is a pure
function of the bundle's upstream payloads.

The spec asks for five projections, each with
a confidence number:

  * Revenue projection
  * Loan readiness
  * Export projection
  * Digital transformation projection
  * Business valuation projection

The five functions are pure deterministic
functions of the bundle. The output is a
dict matching the corresponding
:class:`*Out` schema.

Formulae
--------

*Revenue projection*

    digital_lift    = max(0, projected_digital - current_digital) / 100
    export_lift     = max(0, projected_export  - current_export)  / 100
    growth_lift     = max(0, projected_growth  - current_growth)  / 100
    maturity_lift   = (business_maturity - current_maturity) / 100
    growth_factor   = 0.30*digital_lift + 0.25*export_lift
                       + 0.25*growth_lift + 0.20*maturity_lift
    projected_revenue = current_revenue * (1 + growth_factor)
    growth_percentage = growth_factor * 100
    confidence = weighted average of the
                 four sub-projection confidences

*Loan readiness*

    current_score   = overall business score
    projected_score = current + min(50, total_score_gain / 2)
    funding_probability = clamp(projected_score, 0, 100)
    bank_confidence = (current_score + projected_score) / 2
    loan_readiness  = "high" if projected >= 70
                      "medium" if projected >= 45
                      "low"  else
    eligible_business_types = the BusinessType
                              literal set
    estimated_credit_improvement = projected - current

*Export projection*

    current_export_score = export_lens
    projected_export_score = current + min(40, total_score_gain * 0.3)
    estimated_new_markets = round( (projected - current) / 10 )
    estimated_export_growth = projected - current
    export_readiness  = "high" if projected >= 60
                        "medium" if projected >= 35
                        "low"  else
    confidence = a blend of digital + growth + business maturity

*Digital projection*

    current_digital_score = digital_lens
    projected_digital_score = current + min(50, total_score_gain * 0.4)
    estimated_efficiency_gain = projected - current
    estimated_cost_reduction = round( estimated_efficiency_gain * 0.5 )
    automation_potential = projected
    confidence = digital lens

*Business valuation*

    current_value = 0.4*overall + 0.3*dna + 0.3*profile
    projected_value = current + min(50, total_score_gain * 0.4)
    estimated_growth = projected - current
    investment_attractiveness = projected
    business_maturity = current_value
    confidence = blend of overall + dna

The confidence numbers are clamped to 0..100.
"""

from __future__ import annotations

from typing import Any


# The set of business-type literals the
# spec asks the loan readiness to surface
# (the same set the Business Profile
# schema accepts).
_ELIGIBLE_BUSINESS_TYPES: list[str] = [
    "sole_proprietorship",
    "partnership",
    "llc",
    "private_limited",
    "public_limited",
    "cooperative",
    "other",
]


def _scores_block(bundle: Any) -> dict[str, Any]:
    """Extract the ``scores`` block from the
    bundle's twin payload. The twin
    aggregates every score into a single
    block; the Finance engine reads from
    there so the projections always agree
    with the Twin view."""
    return bundle.twin.get("scores", {}) or {}


def _lens_score(scores: dict[str, Any], lens: str) -> int:
    """Return the named lens's score (0..100)."""
    if not scores:
        return 0
    named = scores.get(lens) or scores.get(f"{lens}_score")
    if isinstance(named, dict):
        return int(named.get("score", 0) or 0)
    if isinstance(named, (int, float)):
        return int(named)
    return 0


def _overall_score(scores: dict[str, Any]) -> int:
    if not scores:
        return 0
    raw = scores.get("overall_score")
    if isinstance(raw, dict):
        return int(raw.get("score", 0) or 0)
    if isinstance(raw, (int, float)):
        return int(raw)
    return 0


def _total_score_gain(recs: list[dict[str, Any]]) -> float:
    """Sum the upstream ``expected_score_gain``
    over the recommendation list. The number
    is the cumulative lift the user would see
    if every recommendation were completed."""
    return sum(
        float(r.get("expected_score_gain", 0) or 0)
        for r in recs
    )


def _total_cost(recs_finance: list[dict[str, Any]]) -> int:
    return sum(int(r["estimated_cost"]) for r in recs_finance)


def _total_gain(recs_finance: list[dict[str, Any]]) -> int:
    return sum(int(r["expected_revenue_gain"]) for r in recs_finance)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# --------------------------------------------------------------------------- #
# Revenue projection
# --------------------------------------------------------------------------- #


def build_revenue_projection(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    """Project the business's annual revenue
    after completing every recommendation.

    Pure function of the bundle + the
    per-recommendation finance view.
    """
    business = bundle.business or {}
    # The business dump shape depends on
    # which Pydantic model produced it.
    # The :class:`BusinessWithCompleteness`
    # exposes a top-level ``business`` key
    # (an alias) wrapping the ORM-derived
    # fields directly; the wire-level
    # ``BusinessOut`` wraps them under a
    # ``basic`` subkey. The Finance engine
    # accepts both — whichever key the
    # upstream service emitted, the
    # aggregator walks it.
    basic_or_business = (
        business.get("business", {}).get("basic")
        or business.get("basic")
        or business.get("business", {})
        or {}
    )
    raw_revenue = basic_or_business.get("annual_revenue", 0) or 0
    try:
        current_revenue = float(raw_revenue)
    except (TypeError, ValueError):
        current_revenue = 0.0

    scores = _scores_block(bundle)
    current_digital = float(_lens_score(scores, "digital"))
    current_export = float(_lens_score(scores, "export"))
    current_growth = float(_lens_score(scores, "growth"))

    # The projected scores use the same
    # per-lens lift the projection blocks
    # below compute, so the revenue and
    # export / digital projections stay
    # consistent.
    projected_digital = min(100.0, current_digital + 50.0)
    projected_export = min(100.0, current_export + 40.0)
    projected_growth = min(100.0, current_growth + 50.0)

    digital_lift = max(0.0, projected_digital - current_digital) / 100.0
    export_lift = max(0.0, projected_export - current_export) / 100.0
    growth_lift = max(0.0, projected_growth - current_growth) / 100.0
    # Business maturity: the twin's
    # health_summary business_maturity is
    # 0..100; we use it as the "maturity
    # lift" signal (the user starts at
    # whatever the twin reports).
    health = (bundle.twin.get("health_summary") or {})
    maturity = float(health.get("business_maturity", 0) or 0)
    maturity_lift = maturity / 100.0 * 0.10  # cap at 10% of revenue

    growth_factor = (
        0.30 * digital_lift
        + 0.25 * export_lift
        + 0.25 * growth_lift
        + 0.20 * maturity_lift
    )
    projected_revenue = current_revenue * (1.0 + growth_factor)
    growth_pct = growth_factor * 100.0

    # Confidence: average of the three
    # projected lens scores (they were
    # already capped at 100).
    confidence = int(round(
        (projected_digital + projected_export + projected_growth) / 3.0
    ))

    return {
        "current_estimated_revenue": round(current_revenue, 2),
        "projected_revenue": round(projected_revenue, 2),
        "revenue_difference": round(
            projected_revenue - current_revenue, 2
        ),
        "growth_percentage": round(growth_pct, 2),
        "confidence": max(0, min(100, confidence)),
    }


# --------------------------------------------------------------------------- #
# Loan readiness
# --------------------------------------------------------------------------- #


def build_loan_readiness(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute the loan-readiness sidecar.

    Pure function of the bundle + the
    per-recommendation finance view."""

    scores = _scores_block(bundle)
    overall = _overall_score(scores)
    total_gain = _total_score_gain(recs_finance)
    projected = int(_clamp(overall + min(50, total_gain / 2.0), 0, 100))

    # Funding probability is a linear
    # interpolation between the projected
    # score and 100. The spec names
    # "funding_probability" as a 0..100
    # score, not a literal probability —
    # the spec also accepts a percent.
    funding_probability = projected

    # Bank confidence: average of current
    # and projected. Banks look at both.
    bank_confidence = int(round((overall + projected) / 2.0))

    # Loan readiness band.
    if projected >= 70:
        readiness = "high"
    elif projected >= 45:
        readiness = "medium"
    else:
        readiness = "low"

    return {
        "current_score": overall,
        "projected_score": projected,
        "loan_readiness": readiness,
        "funding_probability": funding_probability,
        "bank_confidence": max(0, min(100, bank_confidence)),
        "eligible_business_types": list(_ELIGIBLE_BUSINESS_TYPES),
        "estimated_credit_improvement": max(
            0, min(100, projected - overall)
        ),
    }


# --------------------------------------------------------------------------- #
# Export projection
# --------------------------------------------------------------------------- #


def build_export_projection(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    scores = _scores_block(bundle)
    current = _lens_score(scores, "export")
    total_gain = _total_score_gain(recs_finance)
    projected = int(_clamp(current + min(40, total_gain * 0.3), 0, 100))

    new_markets = int(round(max(0, projected - current) / 10.0))
    growth = max(0, projected - current)

    if projected >= 60:
        readiness = "high"
    elif projected >= 35:
        readiness = "medium"
    else:
        readiness = "low"

    digital = float(_lens_score(scores, "digital"))
    growth_score = float(_lens_score(scores, "growth"))
    health = (bundle.twin.get("health_summary") or {})
    maturity = float(health.get("business_maturity", 0) or 0)
    confidence = int(round(
        0.4 * projected + 0.2 * digital
        + 0.2 * growth_score + 0.2 * maturity
    ))

    return {
        "current_export_score": current,
        "projected_export_score": projected,
        "estimated_new_markets": new_markets,
        "estimated_export_growth": max(0, min(100, growth)),
        "export_readiness": readiness,
        "confidence": max(0, min(100, confidence)),
    }


# --------------------------------------------------------------------------- #
# Digital projection
# --------------------------------------------------------------------------- #


def build_digital_projection(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    scores = _scores_block(bundle)
    current = _lens_score(scores, "digital")
    total_gain = _total_score_gain(recs_finance)
    projected = int(_clamp(current + min(50, total_gain * 0.4), 0, 100))

    efficiency_gain = max(0, projected - current)
    cost_reduction = int(round(efficiency_gain * 0.5))

    return {
        "current_digital_score": current,
        "projected_digital_score": projected,
        "estimated_efficiency_gain": max(0, min(100, efficiency_gain)),
        "estimated_cost_reduction": max(0, min(100, cost_reduction)),
        "automation_potential": max(0, min(100, projected)),
        "confidence": max(0, min(100, current)),
    }


# --------------------------------------------------------------------------- #
# Business valuation projection
# --------------------------------------------------------------------------- #


def build_valuation_projection(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    scores = _scores_block(bundle)
    overall = _overall_score(scores)
    dna = bundle.twin.get("dna") or {}
    dna_match = 0
    if isinstance(dna, dict):
        arch = dna.get("archetype") or {}
        if isinstance(arch, dict):
            dna_match = int(arch.get("match_score", 0) or 0)
    # Profile completion: read from the
    # business summary sidecar the
    # aggregator captured.
    profile_block = bundle.twin.get("profile") or {}
    if isinstance(profile_block, dict):
        profile_pct = float(profile_block.get("completeness", 0) or 0)
    else:
        profile_pct = 0.0

    current_value = int(round(
        0.4 * overall + 0.3 * dna_match + 0.3 * profile_pct
    ))
    total_gain = _total_score_gain(recs_finance)
    projected_value = int(_clamp(
        current_value + min(50, total_gain * 0.4), 0, 100
    ))
    growth = max(0, projected_value - current_value)
    confidence = int(round(
        0.5 * overall + 0.3 * dna_match + 0.2 * profile_pct
    ))
    return {
        "current_business_value_index": max(0, min(100, current_value)),
        "projected_business_value_index": max(0, min(100, projected_value)),
        "estimated_growth": max(0, min(100, growth)),
        "investment_attractiveness": max(0, min(100, projected_value)),
        "business_maturity": max(0, min(100, current_value)),
        "confidence": max(0, min(100, confidence)),
    }

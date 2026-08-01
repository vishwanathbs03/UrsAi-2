"""Twin health summary.

The spec asks for ten readiness scores, all
0..100:

  * Overall Health
  * Business Maturity
  * Digital Maturity
  * Operational Maturity
  * Market Readiness
  * Investment Readiness
  * Export Readiness
  * Compliance Readiness
  * Growth Readiness
  * Innovation Readiness
  * Sustainability Readiness

(The list contains 11 names because "Overall
Health" is a separate aggregate; the spec text
says "10 readiness scores" — we emit all 11 so
the response shape matches the schema; the
overall_health is the headline rollup.)

Mapping to the upstream data
----------------------------

The Business Score Engine already produces
eight of these as named scores. We lift them
verbatim:

  * export, digital, compliance, growth,
    innovation, sustainability, risk, overall

The remaining three (Business Maturity,
Operational Maturity, Market Readiness,
Investment Readiness) are derived from the
upstream signals:

  * **Business Maturity** = the Business DNA's
    archetype match score, with a small uplift
    for profile completeness.
  * **Operational Maturity** = capacity
    utilization + production scale + the
    certifications / digital flags from the
    profile.
  * **Market Readiness** = export + digital
    lens scores averaged.
  * **Investment Readiness** = growth lens +
    innovation lens averaged.

Overall Health = weighted average of the 10
sub-scores (overall gets 20%, the others split
80% equally) so a single weak lens does not
collapse the headline.

Every formula is documented inline.
"""

from __future__ import annotations

from typing import Any


# Lens-key -> Health-summary-key. The Business
# Score Engine emits these as named scores; we
# lift them verbatim.
_LENS_MAP: dict[str, str] = {
    "export": "export_readiness",
    "digital": "digital_maturity",
    "compliance": "compliance_readiness",
    "growth": "growth_readiness",
    "innovation": "innovation_readiness",
    "sustainability": "sustainability_readiness",
}


def build_health_summary(
    *,
    scores_block: dict[str, Any],
    dna_block: dict[str, Any],
    profile_block: dict[str, Any],
) -> dict[str, Any]:
    """Build the 11-number health summary.

    The function is pure: same inputs, same
    outputs."""

    # ---- Lifted lens scores --------------------------- #
    by_key: dict[str, int] = {
        str(s.get("key", "")): int(s.get("score", 0) or 0)
        for s in (scores_block.get("scores") or [])
    }

    export_readiness = _clamp(by_key.get("export", 0))
    digital_maturity = _clamp(by_key.get("digital", 0))
    compliance_readiness = _clamp(by_key.get("compliance", 0))
    growth_readiness = _clamp(by_key.get("growth", 0))
    innovation_readiness = _clamp(by_key.get("innovation", 0))
    sustainability_readiness = _clamp(by_key.get("sustainability", 0))

    # ---- Derived scores ------------------------------- #
    # Business Maturity: DNA match + profile
    # completeness uplift. The DNA engine emits
    # the archetype match score; the profile
    # block has a "completeness" count.
    archetype_score = int(
        (dna_block.get("archetype") or {}).get("match_score", 0) or 0
    )
    business_maturity = _clamp(
        int(round(0.7 * archetype_score + 0.3 * _profile_completeness_score(profile_block)))
    )

    # Operational Maturity: capacity utilisation
    # (when present) + certifications + cloud
    # + digital-marketing flags. Each component
    # contributes a fixed share.
    cap = profile_block.get("capacity_utilization_pct")
    if isinstance(cap, int) and 0 <= cap <= 100:
        cap_score = cap
    else:
        cap_score = 50  # default for profiles that don't report capacity
    certs = int(profile_block.get("certifications_count", 0) or 0)
    cloud = bool(profile_block.get("uses_cloud_systems", False))
    dig_mkt = bool(profile_block.get("uses_digital_marketing", False))
    operational_maturity = _clamp(
        int(
            round(
                0.40 * cap_score
                + 0.20 * min(100, 25 * certs)  # 25 per cert, capped
                + 0.20 * (100 if cloud else 0)
                + 0.20 * (100 if dig_mkt else 0)
            )
        )
    )

    # Market Readiness: average of export + digital
    # lens scores.
    market_readiness = _clamp(int(round((export_readiness + digital_maturity) / 2)))

    # Investment Readiness: average of growth +
    # innovation lens scores. The two lenses are
    # the most relevant "are we ready to take
    # outside capital" signals the engine emits.
    investment_readiness = _clamp(
        int(round((growth_readiness + innovation_readiness) / 2))
    )

    # Overall Health: weighted rollup. Overall
    # gets 20% (it is already a composite); the
    # 10 sub-scores split 80% equally.
    sub_scores = [
        business_maturity,
        digital_maturity,
        operational_maturity,
        market_readiness,
        investment_readiness,
        export_readiness,
        compliance_readiness,
        growth_readiness,
        innovation_readiness,
        sustainability_readiness,
    ]
    overall_health = _clamp(
        int(
            round(
                0.20 * _clamp(int(scores_block.get("overall_score", 0) or 0))
                + 0.80 * (sum(sub_scores) / len(sub_scores))
            )
        )
    )

    return {
        "overall_health": overall_health,
        "business_maturity": business_maturity,
        "digital_maturity": digital_maturity,
        "operational_maturity": operational_maturity,
        "market_readiness": market_readiness,
        "investment_readiness": investment_readiness,
        "export_readiness": export_readiness,
        "compliance_readiness": compliance_readiness,
        "growth_readiness": growth_readiness,
        "innovation_readiness": innovation_readiness,
        "sustainability_readiness": sustainability_readiness,
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _profile_completeness_score(profile_block: dict) -> int:
    """A simple 0..100 profile-completeness score
    derived from the profile flags. The mapping is
    the same formula the Business Intelligence /
    Sprint 4 Polish work uses, so the front-end
    number is consistent across the dashboard and
    the twin."""
    score = 0
    score += 18 if profile_block.get("has_website") else 0
    score += 8 if profile_block.get("has_ecommerce") else 0
    score += 8 if profile_block.get("uses_digital_marketing") else 0
    score += 8 if profile_block.get("uses_cloud_systems") else 0
    score += 8 if profile_block.get("has_active_certification") else 0
    score += 8 if profile_block.get("has_iec_number") else 0
    social = int(profile_block.get("social_channel_count", 0) or 0)
    score += min(social, 3) * 6  # 6 per channel, capped at 3
    score += 10 if profile_block.get("export_countries", 0) else 0
    score += 8 if profile_block.get("goals_count", 0) else 0
    score += 8 if profile_block.get("challenges_count", 0) else 0
    score += 8 if profile_block.get("products_count", 0) else 0
    return _clamp(score)


def _clamp(n: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, int(n)))

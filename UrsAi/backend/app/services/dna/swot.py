"""SWOT composer.

The DNA engine produces a Strengths / Weaknesses / Opportunities /
Risk Areas block on top of the archetype + traits. This is NOT a
"Rule Engine" — it is a transparent composition of findings
from the 8 score levels and the 5 secondary traits.

Each finding has:
  * ``title`` (1-3 words)
  * ``detail`` (one sentence)
  * ``severity`` ("info" | "low" | "medium" | "high")
  * ``source_key`` (the score / trait that produced it)

A finding is a *declarative* rule: "if score.x.level is High
and signal.x is true, emit this finding." There is no dynamic
rule dispatch — the rules are spelled out in this file as
plain Python ``if`` blocks, exactly as the rest of the engine
is. Adding a new finding means adding a new function call to
``compose_swot``.
"""

from __future__ import annotations

from app.services.dna.base import Finding
from app.services.dna.signal_extractor import SignalMap


def _score(sig: SignalMap, key: str) -> int:
    try:
        return int(sig.get(key, 0))
    except (TypeError, ValueError):
        return 0


def _is_high(sig: SignalMap, key: str) -> bool:
    """True when a 0..100 score is at or above 60 (the 'High'
    band on the 4-band system the score engine uses)."""
    return _score(sig, key) >= 60


def _is_excellent(sig: SignalMap, key: str) -> bool:
    return _score(sig, key) >= 80


def _is_low(sig: SignalMap, key: str) -> bool:
    return _score(sig, key) < 40


# --------------------------------------------------------------------------- #
# Strengths — what the business does well
# --------------------------------------------------------------------------- #


def _strengths(sig: SignalMap) -> list[Finding]:
    out: list[Finding] = []
    if _is_excellent(sig, "score.export.score"):
        out.append(Finding(
            title="Strong export posture",
            detail="Export score is excellent — products, IEC, and history are in place.",
            severity="info",
            source_key="score.export",
        ))
    if _is_excellent(sig, "score.digital.score"):
        out.append(Finding(
            title="Mature digital presence",
            detail="Digital score is excellent — website, social, and e-commerce all active.",
            severity="info",
            source_key="score.digital",
        ))
    if _is_high(sig, "score.compliance.score"):
        out.append(Finding(
            title="Audit-ready compliance",
            detail="Compliance score is high — at least one active certification on file.",
            severity="info",
            source_key="score.compliance",
        ))
    if _is_high(sig, "score.growth.score"):
        out.append(Finding(
            title="Operational growth capacity",
            detail="Growth score is high — employees, production, and goals are documented.",
            severity="info",
            source_key="score.growth",
        ))
    if _is_excellent(sig, "score.innovation.score"):
        out.append(Finding(
            title="Strong innovation signals",
            detail="Innovation score is excellent — e-commerce, cloud, and digital marketing all present.",
            severity="info",
            source_key="score.innovation",
        ))
    if _is_high(sig, "score.sustainability.score"):
        out.append(Finding(
            title="Long-term sustainability",
            detail="Sustainability score is high — revenue, employees, and capacity documented.",
            severity="info",
            source_key="score.sustainability",
        ))
    if _is_excellent(sig, "score.risk.score"):
        out.append(Finding(
            title="Diversified and low-risk",
            detail="Risk score is excellent — diversification across products, markets, and channels.",
            severity="info",
            source_key="score.risk",
        ))
    return out


# --------------------------------------------------------------------------- #
# Weaknesses — concrete gaps in the current profile
# --------------------------------------------------------------------------- #


def _weaknesses(sig: SignalMap) -> list[Finding]:
    out: list[Finding] = []
    if _is_low(sig, "intelligence.compliance_readiness.active_certification"):
        out.append(Finding(
            title="No active certification",
            detail="Compliance readiness is missing at least one active certification.",
            severity="high",
            source_key="compliance_readiness.active_certification",
        ))
    if _is_low(sig, "intelligence.export_readiness.iec_number"):
        out.append(Finding(
            title="No IEC number",
            detail="Export readiness is missing the IEC number, a legal prerequisite in most jurisdictions.",
            severity="high",
            source_key="export_readiness.iec_number",
        ))
    if _is_low(sig, "intelligence.digital_readiness.website"):
        out.append(Finding(
            title="No business website",
            detail="Digital readiness is missing a website — the baseline of online presence.",
            severity="medium",
            source_key="digital_readiness.website",
        ))
    if _is_low(sig, "intelligence.growth_readiness.goals_declared"):
        out.append(Finding(
            title="No declared goals",
            detail="Growth readiness is missing declared business goals.",
            severity="medium",
            source_key="growth_readiness.goals_declared",
        ))
    if _is_low(sig, "intelligence.growth_readiness.employee_count"):
        out.append(Finding(
            title="No employees reported",
            detail="Growth readiness is missing employee count — execution risk is harder to assess.",
            severity="medium",
            source_key="growth_readiness.employee_count",
        ))
    if _is_low(sig, "intelligence.profile_completeness.products"):
        out.append(Finding(
            title="No products",
            detail="Profile completeness is missing a product catalog.",
            severity="high",
            source_key="profile_completeness.products",
        ))
    if _is_low(sig, "intelligence.profile_completeness.basic.annual_revenue"):
        out.append(Finding(
            title="No revenue reported",
            detail="Profile completeness is missing annual revenue — financial transparency is low.",
            severity="medium",
            source_key="profile_completeness.basic.annual_revenue",
        ))
    return out


# --------------------------------------------------------------------------- #
# Opportunities — concrete things the business could do next
# --------------------------------------------------------------------------- #


def _opportunities(sig: SignalMap) -> list[Finding]:
    out: list[Finding] = []
    # Export opportunity: business has products but no documented
    # export history.
    has_products = _is_high(sig, "intelligence.profile_completeness.products")
    no_export = _is_low(sig, "intelligence.export_readiness.export_history")
    if has_products and no_export:
        out.append(Finding(
            title="Export existing products",
            detail="A product catalog is in place but no export history — international expansion is the obvious next step.",
            severity="medium",
            source_key="export_readiness.export_history",
        ))
    # Certification opportunity: business is operational but
    # has no active certification.
    is_operational = _is_high(sig, "intelligence.growth_readiness.employee_count")
    no_cert = _is_low(sig, "intelligence.compliance_readiness.active_certification")
    if is_operational and no_cert:
        out.append(Finding(
            title="Pursue a first certification",
            detail="Operational foundations are in place; an ISO or sector certification would unlock new buyers.",
            severity="medium",
            source_key="compliance_readiness.active_certification",
        ))
    # E-commerce opportunity: has a website but no e-commerce.
    has_web = _is_high(sig, "intelligence.digital_readiness.website")
    no_ecom = _is_low(sig, "intelligence.digital_readiness.ecommerce")
    if has_web and no_ecom:
        out.append(Finding(
            title="Activate e-commerce",
            detail="A website exists but e-commerce is not enabled — turning the site into a sales channel is the next move.",
            severity="low",
            source_key="digital_readiness.ecommerce",
        ))
    # Goal-setting opportunity: profile is complete but no
    # goals declared.
    profile_high = _is_high(sig, "intelligence.profile_completeness.score")
    no_goals = _is_low(sig, "intelligence.growth_readiness.goals_declared")
    if profile_high and no_goals:
        out.append(Finding(
            title="Declare growth goals",
            detail="The profile is solid but no goals are declared — formal targets would sharpen direction.",
            severity="low",
            source_key="growth_readiness.goals_declared",
        ))
    # Diversification: only 1 export destination.
    diversity = _score(sig, "intelligence.export_readiness.export_diversity")
    has_export = _is_high(sig, "intelligence.export_readiness.export_history")
    if has_export and 0 < diversity <= 6:
        out.append(Finding(
            title="Diversify export markets",
            detail="Exporting to one or two destinations — adding a third would lower concentration risk.",
            severity="low",
            source_key="export_readiness.export_diversity",
        ))
    return out


# --------------------------------------------------------------------------- #
# Risk Areas — exposure that the score engine flagged
# --------------------------------------------------------------------------- #


def _risk_areas(sig: SignalMap) -> list[Finding]:
    out: list[Finding] = []
    # Single-market risk: has exports but only 1 destination.
    diversity = _score(sig, "intelligence.export_readiness.export_diversity")
    has_export = _is_high(sig, "intelligence.export_readiness.export_history")
    if has_export and diversity <= 3:
        out.append(Finding(
            title="Single-market export exposure",
            detail="Exporting to a single destination — concentration risk if that market contracts.",
            severity="medium",
            source_key="export_readiness.export_diversity",
        ))
    # Compliance risk: no active certifications.
    if _is_low(sig, "score.compliance.score"):
        out.append(Finding(
            title="Compliance exposure",
            detail="No active certifications on file — buyers in regulated markets will reject the business.",
            severity="high",
            source_key="score.compliance",
        ))
    # No digital presence at all.
    if _is_low(sig, "score.digital.score"):
        out.append(Finding(
            title="No digital footprint",
            detail="Digital presence is minimal — the business is invisible to online-first buyers.",
            severity="high",
            source_key="score.digital",
        ))
    # Single-point-of-failure: no employees reported.
    if _is_low(sig, "intelligence.growth_readiness.employee_count"):
        out.append(Finding(
            title="Single-point-of-failure risk",
            detail="No employees reported — execution depends on a single person.",
            severity="medium",
            source_key="growth_readiness.employee_count",
        ))
    # High risk score (i.e. low resilience) is itself a flag.
    if _is_low(sig, "score.risk.score"):
        out.append(Finding(
            title="Concentrated risk profile",
            detail="Risk score is low — the business is exposed across multiple dimensions.",
            severity="high",
            source_key="score.risk",
        ))
    return out


# --------------------------------------------------------------------------- #
# Public composer
# --------------------------------------------------------------------------- #


def compose_swot(sig: SignalMap) -> tuple[list[Finding], list[Finding], list[Finding], list[Finding]]:
    """Return ``(strengths, weaknesses, opportunities, risk_areas)``.

    The four lists are independent and stable. The composer
    itself is pure: same signal table in, same lists out.
    """
    return (
        _strengths(sig),
        _weaknesses(sig),
        _opportunities(sig),
        _risk_areas(sig),
    )

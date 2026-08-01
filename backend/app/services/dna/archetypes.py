"""Archetype definitions for the Business DNA Engine.

Seven archetypes, each a deterministic classifier. The contract:

* Every archetype has a stable ``key`` and a user-facing
  ``title`` and ``description``.
* :func:`match_score` returns a 0..100 score (or 0 if the
  archetype is impossible given the signals).
* :func:`rationale` returns the per-archetype reasoning trace —
  every signal that contributed, with its label.

The classifier in :mod:`app.services.dna.dna_builder` iterates
all archetypes, picks the highest-scoring one, and surfaces the
runner-up so the UI can show how decisive the assignment was.

Why seven and not fifty?
------------------------

A long archetype list is a smell — it usually means the
classifier is overfit and the labels stop being meaningful. Seven
archetypes is the smallest list that covers the genuine modes
the Business Digital Twin can distinguish today. Each one is
anchored to a concrete, testable combination of intelligence +
score signals.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from app.services.dna.base import Rationale
from app.services.dna.signal_extractor import SignalMap


# --------------------------------------------------------------------------- #
# Archetype definition
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ArchetypeDef:
    """One archetype, declared once."""

    key: str
    title: str
    description: str
    #: Function that returns a 0..100 match score from the
    #: signal table. Return 0 to mean "this archetype is not
    #: applicable for this business".
    scorer: Callable[[SignalMap], int]
    #: Function that returns the per-signal rationale for the
    #: match (the UI shows these under the archetype title).
    explainer: Callable[[SignalMap], list[Rationale]]


def _safe_score(sig: SignalMap, key: str, default: int = 0) -> int:
    v = sig.get(key, default)
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# The seven archetypes
# --------------------------------------------------------------------------- #


def _arch_global_exporter() -> ArchetypeDef:
    """The Global Exporter.

    High Export + high Compliance + production capacity + at
    least one documented export destination. This is the
    "world-ready" archetype: the business has both the
    product and the paperwork to ship internationally.
    """

    def scorer(sig: SignalMap) -> int:
        # Hard preconditions: must have a documented export
        # history + production capacity. Without these the
        # archetype is impossible.
        if not sig.get("signal.has_export_history"):
            return 0
        if not sig.get("signal.has_production_capacity"):
            return 0
        # Weighted sum, capped at 100.
        s = 0
        s += int(0.30 * _safe_score(sig, "score.export.score"))
        s += int(0.20 * _safe_score(sig, "score.compliance.score"))
        s += int(0.20 * _safe_score(sig, "intelligence.export_readiness.export_diversity", 0) * 10)
        s += int(0.15 * _safe_score(sig, "score.risk.score"))
        s += int(0.10 * _safe_score(sig, "intelligence.compliance_readiness.active_certification", 0) * 2.5)
        s += 5 if sig.get("signal.has_iec") else 0  # IEC bonus
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Documented export history confirms international activity.",
                signal=sig.label("signal.has_export_history"),
                source_key=sig.source_key("signal.has_export_history"),
            ),
            Rationale(
                claim="Production capacity indicates the business can fulfill export orders.",
                signal=sig.label("signal.has_production_capacity"),
                source_key=sig.source_key("signal.has_production_capacity"),
            ),
            Rationale(
                claim="Export score dominates the match.",
                signal=f"Export score = {_safe_score(sig, 'score.export.score')}",
                source_key="score.export",
            ),
            Rationale(
                claim="Compliance score provides the paperwork half of the picture.",
                signal=f"Compliance score = {_safe_score(sig, 'score.compliance.score')}",
                source_key="score.compliance",
            ),
        ]

    return ArchetypeDef(
        key="global_exporter",
        title="The Global Exporter",
        description=(
            "Documented export history, production capacity, and "
            "compliance posture position this business to win in "
            "international markets."
        ),
        scorer=scorer,
        explainer=explainer,
    )


def _arch_digital_native() -> ArchetypeDef:
    """The Digital Native.

    High Digital + high Innovation, with weak/no traditional
    export. The business is online-first, with or without
    international reach.

    Excludes businesses that are clearly exporters — if the
    export score is excellent AND the business has documented
    export history, the Global Exporter archetype is a more
    accurate descriptor. (Specificity over generic.)
    """

    def scorer(sig: SignalMap) -> int:
        # Digital natives don't need to export — but they do
        # need a strong digital + innovation signal.
        digital = _safe_score(sig, "score.digital.score")
        innovation = _safe_score(sig, "score.innovation.score")
        if digital < 50 or innovation < 40:
            return 0
        # Hand off to the Global Exporter when the business
        # is unambiguously an exporter.
        export_score = _safe_score(sig, "score.export.score")
        if export_score >= 80 and sig.get("signal.has_export_history"):
            return 0
        s = 0
        s += int(0.40 * digital)
        s += int(0.30 * innovation)
        s += int(0.15 * _safe_score(sig, "intelligence.digital_readiness.social_channels", 0) * 5)
        s += int(0.10 * _safe_score(sig, "intelligence.digital_readiness.ecommerce", 0) * 5)
        s += 5 if sig.get("signal.has_website") else 0
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Digital maturity is the dominant trait.",
                signal=f"Digital score = {_safe_score(sig, 'score.digital.score')}",
                source_key="score.digital",
            ),
            Rationale(
                claim="Innovation signals reinforce the digital-first posture.",
                signal=f"Innovation score = {_safe_score(sig, 'score.innovation.score')}",
                source_key="score.innovation",
            ),
        ]

    return ArchetypeDef(
        key="digital_native",
        title="The Digital Native",
        description=(
            "Online-first posture with active digital channels and "
            "innovation signals; international reach may be "
            "undeveloped."
        ),
        scorer=scorer,
        explainer=explainer,
    )


def _arch_compliance_leader() -> ArchetypeDef:
    """The Compliance Leader.

    High Compliance + multiple active certifications. The
    business has invested in process and paperwork.
    """

    def scorer(sig: SignalMap) -> int:
        if not sig.get("signal.has_multiple_active_certs"):
            return 0
        s = 0
        s += int(0.50 * _safe_score(sig, "score.compliance.score"))
        s += int(0.30 * _safe_score(sig, "intelligence.compliance_readiness.multiple_certifications", 0) * 10)
        s += int(0.20 * _safe_score(sig, "intelligence.compliance_readiness.active_certification", 0) * 2.5)
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Multiple active certifications confirm a process-driven posture.",
                signal=sig.label("signal.has_multiple_active_certs"),
                source_key=sig.source_key("signal.has_multiple_active_certs"),
            ),
            Rationale(
                claim="Compliance score is the dominant trait.",
                signal=f"Compliance score = {_safe_score(sig, 'score.compliance.score')}",
                source_key="score.compliance",
            ),
        ]

    return ArchetypeDef(
        key="compliance_leader",
        title="The Compliance Leader",
        description=(
            "Multiple active certifications indicate a business "
            "that has invested in process quality and audit "
            "readiness."
        ),
        scorer=scorer,
        explainer=explainer,
    )


def _arch_growth_operator() -> ArchetypeDef:
    """The Growth Operator.

    High Growth + production + employees + goals. The business
    is operating and planning to expand.

    Excludes businesses that are clearly exporters — if the
    export score is excellent AND the business has documented
    export history, the Global Exporter archetype is a more
    specific descriptor.
    """

    def scorer(sig: SignalMap) -> int:
        if not sig.get("signal.has_goals"):
            return 0
        if not sig.get("signal.has_employees"):
            return 0
        export_score = _safe_score(sig, "score.export.score")
        if export_score >= 80 and sig.get("signal.has_export_history"):
            return 0
        s = 0
        s += int(0.40 * _safe_score(sig, "score.growth.score"))
        s += int(0.20 * _safe_score(sig, "intelligence.growth_readiness.goals_declared", 0) * 10)
        s += int(0.20 * _safe_score(sig, "intelligence.growth_readiness.employee_count", 0) * 2.5)
        s += int(0.20 * _safe_score(sig, "intelligence.growth_readiness.monthly_production", 0) * 5)
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Declared growth goals indicate direction.",
                signal=sig.label("signal.has_goals"),
                source_key=sig.source_key("signal.has_goals"),
            ),
            Rationale(
                claim="Reported employees indicate scale beyond the founder.",
                signal=sig.label("signal.has_employees"),
                source_key=sig.source_key("signal.has_employees"),
            ),
            Rationale(
                claim="Growth score is the dominant trait.",
                signal=f"Growth score = {_safe_score(sig, 'score.growth.score')}",
                source_key="score.growth",
            ),
        ]

    return ArchetypeDef(
        key="growth_operator",
        title="The Growth Operator",
        description=(
            "Operating at scale with declared goals and "
            "production — this business is on a growth path."
        ),
        scorer=scorer,
        explainer=explainer,
    )


def _arch_local_established() -> ArchetypeDef:
    """The Local Established Player.

    High Profile Completeness + revenue + employees, but no
    documented export activity. The business is a solid
    domestic operator.
    """

    def scorer(sig: SignalMap) -> int:
        if not sig.get("signal.revenue_reported"):
            return 0
        if sig.get("signal.has_export_history"):
            return 0  # If you export, you belong to a different archetype.
        s = 0
        s += int(0.40 * _safe_score(sig, "intelligence.profile_completeness.score"))
        s += int(0.25 * _safe_score(sig, "intelligence.growth_readiness.employee_count", 0) * 2.5)
        s += int(0.20 * _safe_score(sig, "intelligence.profile_completeness.basic.annual_revenue", 0) * 5)
        s += int(0.15 * _safe_score(sig, "score.sustainability.score"))
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Revenue is reported, but no export history.",
                signal=sig.label("signal.revenue_reported"),
                source_key=sig.source_key("signal.revenue_reported"),
            ),
            Rationale(
                claim="Profile completeness is the dominant signal.",
                signal=(
                    "Profile completeness score = "
                    f"{_safe_score(sig, 'intelligence.profile_completeness.score')}"
                ),
                source_key="intelligence.profile_completeness",
            ),
        ]

    return ArchetypeDef(
        key="local_established",
        title="The Local Established Player",
        description=(
            "A complete profile with revenue and employees, but "
            "no documented international activity. A solid "
            "domestic operator with room to grow into exports."
        ),
        scorer=scorer,
        explainer=explainer,
    )


def _arch_emerging_builder() -> ArchetypeDef:
    """The Emerging Builder.

    Mid Profile + mid Digital, with low compliance and low
    export. The business is past the very-first-step but not
    yet at "established" — exactly the in-between state.
    """

    def scorer(sig: SignalMap) -> int:
        profile = _safe_score(sig, "intelligence.profile_completeness.score")
        digital = _safe_score(sig, "intelligence.digital_readiness.score")
        export = _safe_score(sig, "intelligence.export_readiness.score")
        compliance = _safe_score(sig, "intelligence.compliance_readiness.score")
        # Mid band on profile + digital, no high band on export / compliance.
        if not (30 <= profile <= 75):
            return 0
        if not (25 <= digital <= 75):
            return 0
        if export > 50 or compliance > 60:
            return 0  # Those businesses belong elsewhere.
        s = 0
        s += int(0.30 * profile)
        s += int(0.30 * digital)
        s += int(0.20 * _safe_score(sig, "intelligence.profile_completeness.products", 0) * 10)
        s += int(0.20 * _safe_score(sig, "intelligence.digital_readiness.website", 0) * 5)
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Profile is mid-range (partially complete, not done).",
                signal=(
                    "Profile completeness score = "
                    f"{_safe_score(sig, 'intelligence.profile_completeness.score')}"
                ),
                source_key="intelligence.profile_completeness",
            ),
            Rationale(
                claim="Digital presence is mid-range.",
                signal=(
                    "Digital readiness score = "
                    f"{_safe_score(sig, 'intelligence.digital_readiness.score')}"
                ),
                source_key="intelligence.digital_readiness",
            ),
        ]

    return ArchetypeDef(
        key="emerging_builder",
        title="The Emerging Builder",
        description=(
            "Past the very-first-step, not yet established — "
            "this business has the basics in place but is "
            "missing a few key pillars."
        ),
        scorer=scorer,
        explainer=explainer,
    )


def _arch_foundation_builder() -> ArchetypeDef:
    """The Foundation Builder.

    Low scores across the board. The business is in the
    earliest stage of structured data collection. This
    archetype is the *default* — it matches anything that
    does not match a more specific archetype.
    """

    def scorer(sig: SignalMap) -> int:
        # Always applicable. The score reflects how empty the
        # business is, inverted: a completely empty profile
        # returns 100 (so this archetype dominates), a richer
        # profile returns a low score (so it loses to a
        # better-fitting archetype).
        profile = _safe_score(sig, "intelligence.profile_completeness.score")
        s = max(20, 100 - profile)
        return max(0, min(100, s))

    def explainer(sig: SignalMap) -> list[Rationale]:
        return [
            Rationale(
                claim="Profile is in early draft — multiple sections are missing.",
                signal=(
                    "Profile completeness score = "
                    f"{_safe_score(sig, 'intelligence.profile_completeness.score')}"
                ),
                source_key="intelligence.profile_completeness",
            ),
            Rationale(
                claim="No specific archetype matches more strongly.",
                signal="This is the catch-all early-stage archetype.",
            ),
        ]

    return ArchetypeDef(
        key="foundation_builder",
        title="The Foundation Builder",
        description=(
            "The business is in the early stage of structured "
            "data collection — complete the profile to unlock "
            "a more specific DNA."
        ),
        scorer=scorer,
        explainer=explainer,
    )


# --------------------------------------------------------------------------- #
# Public registry — order is the order the UI lists them in
# --------------------------------------------------------------------------- #


ALL_ARCHETYPES: tuple[ArchetypeDef, ...] = (
    _arch_global_exporter(),
    _arch_digital_native(),
    _arch_compliance_leader(),
    _arch_growth_operator(),
    _arch_local_established(),
    _arch_emerging_builder(),
    _arch_foundation_builder(),
)

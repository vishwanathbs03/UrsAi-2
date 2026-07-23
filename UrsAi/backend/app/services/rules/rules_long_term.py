"""Long-term improvement rules.

These fire when a *strategic* gap exists — something the
business can address over months, not weeks. They are
prioritised below medium-priority rules but the engine still
fires them so the UI can show a "12-month view" of the work.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


def _no_declared_goals(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_goals"):
        return None
    return ("No business goals are declared; long-term direction is unclear.", 10, 0.8)


def _single_destination(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if not sig.flag("flag.has_export_history"):
        return None
    diversity = sig.score("intelligence.export_readiness.export_diversity", 0)
    if diversity > 6:  # 6 == two destinations
        return None
    return ("Exports are concentrated in one or two destinations; long-term diversification gap.", 10, 0.7)


def _low_sustainability(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.sustainability.score", 0)
    if s >= 60:
        return None
    return (f"Sustainability score is {s}; long-term resilience gap.", 60 - s, 0.9)


def _no_innovation_signals(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.innovation.score", 0)
    if s >= 50:
        return None
    return (f"Innovation score is {s}; long-term innovation gap.", 50 - s, 0.7)


def _single_archetype_fatigue(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    """If the DNA archetype is Foundation Builder for a long
    time, the engine flags it as a long-term data-collection
    debt. This rule is informational; it does not weight heavily
    in the dashboard.
    """
    if sig.get("dna.archetype.key", "") != "foundation_builder":
        return None
    return ("DNA archetype is the catch-all Foundation Builder; richer data will unlock a more specific DNA.", 20, 0.4)


ALL: tuple[RuleDef, ...] = (
    RuleDef(
        id="long_term.no_declared_goals",
        title="No declared business goals",
        description="No business goals are declared; long-term direction is unclear.",
        category="long_term",
        priority="Low",
        source_keys=("growth_readiness.goals_declared",),
        firer=_no_declared_goals,
    ),
    RuleDef(
        id="long_term.single_destination",
        title="Exports concentrated in one or two destinations",
        description="Exports are concentrated in a small number of destinations; long-term diversification gap.",
        category="long_term",
        priority="Low",
        source_keys=("export_readiness.export_diversity",),
        firer=_single_destination,
    ),
    RuleDef(
        id="long_term.low_sustainability",
        title="Sustainability score below 60",
        description="Sustainability score is below 60; long-term resilience gap.",
        category="long_term",
        priority="Medium",
        source_keys=("score.sustainability",),
        firer=_low_sustainability,
    ),
    RuleDef(
        id="long_term.no_innovation_signals",
        title="Innovation signals are weak",
        description="Innovation score is below 50; long-term innovation gap.",
        category="long_term",
        priority="Low",
        source_keys=("score.innovation",),
        firer=_no_innovation_signals,
    ),
    RuleDef(
        id="long_term.foundation_builder_archetype",
        title="DNA is the catch-all Foundation Builder",
        description="DNA archetype is the catch-all Foundation Builder; richer data will unlock a more specific DNA.",
        category="long_term",
        priority="Low",
        source_keys=("dna.archetype",),
        firer=_single_archetype_fatigue,
    ),
)

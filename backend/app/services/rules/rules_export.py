"""Export-readiness rules.

These fire when the export pillar has a concrete missing
element. Distinct from the generic "high priority" pillar
rules — these name the specific export items.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


def _no_export_history(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_export_history"):
        return None
    return ("No export history is recorded.", 20, 1.0)


def _no_iec(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_iec"):
        return None
    return ("No IEC number is registered on any export row.", 20, 1.3)


def _no_exported_products(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.score("intelligence.export_readiness.is_exported_flag", 0) > 0:
        return None
    return ("No products are flagged as exported in the catalog.", 20, 1.0)


def _no_export_value(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_export_history"):
        # If history exists, the value may still be missing — but
        # that's a Medium concern, not an immediate one.
        if sig.score("intelligence.export_readiness.export_value", 0) == 0:
            return ("Export history exists but no annual export value is reported.", 15, 0.6)
        return None
    return None


def _low_diversity(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if not sig.flag("flag.has_export_history"):
        return None
    diversity = sig.score("intelligence.export_readiness.export_diversity", 0)
    if diversity >= 6:  # 2+ destinations
        return None
    return ("Export destinations are not diversified; a single-market exposure exists.", 10, 0.7)


def _export_score_medium(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.export.score", 0)
    if not (40 <= s < 60):
        return None
    return (f"Export score is {s}; specific export documentation gaps remain.", 60 - s, 0.8)


ALL: tuple[RuleDef, ...] = (
    RuleDef(
        id="export_readiness.no_history",
        title="No export history",
        description="No export history is recorded.",
        category="export_readiness_actions",
        priority="High",
        source_keys=("export_readiness.export_history",),
        firer=_no_export_history,
    ),
    RuleDef(
        id="export_readiness.no_iec",
        title="No IEC number",
        description="No IEC number is registered on any export row.",
        category="export_readiness_actions",
        priority="High",
        source_keys=("export_readiness.iec_number",),
        firer=_no_iec,
    ),
    RuleDef(
        id="export_readiness.no_exported_products",
        title="No products flagged for export",
        description="No products are flagged as exported in the catalog.",
        category="export_readiness_actions",
        priority="Medium",
        source_keys=("export_readiness.is_exported_flag",),
        firer=_no_exported_products,
    ),
    RuleDef(
        id="export_readiness.no_value",
        title="Annual export value not reported",
        description="Export history exists but no annual export value is reported on the rows.",
        category="export_readiness_actions",
        priority="Medium",
        source_keys=("export_readiness.export_value",),
        firer=_no_export_value,
    ),
    RuleDef(
        id="export_readiness.low_diversity",
        title="Low destination diversity",
        description="Export destinations are not diversified; a single-market exposure exists.",
        category="export_readiness_actions",
        priority="Low",
        source_keys=("export_readiness.export_diversity",),
        firer=_low_diversity,
    ),
    RuleDef(
        id="export_readiness.score_medium",
        title="Export score in the Medium band",
        description="Export score is in the Medium band; specific export documentation gaps remain.",
        category="export_readiness_actions",
        priority="Medium",
        source_keys=("score.export",),
        firer=_export_score_medium,
    ),
)

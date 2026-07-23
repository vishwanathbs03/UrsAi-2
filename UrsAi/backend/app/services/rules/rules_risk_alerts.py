"""Risk-alert rules.

These fire when the risk score is below threshold or when the
DNA SWOT produced a high-severity risk area. The UI renders
these in a dedicated "risk" panel.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


def _risk_score_low(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.risk.score", 0)
    if s >= 40:
        return None
    return (f"Risk score is in the Low band at {s}.", 40 - s, 1.3)


def _risk_score_medium(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.risk.score", 0)
    if not (40 <= s < 60):
        return None
    return (f"Risk score is in the Medium band at {s}.", 60 - s, 0.9)


def _dna_high_risk_count(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    n = sig.score("dna.finding.severity_high", 0)
    if n == 0:
        return None
    return (f"DNA flagged {n} high-severity risk area(s).", min(100, n * 25), 1.2)


def _single_market_export(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if not sig.flag("flag.has_export_history"):
        return None
    diversity = sig.score("intelligence.export_readiness.export_diversity", 0)
    if diversity > 3:  # >1 destination is not single-market
        return None
    return ("Exporting to a single destination; concentration risk.", 30, 1.0)


def _compliance_exposure(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.compliance.score", 0)
    if s >= 40:
        return None
    return (f"Compliance score is {s}; buyers in regulated markets will reject the business.", 40 - s, 1.3)


ALL: tuple[RuleDef, ...] = (
    RuleDef(
        id="risk_alerts.score_low",
        title="Risk score is in the Low band",
        description="Risk score is in the Low band; the business is exposed across multiple dimensions.",
        category="risk_alerts",
        priority="High",
        source_keys=("score.risk",),
        firer=_risk_score_low,
    ),
    RuleDef(
        id="risk_alerts.score_medium",
        title="Risk score is in the Medium band",
        description="Risk score is in the Medium band; a few concentration gaps remain.",
        category="risk_alerts",
        priority="Medium",
        source_keys=("score.risk",),
        firer=_risk_score_medium,
    ),
    RuleDef(
        id="risk_alerts.dna_high_count",
        title="DNA flagged high-severity risk areas",
        description="DNA flagged one or more high-severity risk areas in the SWOT.",
        category="risk_alerts",
        priority="High",
        source_keys=("dna.finding.severity_high",),
        firer=_dna_high_risk_count,
    ),
    RuleDef(
        id="risk_alerts.single_market_export",
        title="Single-market export exposure",
        description="Exports are concentrated in a single destination; concentration risk if that market contracts.",
        category="risk_alerts",
        priority="Medium",
        source_keys=("export_readiness.export_diversity",),
        firer=_single_market_export,
    ),
    RuleDef(
        id="risk_alerts.compliance_exposure",
        title="Compliance exposure",
        description="Compliance score is below 40; regulated-market buyers will reject the business.",
        category="risk_alerts",
        priority="High",
        source_keys=("score.compliance",),
        firer=_compliance_exposure,
    ),
)

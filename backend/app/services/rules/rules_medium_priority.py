"""Medium-priority rules.

These fire when a major pillar is in the 40..59 range (the
"Medium" band) or when a specific intelligence breakdown item
is missing but the overall pillar is still passing. The UI
should put these in the "yellow" column.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


_PILLARS = (
    ("score.export.score", "score.export", "Export Readiness", 0.9),
    ("score.digital.score", "score.digital", "Digital Readiness", 0.8),
    ("score.compliance.score", "score.compliance", "Compliance Readiness", 1.0),
    ("score.growth.score", "score.growth", "Growth Readiness", 0.8),
    ("score.innovation.score", "score.innovation", "Innovation Score", 0.7),
    ("score.sustainability.score", "score.sustainability", "Sustainability Score", 0.7),
)


def _make_pillar_medium_rules():
    rules: list[RuleDef] = []
    for score_key, source_key, title, weight in _PILLARS:
        def _make_firer(sk=score_key, ti=title, w=weight):
            def _firer(sig: RuleSignalMap) -> tuple[str, int, int] | None:
                s = sig.score(sk, 0)
                if not (40 <= s < 60):
                    return None
                return (f"{ti} is in the Medium band at {s}.", 60 - s, w)
            return _firer
        rules.append(RuleDef(
            id=f"medium.pillar_medium.{source_key.split('.')[-1]}",
            title=f"{title} is in the Medium band",
            description=(
                f"A pillar in the 40..59 range means the business has "
                f"some elements of {title.lower()} but is not yet "
                f"at the High band."
            ),
            category="medium_priority",
            priority="Medium",
            source_keys=(source_key,),
            firer=_make_firer(),
        ))
    return rules


def _missing_iec(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_iec"):
        return None
    if sig.flag("flag.has_export_history"):
        return None  # if exports exist without IEC, the immediate rule already fires
    return ("IEC number is not registered; future export activity will be blocked.", 20, 0.9)


def _missing_active_cert(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_active_cert"):
        return None
    if sig.score("score.compliance.score", 0) >= 60:
        return None  # compliance already strong via other signals
    return ("No active certification is on file; compliance gap.", 30, 0.9)


def _no_employees(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_employees"):
        return None
    return ("Employees count is not reported; execution capacity is unclear.", 5, 0.7)


def _revenue_not_reported(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.revenue_reported"):
        return None
    return ("Annual revenue is not reported; financial transparency is low.", 5, 0.7)


ALL: tuple[RuleDef, ...] = (
    *_make_pillar_medium_rules(),
    RuleDef(
        id="medium.missing_iec",
        title="IEC not registered",
        description="IEC number is not registered on any export row.",
        category="medium_priority",
        priority="Medium",
        source_keys=("export_readiness.iec_number",),
        firer=_missing_iec,
    ),
    RuleDef(
        id="medium.missing_active_cert",
        title="No active certification",
        description="No active certification is on file; compliance pillar is below 60.",
        category="medium_priority",
        priority="Medium",
        source_keys=("compliance_readiness.active_certification",),
        firer=_missing_active_cert,
    ),
    RuleDef(
        id="medium.no_employees",
        title="Employees not reported",
        description="Employee count is not reported; growth readiness is partial.",
        category="medium_priority",
        priority="Low",
        source_keys=("growth_readiness.employee_count",),
        firer=_no_employees,
    ),
    RuleDef(
        id="medium.revenue_not_reported",
        title="Revenue not reported",
        description="Annual revenue is not reported on the profile.",
        category="medium_priority",
        priority="Low",
        source_keys=("profile_completeness.basic.annual_revenue",),
        firer=_revenue_not_reported,
    ),
)

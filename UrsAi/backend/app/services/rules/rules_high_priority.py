"""High-priority rules.

These fire when a *major pillar* score is below 40 (the "Low"
band on the 4-band system) or when the DNA SWOT surfaced a
high-severity finding. These are the issues the UI should put
in the "red" column of the rules dashboard.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


_MAJOR_PILLARS = (
    ("score.export.score", "score.export", "Export Readiness", 1.2),
    ("score.digital.score", "score.digital", "Digital Readiness", 1.0),
    ("score.compliance.score", "score.compliance", "Compliance Readiness", 1.4),
    ("score.growth.score", "score.growth", "Growth Readiness", 1.0),
    ("score.risk.score", "score.risk", "Risk Score", 1.3),
)


def _pillar_low(sig: RuleSignalMap, score_key: str, source_key: str, title: str, weight: float) -> tuple[str, int, int] | None:
    s = sig.score(score_key, 0)
    if s >= 40:
        return None
    gap = 40 - s  # distance to the Low/Medium boundary
    return (f"{title} is in the Low band at {s}.", gap, weight)


def _make_pillar_rules():
    rules: list[RuleDef] = []
    for score_key, source_key, title, weight in _MAJOR_PILLARS:
        def _make_firer(sk=score_key, ti=title, w=weight):
            def _firer(sig: RuleSignalMap) -> tuple[str, int, int] | None:
                s = sig.score(sk, 0)
                if s >= 40:
                    return None
                gap = 40 - s
                return (f"{ti} is in the Low band at {s}.", gap, w)
            return _firer
        rules.append(RuleDef(
            id=f"high.pillar_low.{source_key.split('.')[-1]}",
            title=f"{title} is in the Low band",
            description=(
                f"A pillar score below 40 means the business is "
                f"missing a foundational element of {title.lower()}. "
                f"This is a high-priority gap."
            ),
            category="high_priority",
            priority="High",
            source_keys=(source_key,),
            firer=_make_firer(),
        ))
    return rules


def _dna_severity_high(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    n = sig.score("dna.finding.severity_high", 0)
    if n == 0:
        return None
    return (f"DNA surfaced {n} high-severity finding(s).", min(100, n * 30), 1.2)


ALL: tuple[RuleDef, ...] = (*_make_pillar_rules(), RuleDef(
    id="high.dna_severity_high",
    title="High-severity DNA findings",
    description=(
        "The DNA SWOT layer flagged one or more high-severity "
        "findings (e.g. compliance exposure, no digital footprint, "
        "concentrated risk profile)."
    ),
    category="high_priority",
    priority="High",
    source_keys=("dna.finding.severity_high",),
    firer=_dna_severity_high,
))

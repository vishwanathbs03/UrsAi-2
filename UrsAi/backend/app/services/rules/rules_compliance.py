"""Compliance-action rules.

These fire when the compliance pillar has a concrete missing
element. Distinct from the generic "high priority" pillar
rules — these name the specific compliance items that are
missing.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


def _no_certifications_at_all(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    any_cert = sig.score("intelligence.compliance_readiness.any_certification", 0)
    if any_cert > 0:
        return None
    return ("No certification rows are recorded at all.", 30, 1.4)


def _no_active_cert(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_active_cert"):
        return None
    return ("No active certification is on file (issued, not expired).", 40, 1.5)


def _no_issuing_body(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    v = sig.score("intelligence.compliance_readiness.issuing_body_recorded", 0)
    if v > 0:
        return None
    return ("No certification has an issuing body recorded.", 20, 0.9)


def _single_certification(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    multi = sig.score("intelligence.compliance_readiness.multiple_certifications", 0)
    # Multiple-certifications item awards 0, 3, 6, 10. Anything < 6 means 1 active.
    if multi >= 6:
        return None
    if not sig.flag("flag.has_active_cert"):
        return None
    return ("Only one active certification is on file; broader compliance posture is missing.", 10, 0.7)


def _compliance_medium(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.compliance.score", 0)
    if not (40 <= s < 70):
        return None
    return (f"Compliance score is {s}; at least one more active certification would lift it to High.", 70 - s, 0.9)


ALL: tuple[RuleDef, ...] = (
    RuleDef(
        id="compliance.no_certifications_at_all",
        title="No certification rows on file",
        description="No certification rows are recorded at all — the compliance breakdown is empty.",
        category="compliance_actions",
        priority="Critical",
        source_keys=("compliance_readiness.any_certification",),
        firer=_no_certifications_at_all,
    ),
    RuleDef(
        id="compliance.no_active_cert",
        title="No active certification",
        description="No active certification is on file (issued, not expired).",
        category="compliance_actions",
        priority="Critical",
        source_keys=("compliance_readiness.active_certification",),
        firer=_no_active_cert,
    ),
    RuleDef(
        id="compliance.no_issuing_body",
        title="No issuing body recorded",
        description="No certification has an issuing body recorded.",
        category="compliance_actions",
        priority="Medium",
        source_keys=("compliance_readiness.issuing_body_recorded",),
        firer=_no_issuing_body,
    ),
    RuleDef(
        id="compliance.single_certification",
        title="Single active certification",
        description="Only one active certification is on file; broader compliance posture is missing.",
        category="compliance_actions",
        priority="Low",
        source_keys=("compliance_readiness.multiple_certifications",),
        firer=_single_certification,
    ),
    RuleDef(
        id="compliance.score_medium",
        title="Compliance score is in the Medium band",
        description="Compliance score is in the Medium band; at least one more active certification would lift it to High.",
        category="compliance_actions",
        priority="Medium",
        source_keys=("score.compliance",),
        firer=_compliance_medium,
    ),
)

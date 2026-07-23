"""Secondary trait detector.

Five independent binary traits, each computed deterministically
from the signal table. A trait can be ``present`` or not; the
``strength`` field is a 0..100 number the UI uses for sorting
when several traits are present at once.

These traits are *not* tied to the primary archetype — a
business can be any archetype and still be export-ready,
digitally-active, etc. The intent is that the UI can show
"Archetype: The Growth Operator — also: Export-Ready, Data-Rich"
without those tags contradicting the headline.
"""


from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from app.services.dna.base import Rationale
from app.services.dna.signal_extractor import SignalMap


@dataclass(frozen=True)
class TraitDef:
    key: str
    title: str
    detector: Callable[[SignalMap], tuple[bool, int, list[Rationale]]]


def _safe(sig: SignalMap, key: str, default: int = 0) -> int:
    try:
        return int(sig.get(key, default))
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# Trait 1 — Export-Ready
# --------------------------------------------------------------------------- #


def _trait_export_ready() -> TraitDef:
    def detect(sig: SignalMap) -> tuple[bool, int, list[Rationale]]:
        export_score = _safe(sig, "score.export.score")
        has_history = bool(sig.get("signal.has_export_history"))
        has_iec = bool(sig.get("signal.has_iec"))
        # Present when the export score is meaningful AND at
        # least one supporting signal is true.
        present = export_score >= 40 and (has_history or has_iec)
        # Strength: pull the export score, but cap at 100.
        strength = max(0, min(100, export_score))
        rationale: list[Rationale] = []
        if has_history:
            rationale.append(Rationale(
                claim="Has documented export history.",
                signal=sig.label("signal.has_export_history"),
                source_key=sig.source_key("signal.has_export_history"),
            ))
        if has_iec:
            rationale.append(Rationale(
                claim="IEC number registered.",
                signal=sig.label("signal.has_iec"),
                source_key=sig.source_key("signal.has_iec"),
            ))
        rationale.append(Rationale(
            claim=f"Export score is {export_score}.",
            signal=f"Export score = {export_score}",
            source_key="score.export",
        ))
        return present, strength, rationale

    return TraitDef(
        key="export_ready",
        title="Export-Ready",
        detector=detect,
    )


# --------------------------------------------------------------------------- #
# Trait 2 — Digitally Active
# --------------------------------------------------------------------------- #


def _trait_digitally_active() -> TraitDef:
    def detect(sig: SignalMap) -> tuple[bool, int, list[Rationale]]:
        digital_score = _safe(sig, "score.digital.score")
        has_website = bool(sig.get("signal.has_website"))
        has_ecom = bool(sig.get("signal.has_ecommerce"))
        present = digital_score >= 50 and (has_website or has_ecom)
        strength = max(0, min(100, digital_score))
        rationale = [
            Rationale(
                claim=f"Digital score is {digital_score}.",
                signal=f"Digital score = {digital_score}",
                source_key="score.digital",
            ),
        ]
        if has_website:
            rationale.append(Rationale(
                claim="Business website is on file.",
                signal=sig.label("signal.has_website"),
                source_key=sig.source_key("signal.has_website"),
            ))
        if has_ecom:
            rationale.append(Rationale(
                claim="E-commerce is active.",
                signal=sig.label("signal.has_ecommerce"),
                source_key=sig.source_key("signal.has_ecommerce"),
            ))
        return present, strength, rationale

    return TraitDef(
        key="digitally_active",
        title="Digitally Active",
        detector=detect,
    )


# --------------------------------------------------------------------------- #
# Trait 3 — Compliance-Heavy
# --------------------------------------------------------------------------- #


def _trait_compliance_heavy() -> TraitDef:
    def detect(sig: SignalMap) -> tuple[bool, int, list[Rationale]]:
        compliance_score = _safe(sig, "score.compliance.score")
        multi = bool(sig.get("signal.has_multiple_active_certs"))
        present = compliance_score >= 60 and multi
        strength = max(0, min(100, compliance_score))
        rationale = [
            Rationale(
                claim=f"Compliance score is {compliance_score}.",
                signal=f"Compliance score = {compliance_score}",
                source_key="score.compliance",
            ),
        ]
        if multi:
            rationale.append(Rationale(
                claim="Multiple active certifications on file.",
                signal=sig.label("signal.has_multiple_active_certs"),
                source_key=sig.source_key("signal.has_multiple_active_certs"),
            ))
        return present, strength, rationale

    return TraitDef(
        key="compliance_heavy",
        title="Compliance-Heavy",
        detector=detect,
    )


# --------------------------------------------------------------------------- #
# Trait 4 — Growth-Oriented
# --------------------------------------------------------------------------- #


def _trait_growth_oriented() -> TraitDef:
    def detect(sig: SignalMap) -> tuple[bool, int, list[Rationale]]:
        growth_score = _safe(sig, "score.growth.score")
        has_goals = bool(sig.get("signal.has_goals"))
        has_employees = bool(sig.get("signal.has_employees"))
        present = growth_score >= 50 and has_goals and has_employees
        strength = max(0, min(100, growth_score))
        rationale = [
            Rationale(
                claim=f"Growth score is {growth_score}.",
                signal=f"Growth score = {growth_score}",
                source_key="score.growth",
            ),
        ]
        if has_goals:
            rationale.append(Rationale(
                claim="Growth goals declared.",
                signal=sig.label("signal.has_goals"),
                source_key=sig.source_key("signal.has_goals"),
            ))
        if has_employees:
            rationale.append(Rationale(
                claim="Employees reported.",
                signal=sig.label("signal.has_employees"),
                source_key=sig.source_key("signal.has_employees"),
            ))
        return present, strength, rationale

    return TraitDef(
        key="growth_oriented",
        title="Growth-Oriented",
        detector=detect,
    )


# --------------------------------------------------------------------------- #
# Trait 5 — Data-Rich
# --------------------------------------------------------------------------- #


def _trait_data_rich() -> TraitDef:
    def detect(sig: SignalMap) -> tuple[bool, int, list[Rationale]]:
        profile_score = _safe(sig, "intelligence.profile_completeness.score")
        present = profile_score >= 70
        strength = max(0, min(100, profile_score))
        rationale = [
            Rationale(
                claim=f"Profile completeness is {profile_score}%.",
                signal=f"Profile completeness = {profile_score}",
                source_key="intelligence.profile_completeness",
            ),
        ]
        return present, strength, rationale

    return TraitDef(
        key="data_rich",
        title="Data-Rich",
        detector=detect,
    )


# --------------------------------------------------------------------------- #
# Public registry
# --------------------------------------------------------------------------- #


ALL_TRAITS: tuple[TraitDef, ...] = (
    _trait_export_ready(),
    _trait_digitally_active(),
    _trait_compliance_heavy(),
    _trait_growth_oriented(),
    _trait_data_rich(),
)

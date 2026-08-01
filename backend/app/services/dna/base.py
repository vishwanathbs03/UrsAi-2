"""Shared result types for the Business DNA Engine.

The DNA engine produces one :class:`BusinessDNA` per call. Unlike
the intelligence engine (per-analyzer payloads) or the score
engine (per-score payloads), the DNA engine produces a single
*profile* object with seven named fields (archetype, secondary
traits, strengths, weaknesses, opportunities, risk areas,
confidence). The UI renders this as a single page.

Every piece of the profile carries its own traceability — a
``rationale`` string that names the signals that produced the
verdict, and where applicable a list of ``source_keys`` that
trace the verdict back to specific intelligence / score
breakdown keys. This is what "fully explainable" means in
practice: the response is auditable, not just a number.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# --------------------------------------------------------------------------- #
# Building blocks
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Rationale:
    """A line in a DNA field's reasoning trace.

    ``claim`` is a one-sentence plain-English assertion. ``signal``
    is the data point that supports it (e.g. "Export Score = 92").
    ``source_key`` traces back to an intelligence or score key
    when applicable.
    """

    claim: str
    signal: str
    source_key: str | None = None

    def to_payload(self) -> dict:
        out: dict = {"claim": self.claim, "signal": self.signal}
        if self.source_key:
            out["source_key"] = self.source_key
        return out


# --------------------------------------------------------------------------- #
# DNA field shapes
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Archetype:
    """The primary archetype assigned to the business.

    ``key`` is the stable identifier. ``title`` is the
    user-facing label. ``description`` is a one-sentence
    explainer. ``match_score`` is the raw weighted sum that put
    this archetype on top (0..100, clamped). ``runner_up`` is the
    second-place archetype's key + score, so the UI can show how
    decisive the assignment was.
    """

    key: str
    title: str
    description: str
    match_score: int
    rationale: list[Rationale] = field(default_factory=list)
    runner_up_key: str | None = None
    runner_up_score: int | None = None

    def to_payload(self) -> dict:
        out: dict = {
            "key": self.key,
            "title": self.title,
            "description": self.description,
            "match_score": self.match_score,
            "rationale": [r.to_payload() for r in self.rationale],
        }
        if self.runner_up_key is not None:
            out["runner_up"] = {
                "key": self.runner_up_key,
                "match_score": self.runner_up_score,
            }
        return out


@dataclass(frozen=True)
class SecondaryTrait:
    """A named secondary trait. ``present`` is the verdict;
    ``strength`` is how strong the signal was (0..100)."""

    key: str
    title: str
    present: bool
    strength: int
    rationale: list[Rationale] = field(default_factory=list)

    def to_payload(self) -> dict:
        return {
            "key": self.key,
            "title": self.title,
            "present": self.present,
            "strength": self.strength,
            "rationale": [r.to_payload() for r in self.rationale],
        }


@dataclass(frozen=True)
class Finding:
    """A single line in strengths / weaknesses / opportunities / risks.

    ``severity`` is one of ``"info"`` / ``"low"`` / ``"medium"`` /
    ``"high"`` and tells the UI how to colour the row.
    """

    title: str
    detail: str
    severity: str = "info"
    source_key: str | None = None

    def to_payload(self) -> dict:
        out: dict = {
            "title": self.title,
            "detail": self.detail,
            "severity": self.severity,
        }
        if self.source_key:
            out["source_key"] = self.source_key
        return out


# --------------------------------------------------------------------------- #
# Top-level result
# --------------------------------------------------------------------------- #


@dataclass
class BusinessDNA:
    """Output of the Business DNA Engine."""

    archetype: Archetype
    secondary_traits: list[SecondaryTrait] = field(default_factory=list)
    strengths: list[Finding] = field(default_factory=list)
    weaknesses: list[Finding] = field(default_factory=list)
    opportunities: list[Finding] = field(default_factory=list)
    risk_areas: list[Finding] = field(default_factory=list)
    confidence: int = 0
    confidence_rationale: list[Rationale] = field(default_factory=list)

    def to_payload(self) -> dict:
        return {
            "archetype": self.archetype.to_payload(),
            "secondary_traits": [t.to_payload() for t in self.secondary_traits],
            "strengths": [f.to_payload() for f in self.strengths],
            "weaknesses": [f.to_payload() for f in self.weaknesses],
            "opportunities": [f.to_payload() for f in self.opportunities],
            "risk_areas": [f.to_payload() for f in self.risk_areas],
            "confidence": self.confidence,
            "confidence_rationale": [r.to_payload() for r in self.confidence_rationale],
        }

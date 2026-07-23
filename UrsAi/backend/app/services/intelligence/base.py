"""Shared result types for the intelligence engine.

Every analyzer returns an :class:`AnalyzerResult` so the API can
serialize the engine's output with a single Pydantic model and the
frontend can render each lens with the same component.

Concepts
--------

``score``        — int 0..100. The headline number.
``level``        — categorical banding: "low" (0..39),
                   "medium" (40..69), "high" (70..100).
``breakdown``    — per-field contribution so the UI can show the
                   user exactly which items earned (or failed to
                   earn) credit. Each item carries a stable
                   ``key`` for i18n / deep-linking.
``missing``      — short list of friendly labels for the
                   next-best fields to fill in. Derived from
                   breakdown so the two views stay in sync.
``summary``      — one-sentence verdict, e.g.
                   "Digital presence is established but e-commerce
                    is not yet active."
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable


def level_for(score: int) -> str:
    """Map a 0..100 score to a 3-step categorical band."""
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


@dataclass(frozen=True)
class ScoreItem:
    """A single line item in an analyzer breakdown.

    ``earned`` is the points this line contributed; ``weight`` is
    the maximum it could have contributed. ``present`` is True
    when the underlying data was present (regardless of whether
    the analyzer gave full credit).
    """

    key: str
    label: str
    weight: int
    earned: int
    present: bool
    hint: str | None = None


@dataclass
class AnalyzerResult:
    """Output of one analyzer."""

    key: str
    title: str
    score: int
    breakdown: list[ScoreItem] = field(default_factory=list)
    summary: str = ""
    missing: list[str] = field(default_factory=list)

    @property
    def level(self) -> str:
        return level_for(self.score)

    def to_payload(self) -> dict:
        """JSON-friendly representation used by the API layer."""
        return {
            "key": self.key,
            "title": self.title,
            "score": self.score,
            "level": self.level,
            "summary": self.summary,
            "breakdown": [
                {
                    "key": item.key,
                    "label": item.label,
                    "weight": item.weight,
                    "earned": item.earned,
                    "present": item.present,
                    **({"hint": item.hint} if item.hint else {}),
                }
                for item in self.breakdown
            ],
            "missing": list(self.missing),
        }


def missing_labels(items: Iterable[ScoreItem]) -> list[str]:
    """Return the labels of every breakdown item that did NOT earn
    full credit, in declaration order. Used to populate the
    ``missing`` field on :class:`AnalyzerResult`."""
    return [item.label for item in items if item.earned < item.weight]

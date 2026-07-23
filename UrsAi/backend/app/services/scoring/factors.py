"""Contributing-factor model for the Business Score Engine.

Every Business Score must return a small, human-readable list of
``ContributingFactor`` entries — one per signal that pushed the
score up or down. The list is what the UI shows in the "Why this
score?" expander.

Design contract
---------------

* ``ContributingFactor`` is a frozen dataclass (immutable, hashable
  for caching/tests).
* ``label`` is the user-facing string.
* ``impact`` is one of ``"positive"`` / ``"negative"`` / ``"neutral"``
  and tells the UI how to colour-code the line item.
* ``weight`` is the raw point contribution of this signal. It is
  used by the UI for sort-by-impact; the score itself is the
  precomputed sum.
* ``source_key`` traces the factor back to a breakdown key from the
  underlying intelligence analyzer (e.g.
  ``"export_readiness.iec_number"``). The UI uses this to
  deep-link the user back to the relevant business section.
* ``detail`` is an optional sentence that the UI shows on hover.

Pure data only — no business logic lives here.
"""

from __future__ import annotations

from dataclasses import dataclass


Impact = str  # "positive" | "negative" | "neutral"


@dataclass(frozen=True)
class ContributingFactor:
    """One line in a score's ``contributing_factors`` list."""

    label: str
    impact: Impact
    weight: int
    source_key: str
    detail: str | None = None

    def to_payload(self) -> dict:
        """JSON-friendly representation. ``detail`` is omitted when
        null so the response stays tight."""
        out: dict = {
            "label": self.label,
            "impact": self.impact,
            "weight": int(self.weight),
            "source_key": self.source_key,
        }
        if self.detail:
            out["detail"] = self.detail
        return out

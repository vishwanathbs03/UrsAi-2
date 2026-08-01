"""Shared result types for the Business Score Engine.

Every score in the engine implements :class:`Score` and returns a
:class:`BusinessScore`. The shape is intentionally narrower than
:class:`~app.services.intelligence.base.AnalyzerResult`:

  * ``score``      0..100 headline number
  * ``level``      Low / Medium / High / Excellent
  * ``explanation`` one-sentence plain-English verdict
  * ``contributing_factors`` short list of
    :class:`~app.services.scoring.factors.ContributingFactor`

The narrower shape is what the API surface promises. The wider
``breakdown`` view stays internal to the intelligence engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.scoring.factors import ContributingFactor
from app.services.scoring.levels import level_for


@dataclass
class BusinessScore:
    """Output of one score calculator."""

    key: str
    title: str
    score: int
    level: str
    explanation: str
    contributing_factors: list[ContributingFactor] = field(default_factory=list)

    def to_payload(self) -> dict:
        """JSON-friendly representation used by the API layer."""
        return {
            "key": self.key,
            "title": self.title,
            "score": self.score,
            "level": self.level,
            "explanation": self.explanation,
            "contributing_factors": [
                f.to_payload() for f in self.contributing_factors
            ],
        }

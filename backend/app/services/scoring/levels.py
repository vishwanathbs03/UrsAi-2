"""4-step score banding used by every Business Score.

The intelligence engine uses 3 bands (``low`` / ``medium`` / ``high``).
The Business Score Engine uses 4 bands (Low / Medium / High /
Excellent) so the UI can show a finer resolution to the end user
without changing the underlying analyzer math.

Bands are tuned for a 0..100 score that, in practice, ranges roughly
30..95 for real businesses:

  * 0..39   Low        — fundamental gaps
  * 40..59  Medium     — partial readiness, key gaps remain
  * 60..79  High       — broad readiness, minor gaps
  * 80..100 Excellent  — best-in-class posture

The thresholds are exported as constants so tests can assert the
exact band edges.
"""

from __future__ import annotations

from typing import Final

LOW_MAX: Final[int] = 39
MEDIUM_MAX: Final[int] = 59
HIGH_MAX: Final[int] = 79

LEVELS: Final[tuple[str, ...]] = ("Low", "Medium", "High", "Excellent")


def level_for(score: int) -> str:
    """Map a 0..100 score to a 4-step categorical band.

    Out-of-range inputs are clamped to [0, 100] before banding so
    callers do not have to sanitize. This keeps the score -> level
    contract honest even if a future scoring rule briefly
    over- or under-shoots the band.
    """
    s = max(0, min(100, int(score)))
    if s <= LOW_MAX:
        return "Low"
    if s <= MEDIUM_MAX:
        return "Medium"
    if s <= HIGH_MAX:
        return "High"
    return "Excellent"


def clamp(value: float) -> int:
    """Clamp a float to a 0..100 integer. Used everywhere a raw
    weighted sum has to be normalised back into a score."""
    return max(0, min(100, int(round(float(value)))))

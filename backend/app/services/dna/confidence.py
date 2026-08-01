"""Confidence model.

The DNA engine reports a confidence score 0..100. The formula
has two terms, each on a 0..50 scale, summed and clamped to
0..100.

Term 1 — Archetype decisiveness
    How big is the gap between the top-scoring archetype and
    the runner-up? A close call means the signal table is
    ambiguous; a wide gap means the assignment is decisive.

    Formula: ``min(50, gap * 1.0)`` where ``gap = top - second``.

Term 2 — Profile completeness
    How much of the Business Digital Twin has the user filled
    in? An empty profile produces an ambiguous DNA; a rich
    profile produces a confident one.

    Formula: ``int(0.50 * profile_completeness_score)``.

Why this formula?
-----------------

It rewards *both* a complete profile *and* a decisive match.
A complete profile with a close archetype race gives ~50
confidence (high data, ambiguous verdict). A decisive match
on a thin profile gives ~50 (decisive verdict, but the data
is thin). A complete profile with a decisive match gives
~100. An empty profile with a "Foundation Builder" default
gives ~5 — accurately reflecting that we have no real
information to be confident about.
"""

from __future__ import annotations

from app.services.dna.base import Archetype, Rationale
from app.services.dna.signal_extractor import SignalMap


def _score(sig: SignalMap, key: str) -> int:
    try:
        return int(sig.get(key, 0))
    except (TypeError, ValueError):
        return 0


def compute_confidence(
    archetype: Archetype,
    sig: SignalMap,
) -> tuple[int, list[Rationale]]:
    """Return ``(confidence, rationale)``.

    ``archetype`` is the chosen primary; the runner-up is read
    from ``archetype.runner_up_score`` if present.
    """
    rationale: list[Rationale] = []

    # Term 1: decisiveness gap.
    top = archetype.match_score
    second = archetype.runner_up_score if archetype.runner_up_score is not None else 0
    gap = max(0, top - second)
    decisiveness = min(50, gap)
    rationale.append(Rationale(
        claim=f"Archetype match is decisive: gap of {gap} to the runner-up.",
        signal=f"Top = {top}, runner-up = {second}",
        source_key=archetype.key,
    ))

    # Term 2: profile completeness.
    profile = _score(sig, "intelligence.profile_completeness.score")
    data_term = int(round(0.50 * profile))
    rationale.append(Rationale(
        claim=f"Profile completeness contributes to confidence.",
        signal=f"Profile completeness = {profile}",
        source_key="intelligence.profile_completeness",
    ))

    confidence = max(0, min(100, decisiveness + data_term))
    return confidence, rationale

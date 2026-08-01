"""Roadmap summary — the top-level rollup of the plan.

The summary carries four numbers and the six projections:

  * ``total_items``                  — number of items in
    the plan.
  * ``total_estimated_duration``     — a human-readable
    string (``"~6 months"``) summing the per-phase
    durations.
  * ``total_estimated_roi``          — the average ROI
    across the plan's items, in 0..100. Averaging
    (rather than summing) keeps the number on the
    same scale as the upstream per-recommendation
    ``estimated_roi`` field.
  * ``projections``                  — the six projected
    numbers, computed in
    :mod:`app.services.roadmap.projections`.

The math is documented inline so the next agent can
adjust the formula without grepping the codebase.
"""

from __future__ import annotations

from app.services.roadmap.base import (
    Phase,
    RecommendationView,
    RoadmapItem,
    RoadmapProjections,
    RoadmapSummary,
)
from app.services.roadmap.timeline import (
    duration_string,
    parse_duration_to_weeks,
    phase_duration_weeks,
    total_weeks,
)


_PHASE_ORDER: tuple[Phase, ...] = (
    "Immediate",
    "Short-Term",
    "Medium-Term",
    "Long-Term",
)


def build_summary(
    items: tuple[RoadmapItem, ...],
    projections: RoadmapProjections,
) -> RoadmapSummary:
    """Compute the summary rollup.

    The function is pure — same items + same projections
    → same summary. Two calls with the same inputs
    produce byte-identical output.
    """
    if not items:
        return RoadmapSummary(
            total_items=0,
            total_estimated_duration=duration_string(0),
            total_estimated_roi=0,
            projections=projections,
        )

    # Per-phase duration in weeks. Each phase is the
    # MAX of its members' durations (the phase as a
    # whole cannot finish before the longest member).
    per_phase: dict[Phase, list[int]] = {p: [] for p in _PHASE_ORDER}
    for it in items:
        per_phase.setdefault(it.phase, []).append(
            parse_duration_to_weeks(it.estimated_duration)
        )
    per_phase_weeks: dict[Phase, int] = {
        p: phase_duration_weeks(tuple(weeks)) for p, weeks in per_phase.items()
    }
    total_w = total_weeks(per_phase_weeks)
    total_dur = duration_string(total_w)

    # Average ROI. 0..100, integer.
    total_roi = int(round(sum(i.estimated_roi for i in items) / len(items)))

    return RoadmapSummary(
        total_items=len(items),
        total_estimated_duration=total_dur,
        total_estimated_roi=total_roi,
        projections=projections,
    )


def build_views_by_id(
    recommendations: tuple[RecommendationView, ...],
) -> dict[str, RecommendationView]:
    """Helper for the service façade: build the lookup
    the projection step needs."""
    return {r.id: r for r in recommendations}

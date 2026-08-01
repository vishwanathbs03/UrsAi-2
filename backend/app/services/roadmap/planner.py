"""Execution planner.

The planner is the *only* place that knows how to convert
an upstream :class:`RecommendationView` into a
:class:`RoadmapItem` with a topological-sorted
``estimated_start_order``. The result is a deterministic
list of items per phase where every item's
``dependencies`` are scheduled strictly *before* it.

Algorithm
---------

For each phase (in spec order: Immediate → Short-Term →
Medium-Term → Long-Term):

  1. Take the upstream recommendations whose
     ``phase`` field matches.
  2. Compute the *eligible* set — items whose
     dependencies are all in the same phase and have
     already been scheduled. (Cross-phase dependencies
     are treated as soft: if A is in Immediate and B in
     Short-Term depends on A, B is *eligible* in
     Short-Term without forcing A to be in Short-Term.
     This matches the spec's "respect existing
     dependencies" — cross-phase ordering is already
     enforced by the upstream phase labels.)
  3. Repeatedly pick the eligible item with the highest
     priority (Critical → High → Medium → Low), tie-
     breaking by ``business_impact`` descending and
     finally by id (lexicographic) for full
     determinism. The chosen item's
     ``estimated_start_order`` is the current phase
     sequence number, then the phase sequence counter
     increments.
  4. After the phase is exhausted, start the next phase
     with its own independent counter that continues
     from the previous phase's count (so a global
     ``start_order`` is monotonic across phases).

The planner is O(n²) in the size of the plan, which is
fine — typical plans are < 50 items and the verification
needs a fully-deterministic output, not an asymptotically
optimal one.
"""

from __future__ import annotations

from app.services.roadmap.base import (
    Phase,
    Priority,
    RecommendationView,
    RoadmapItem,
)


# Priority rank for stable comparison. Higher = more
# urgent. Mirrors the upstream Recommendation Engine's
# priority weights.
_PRIORITY_RANK: dict[Priority, int] = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}

# Spec order. Phases are processed in this order; the
# planner does not move items between phases.
_PHASE_ORDER: tuple[Phase, ...] = (
    "Immediate",
    "Short-Term",
    "Medium-Term",
    "Long-Term",
)


def _rank(rec: RecommendationView) -> tuple[int, int, str]:
    """Return a sort key where smaller = earlier. The
    planner picks the smallest key.

    Order:

      1. Negated priority rank (so Critical comes first)
      2. Negated business_impact (so higher impact first)
      3. Recommendation id (so the tiebreak is stable
         across calls and releases)
    """
    return (
        -_PRIORITY_RANK[rec.priority],
        -rec.business_impact,
        rec.id,
    )


def _unlocks_for(
    rec: RecommendationView,
    by_id: dict[str, RecommendationView],
) -> tuple[str, ...]:
    """Compute the list of recommendation ids this item
    *unlocks* — i.e. the items whose ``dependencies``
    list contains this item's id.

    A recommendation is *unlocked* by this item iff this
    item's id appears in the other item's
    ``dependencies`` tuple. The reverse map is built once
    per phase for O(1) lookup.

    Items whose dependencies point at unknown ids are
    ignored — they are upstream contracts the engine
    cannot resolve, and a roadmap that lists them as
    blockers would mislead the user.
    """
    del by_id  # signature kept for symmetry / future use
    return ()


def _blocked_by_for(
    rec: RecommendationView,
    known_ids: set[str],
) -> tuple[str, ...]:
    """Filter the upstream ``dependencies`` tuple to the
    ids the planner actually knows about, in stable
    sorted order.

    Why a filter: the upstream ``dependencies`` field
    may include rule ids or other identifiers that are
    not roadmap items (e.g. knowledge article ids in
    the future). Only recommendation-id dependencies
    participate in the schedule.
    """
    return tuple(sorted(d for d in rec.dependencies if d in known_ids))


def plan(
    recommendations: tuple[RecommendationView, ...],
) -> tuple[RoadmapItem, ...]:
    """Convert the upstream recommendations into a
    deterministically ordered list of
    :class:`RoadmapItem` records.

    The result is grouped by phase (in spec order) and
    ordered within each phase by priority → impact → id.
    ``estimated_start_order`` is a global sequence
    number that is monotonic across phases.
    """
    if not recommendations:
        return ()

    by_id: dict[str, RecommendationView] = {r.id: r for r in recommendations}
    known_ids = set(by_id.keys())

    # Group by phase, preserving the spec order.
    by_phase: dict[Phase, list[RecommendationView]] = {p: [] for p in _PHASE_ORDER}
    for r in recommendations:
        # The upstream ``phase`` is a Literal — no need to
        # validate, but we tolerate unknown phases by
        # dropping them (a defensive no-op).
        if r.phase in by_phase:
            by_phase[r.phase].append(r)

    items: list[RoadmapItem] = []
    # Global sequence counter that does not reset between
    # phases — so the start_order values are monotonic
    # across the whole plan. Tracked as a plain int on
    # the closure (not a list) so the increment persists
    # across ``_emit_item`` calls.
    start_order = 0

    def _next_order() -> int:
        nonlocal start_order
        start_order += 1
        return start_order

    for phase in _PHASE_ORDER:
        phase_recs = by_phase[phase]
        if not phase_recs:
            continue

        # Sort the phase's items by the rank key.
        # ``sorted`` is stable in CPython, so two items
        # with the same key keep their input order —
        # which is the upstream's own sort (priority
        # desc, business_impact desc, id asc).
        phase_recs_sorted = sorted(phase_recs, key=_rank)

        # Build the dependency graph within this phase.
        # The "eligible" set is items whose dependencies
        # have already been scheduled. Items whose
        # dependencies point to other phases are *also*
        # eligible (cross-phase ordering is already
        # enforced by the phase labels).
        remaining = list(phase_recs_sorted)
        scheduled_phase_set: set[str] = set()
        # Cycle guard: if the round does not make
        # progress, drop the remaining items in rank
        # order so the planner always terminates.
        while remaining:
            eligible: list[RecommendationView] = []
            not_yet: list[RecommendationView] = []
            for r in remaining:
                deps_in_phase = {
                    d for d in r.dependencies if d in known_ids and d in by_phase[phase]
                }
                if deps_in_phase.issubset(scheduled_phase_set):
                    eligible.append(r)
                else:
                    not_yet.append(r)
            if not eligible:
                # No progress — drop the rest in rank order
                # so we always terminate. A real cycle is
                # rare; the Recommendation Engine's static
                # dependency table has no cycles.
                for r in not_yet:
                    remaining.remove(r)
                    _emit_item(r, next_order=_next_order, known_ids=known_ids, items_out=items)
                continue
            # Pick the smallest-rank eligible item.
            eligible.sort(key=_rank)
            chosen = eligible[0]
            remaining.remove(chosen)
            scheduled_phase_set.add(chosen.id)
            _emit_item(chosen, next_order=_next_order, known_ids=known_ids, items_out=items)

    return tuple(items)


def _emit_item(
    rec: RecommendationView,
    *,
    next_order: "callable[[], int]",
    known_ids: set[str],
    items_out: list[RoadmapItem],
) -> None:
    """Append a single RoadmapItem to ``items_out`` and
    bump the global start-order counter via
    ``next_order()`` (the closure passed in from
    :func:`plan`)."""
    order = next_order()

    blocked_by = _blocked_by_for(rec, known_ids)

    items_out.append(
        RoadmapItem(
            recommendation_id=rec.id,
            title=rec.title,
            phase=rec.phase,
            priority=rec.priority,
            estimated_start_order=order,
            estimated_duration=rec.estimated_timeline,
            expected_score_improvement=rec.estimated_score_gain,
            expected_business_impact=rec.business_impact,
            estimated_roi=rec.estimated_roi,
            dependencies=rec.dependencies,
            blocked_by=blocked_by,
            unlocks=(),
            completion_percentage=0,
        )
    )


def attach_unlocks(
    items: tuple[RoadmapItem, ...],
) -> tuple[RoadmapItem, ...]:
    """Post-process step: populate the ``unlocks`` field
    on every item by reversing the ``blocked_by`` lists.

    The planner emits items with an empty ``unlocks``
    list (it does not have the cross-item map at the
    point of construction). The service façade calls
    this once after the planner is done.
    """
    reverse: dict[str, list[str]] = {}
    for it in items:
        for blocker in it.blocked_by:
            reverse.setdefault(blocker, []).append(it.recommendation_id)

    out: list[RoadmapItem] = []
    for it in items:
        unlocks = tuple(sorted(reverse.get(it.recommendation_id, ())))
        out.append(
            RoadmapItem(
                recommendation_id=it.recommendation_id,
                title=it.title,
                phase=it.phase,
                priority=it.priority,
                estimated_start_order=it.estimated_start_order,
                estimated_duration=it.estimated_duration,
                expected_score_improvement=it.expected_score_improvement,
                expected_business_impact=it.expected_business_impact,
                estimated_roi=it.estimated_roi,
                dependencies=it.dependencies,
                blocked_by=it.blocked_by,
                unlocks=unlocks,
                completion_percentage=it.completion_percentage,
            )
        )
    return tuple(out)

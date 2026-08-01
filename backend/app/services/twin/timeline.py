"""Twin timeline — deterministic current + 3/6/12
month projections.

The timeline is **pure rule-based** — no AI, no
scenario simulator, no LLM. The math is a small
deterministic function of the current scores and
the active roadmap:

  * At each horizon, the projected score is the
    sum of the current value plus the expected
    score gain of the roadmap items whose
    ``estimated_duration`` fits inside the
    horizon's week budget (3m = 13 weeks, 6m = 26
    weeks, 12m = 52 weeks).
  * The ``roadmap_completion_pct`` is the
    percentage of items completed by the horizon
    (round-robin through the roadmap's
    ``estimated_start_order`` + the item's
    duration; items with a 0 completion
    percentage are the remaining ones).
  * The four lens scores are projected with the
    same shape (current + per-lens lift, capped
    at 100). The per-lens lift is the sum of
    ``expected_score_improvement`` over the
    horizon's items.

The math is documented inline so the next agent
can adjust the heuristic without grepping the
codebase.
"""

from __future__ import annotations

import re
from typing import Any

# Default horizon week budgets. The 3/6/12-month
# labels map to these weeks; the values are
# deliberately generous (52 weeks per year) so
# any timeline string the upstream engines emit
# fits inside the 12m budget.
_HORIZON_WEEKS = {
    "current": 0,
    "3m": 13,
    "6m": 26,
    "12m": 52,
}

# Parsers for the upstream timeline strings. The
# Recommendation / Roadmap engines emit formats
# like ``"~2 weeks"``, ``"~3 months"``. The
# week regex captures the integer + unit.
_WEEK_RE = re.compile(r"~(\d+)\s+weeks?", re.IGNORECASE)
_MONTH_RE = re.compile(r"~(\d+)\s+months?", re.IGNORECASE)


def parse_duration_to_weeks(timeline: str) -> int:
    """Convert a human-readable timeline string to a
    positive integer week count. Same contract as
    the Roadmap Engine's helper."""
    if not timeline:
        return 0
    m = _WEEK_RE.search(timeline)
    if m:
        return max(0, min(52, int(m.group(1))))
    m = _MONTH_RE.search(timeline)
    if m:
        return max(0, min(52, int(m.group(1)) * 4))
    return 0


def duration_string(weeks: int) -> str:
    """Inverse of :func:`parse_duration_to_weeks`."""
    if weeks <= 0:
        return "~0 weeks"
    if weeks == 1:
        return "~1 week"
    if weeks < 16:
        return f"~{weeks} weeks"
    months = max(1, round(weeks / 4))
    if months == 1:
        return "~1 month"
    return f"~{months} months"


def average_timeline_string(timelines: list[str]) -> str:
    """Render the average of a list of upstream
    timeline strings. The math: parse each
    string, average the week counts, render
    back. An empty list returns ``"~0 weeks"``."""
    if not timelines:
        return "~0 weeks"
    weeks = [parse_duration_to_weeks(t) for t in timelines]
    if not weeks:
        return "~0 weeks"
    return duration_string(int(round(sum(weeks) / len(weeks))))


# --------------------------------------------------------------------------- #
# Horizon projection
# --------------------------------------------------------------------------- #


def build_timeline(
    *,
    current_scores: dict[str, Any],
    roadmap_block: dict[str, Any],
) -> dict[str, Any]:
    """Build the four-spec'd projections (current,
    3m, 6m, 12m).

    The function is pure: same inputs, same
    outputs. The items list is the source of
    truth for *how much* lift each horizon
    gets — items whose ``estimated_duration``
    fits inside the horizon's week budget
    contribute their ``expected_score_improvement``
    to the lift.
    """
    items = roadmap_block.get("items") or []

    # Pre-compute per-item weeks once.
    item_weeks: list[tuple[dict[str, Any], int]] = [
        (it, parse_duration_to_weeks(it.get("estimated_duration", "")))
        for it in items
    ]

    horizons: list[dict[str, Any]] = []
    for label, weeks in _HORIZON_WEEKS.items():
        if label == "current":
            # The current snapshot is the
            # un-projected state. We still emit a
            # TimelineProjectionOut so the response
            # shape is uniform.
            horizons.append(
                _projection(
                    label=label,
                    months_from_now=0,
                    items_in_horizon=items,
                    items_in_horizon_count=len(items),
                    overall=current_scores.get("overall_score", 0),
                    digital=_lens_score(current_scores, "digital"),
                    export=_lens_score(current_scores, "export"),
                    compliance=_lens_score(current_scores, "compliance"),
                    growth=_lens_score(current_scores, "growth"),
                    completion_pct=0,
                    note="Today's baseline — no roadmap work has been completed yet.",
                )
            )
            continue

        # Items whose duration fits inside the
        # horizon's week budget contribute their
        # lift. The roadmap engine schedules items
        # sequentially, so the items that "land
        # inside" the horizon are a contiguous
        # prefix ordered by ``estimated_start_order``.
        scheduled = _items_within_horizon(item_weeks, weeks)
        if not scheduled:
            horizons.append(
                _projection(
                    label=label,
                    months_from_now=_months_from_label(label),
                    items_in_horizon=[],
                    items_in_horizon_count=0,
                    overall=current_scores.get("overall_score", 0),
                    digital=_lens_score(current_scores, "digital"),
                    export=_lens_score(current_scores, "export"),
                    compliance=_lens_score(current_scores, "compliance"),
                    growth=_lens_score(current_scores, "growth"),
                    completion_pct=0,
                    note=(
                        f"No roadmap items are expected to be completed "
                        f"within the {label} window."
                    ),
                )
            )
            continue

        # Project each score. The lift for a
        # score is the sum of
        # ``expected_score_improvement`` over the
        # horizon's items, capped at the distance
        # to 100. The cap is per-score so a 12m
        # projection never produces an impossible
        # value.
        total_lift = sum(
            float(it.get("expected_score_improvement", 0) or 0)
            for it in scheduled
        )
        overall = _cap(
            int(current_scores.get("overall_score", 0) or 0) + int(round(total_lift))
        )

        digital_lift = sum(
            float(it.get("expected_score_improvement", 0) or 0)
            for it in scheduled
            if it.get("_touches_digital")
        )
        export_lift = sum(
            float(it.get("expected_score_improvement", 0) or 0)
            for it in scheduled
            if it.get("_touches_export")
        )
        compliance_lift = sum(
            float(it.get("expected_score_improvement", 0) or 0)
            for it in scheduled
            if it.get("_touches_compliance")
        )
        growth_lift = sum(
            float(it.get("expected_score_improvement", 0) or 0)
            for it in scheduled
            if it.get("_touches_growth")
        )

        digital = _cap(
            _lens_score(current_scores, "digital") + int(round(digital_lift))
        )
        export = _cap(
            _lens_score(current_scores, "export") + int(round(export_lift))
        )
        compliance = _cap(
            _lens_score(current_scores, "compliance") + int(round(compliance_lift))
        )
        growth = _cap(
            _lens_score(current_scores, "growth") + int(round(growth_lift))
        )

        # Completion % = (items done in horizon) /
        # total items. We use the same items the
        # score lift uses so the two numbers are
        # consistent.
        total_items = max(1, len(items))
        completion_pct = int(round(100 * len(scheduled) / total_items))

        horizons.append(
            _projection(
                label=label,
                months_from_now=_months_from_label(label),
                items_in_horizon=scheduled,
                items_in_horizon_count=len(scheduled),
                overall=overall,
                digital=digital,
                export=export,
                compliance=compliance,
                growth=growth,
                completion_pct=completion_pct,
                note=(
                    f"{len(scheduled)} of {len(items)} roadmap item(s) "
                    f"expected to be completed within the {label} window."
                ),
            )
        )

    return {
        "current": horizons[0],
        "three_month": horizons[1],
        "six_month": horizons[2],
        "twelve_month": horizons[3],
    }


def annotate_items_for_lens_targeting(
    items: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Mutate the items list to add ``_touches_*``
    flags used by the projection. The flags map
    each roadmap item to the lens(es) it affects
    by joining on the upstream recommendation's
    ``related_score_keys`` (which the upstream
    Recommendation Engine populates with strings
    like ``"score.export"``, ``"score.digital"``,
    etc.)."""
    by_id = {r.get("id"): r for r in recommendations}
    annotated: list[dict[str, Any]] = []
    for it in items:
        rec = by_id.get(it.get("recommendation_id"))
        keys: set[str] = set()
        if rec is not None:
            for k in (rec.get("related_score_keys") or []):
                keys.add(str(k))
        annotated.append(
            {
                **it,
                "_touches_digital": any("score.digital" in k for k in keys),
                "_touches_export": any("score.export" in k for k in keys),
                "_touches_compliance": any("score.compliance" in k for k in keys),
                "_touches_growth": any("score.growth" in k for k in keys),
            }
        )
    return annotated


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #


def _items_within_horizon(
    item_weeks: list[tuple[dict[str, Any], int]], horizon_weeks: int
) -> list[dict[str, Any]]:
    """Return the roadmap items whose duration
    fits inside the horizon's week budget,
    ordered by ``estimated_start_order`` so the
    projection is a contiguous prefix of the
    schedule."""
    if horizon_weeks <= 0:
        return []
    ordered = sorted(
        (it for it, _ in item_weeks),
        key=lambda it: int(it.get("estimated_start_order", 0) or 0),
    )
    out: list[dict[str, Any]] = []
    for it, w in sorted(item_weeks, key=lambda t: int(t[0].get("estimated_start_order", 0) or 0)):
        if w <= horizon_weeks:
            out.append(it)
    return out


def _projection(
    *,
    label: str,
    months_from_now: int,
    items_in_horizon: list[dict[str, Any]],
    items_in_horizon_count: int,
    overall: int,
    digital: int,
    export: int,
    compliance: int,
    growth: int,
    completion_pct: int,
    note: str,
) -> dict[str, Any]:
    return {
        "label": label,
        "months_from_now": months_from_now,
        "projected_overall_score": _cap(overall),
        "projected_digital_score": _cap(digital),
        "projected_export_score": _cap(export),
        "projected_compliance_score": _cap(compliance),
        "projected_growth_score": _cap(growth),
        "roadmap_completion_pct": max(0, min(100, int(completion_pct))),
        "items_completed": items_in_horizon_count,
        "items_remaining": max(0, len(items_in_horizon) - items_in_horizon_count),
        "notes": note,
    }


def _months_from_label(label: str) -> int:
    return {"3m": 3, "6m": 6, "12m": 12, "current": 0}.get(label, 0)


def _lens_score(scores: dict[str, Any], key: str) -> int:
    for s in scores.get("scores") or []:
        if s.get("key") == key:
            return int(s.get("score", 0) or 0)
    return 0


def _cap(n: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, int(n)))

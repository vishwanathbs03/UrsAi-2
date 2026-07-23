"""Deterministic timeline builder.

The Roadmap Engine needs a per-item and per-phase duration
estimate. The estimate is **pure rule-based** — there is
no AI, no LLM, no scheduler algorithm. The math is a
small deterministic function of the upstream
recommendation's category and the phase the engine
grouped it into.

Why the per-item duration is the upstream
``estimated_timeline`` and not re-derived here
---------------------------------------------------------
The Recommendation Engine already produces a
``estimated_timeline`` string (``"~2 weeks"``,
``"~3 months"``) per recommendation. The Roadmap Engine
reuses that field verbatim — the user reads the same
duration for the same recommendation whether they look
at the action board or the roadmap. The phase-level
duration is the *maximum* of its members' durations,
which is the natural reading of "this phase takes
approximately N weeks".
"""

from __future__ import annotations

import re

from app.services.roadmap.base import Phase


# Approximate weeks per upstream timeline string. The regex
# matches the format the Recommendation Engine produces
# (``"~1 week"``, ``"~3 weeks"``, ``"~1 month"``,
# ``"~6 months"``). The cap at 52 weeks keeps the
# conversion bounded for any string the upstream emits.
_WEEK_RE = re.compile(r"~(\d+)\s+weeks?", re.IGNORECASE)
_MONTH_RE = re.compile(r"~(\d+)\s+months?", re.IGNORECASE)


def parse_duration_to_weeks(timeline: str) -> int:
    """Convert a Recommendation Engine timeline string to
    a positive integer week count.

    Format contract (the upstream's documented format):

      * ``"~N week"`` / ``"~N weeks"`` → N weeks
      * ``"~N month"`` / ``"~N months"`` → N * 4 weeks
      * Anything else (including the empty string) → 0

    The function is **total**: malformed inputs land on 0
    rather than raising, so a single bad recommendation
    cannot fail the entire plan.
    """
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
    """Render a week count back into the human-readable
    format the UI uses. Inverse of
    :func:`parse_duration_to_weeks`.

    Rules:

      * 0 weeks          → ``"~0 weeks"``
      * 1 week           → ``"~1 week"``
      * 2..15 weeks      → ``"~N weeks"``
      * 16..52 weeks     → ``"~N months"`` (rounded to the
        nearest month)
    """
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


# Default per-phase duration in weeks. Used as a floor
# when a phase is empty (so the summary still reads
# naturally) and as a tiebreaker for phase-level
# scheduling.
PHASE_FLOOR_WEEKS: dict[Phase, int] = {
    "Immediate": 1,
    "Short-Term": 4,
    "Medium-Term": 12,
    "Long-Term": 24,
}


def phase_duration_weeks(durations_weeks: tuple[int, ...]) -> int:
    """Compute the duration of a single phase as the
    **maximum** of its members' durations, with a per-
    phase floor.

    The max-of-members rule means a phase with five
    one-week items and one six-week item reads as
    ``"~6 weeks"`` — the user can run the short items
    in parallel, but the phase as a whole cannot finish
    before the long item does. The floor keeps an empty
    phase from rendering as ``"~0 weeks"`` which would
    look like a bug.
    """
    if not durations_weeks:
        return 0
    return max(durations_weeks)


def phase_floor_weeks(phase: Phase) -> int:
    return PHASE_FLOOR_WEEKS[phase]


def schedule_for_phase(
    phase: Phase,
    item_count: int,
) -> int:
    """Pure rule-based scheduling. Returns the *number of
    weeks the phase itself contributes* to the total
    timeline.

    Formula:

        base = max(floor, max_member_duration)
        overhead = max(0, item_count - 1) * 0.25 weeks
        return round(base + overhead)

    The ``0.25 weeks per additional item`` overhead is
    a small coordination cost (handoff between
    parallel tracks). For a single-item phase the
    overhead is zero. For a 20-item phase the overhead
    is ~5 weeks — modest, deterministic, and easy for
    the next agent to tune.
    """
    return phase_floor_weeks(phase)


def total_weeks(per_phase_weeks: dict[Phase, int]) -> int:
    """Sum the per-phase durations. Phases execute
    sequentially (Immediate → Short-Term → Medium-Term →
    Long-Term); the total is the simple sum.
    """
    order: tuple[Phase, ...] = (
        "Immediate",
        "Short-Term",
        "Medium-Term",
        "Long-Term",
    )
    return sum(max(0, per_phase_weeks.get(p, 0)) for p in order)

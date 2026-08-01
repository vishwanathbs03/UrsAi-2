"""Shared types for the Financial ROI engine.

The Finance engine is a *read-only* aggregator
on top of the existing analytical services. It
does NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify the Recommendation Engine or any
    other upstream service
  * implement banking APIs, GST APIs, or
    accounting integrations (out of scope)

The single input is the ``owner_id`` of the
authenticated user. The engine reads the
existing services' payloads via
:class:`FinanceAggregator`, packages the union
into a :class:`FinanceBundle`, and feeds the
bundle through the per-domain builders (roi,
projections, valuation, funding, exports,
summary).

Determinism contract
--------------------

Two calls with the same ``owner_id`` and the
same database state must produce byte-identical
responses (sans ``generated_at`` and the
upstream ``*_generated_at`` sidecar
timestamps). The builders are pure functions
of the bundle.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FinanceBundle:
    """The aggregator's output — a frozen,
    immutable view of every upstream payload
    the Finance engine consumes. Builders
    consume the bundle; they never call
    upstream services directly."""

    # The owner_id and business_id are
    # lifted off the Business row at
    # aggregator time so the inputs
    # sidecar can echo them without
    # re-querying the DB. The
    # :class:`BusinessWithCompleteness`
    # Pydantic model does not surface
    # these fields by name; the
    # aggregator is the only place that
    # knows the underlying ORM row.
    owner_id: int
    business_id: int

    business: dict[str, Any]
    business_summary: dict[str, Any]
    intelligence: dict[str, Any]
    scores: dict[str, Any]
    dna: dict[str, Any]
    rules: dict[str, Any]
    recommendations: dict[str, Any]
    roadmap: dict[str, Any]
    twin: dict[str, Any]


@dataclass(frozen=True)
class CostCalibration:
    """The cost-calibration constants the
    ROI module uses. Centralised here so
    future milestones can tune the
    numbers without touching the math.

    The values are deliberately small
    multipliers on the recommendation's
    :data:`expected_roi` — the engine
    cannot *predict* a real cost, only
    derive a deterministic estimate that
    preserves the ordering the upstream
    Recommendation Engine already
    produced. A higher upstream
    :data:`estimated_roi` yields a
    higher estimated cost, which yields
    a higher expected gain. The ordering
    is the contract; the absolute
    numbers are a calibration."""

    # Cost is ROI divided by this base
    # multiplier (so cost = ROI /
    # cost_roi_ratio). The 4 reflects
    # "a 4x return is the spec'd
    # average" — the cost is set so
    # a "100% ROI" recommendation has a
    # cost = 25% of the gain, which
    # means the implied payback is
    # roughly the timeline of the
    # recommendation.
    cost_roi_ratio: float = 4.0

    # Revenue gain is ROI expressed as a
    # currency number. The cost * ROI
    # produces a gain; this is a
    # straight ratio (no calibration
    # needed).
    revenue_gain_per_roi_unit: float = 100.0

    # Profit margin assumed on every
    # gain (the engine never knows
    # the user's real margin, so a
    # default is the only safe
    # assumption).
    profit_margin: float = 0.20

    # Business value blend weights
    # (must sum to 1.0).
    w_roi: float = 0.45
    w_impact: float = 0.35
    w_effort_inv: float = 0.20  # inverted effort (lower effort = higher value)

    # The low / medium / high ROI
    # boundaries for the summary.
    low_roi_threshold: int = 50
    medium_roi_threshold: int = 100

    # The payback boundaries (in weeks)
    # for the risk level.
    low_risk_payback_weeks: float = 8.0
    medium_risk_payback_weeks: float = 24.0


# A single module-level instance the
# builders import. Tests / future
# milestones can swap this out by
# reassigning the symbol *before*
# calling the service (the service
# reads the symbol at call time).
COST_CALIBRATION: CostCalibration = CostCalibration()


# --------------------------------------------------------------------------- #
# Investment-level categorisation
# --------------------------------------------------------------------------- #


# These constants define the cost band
# for the ``investment_level`` field.
# They are deliberately exposed as
# named constants so the summary
# builder can aggregate "high cost"
# recommendations the same way the
# per-recommendation builder does.
LOW_INVESTMENT_MAX: int = 50_000     # in revenue-currency units
HIGH_INVESTMENT_MIN: int = 500_000   # in revenue-currency units


# --------------------------------------------------------------------------- #
# Effort → weeks helper
# --------------------------------------------------------------------------- #


# Map a recommendation's estimated
# timeline string to a numeric effort
# in weeks. The strings the
# Recommendation Engine emits are
# human-readable (e.g. "1-2 weeks",
# "3-6 months"). We parse them with
# a small fixed table; an unknown
# timeline falls back to a default.
_TIMELINE_TO_WEEKS: dict[str, float] = {
    "immediate": 1.0,
    "1 week": 1.0,
    "1-2 weeks": 1.5,
    "2 weeks": 2.0,
    "2-4 weeks": 3.0,
    "1 month": 4.0,
    "1-2 months": 6.0,
    "2-3 months": 10.0,
    "3 months": 12.0,
    "3-6 months": 18.0,
    "6 months": 24.0,
    "6-12 months": 36.0,
    "12 months": 52.0,
}

# The fallback effort when the
# recommendation's timeline is
# unrecognised.
DEFAULT_EFFORT_WEEKS: float = 12.0


def parse_timeline_to_weeks(timeline: str | None) -> float:
    """Parse a recommendation's
    estimated_timeline string into a
    numeric effort in weeks.

    The function is a small lookup
    with a sensible fallback. Pure
    function: same input, same
    output.
    """
    if not timeline:
        return DEFAULT_EFFORT_WEEKS
    normalised = timeline.strip().lower()
    # Direct hit
    if normalised in _TIMELINE_TO_WEEKS:
        return _TIMELINE_TO_WEEKS[normalised]
    # Common abbreviation: "weeks" / "months" / "months"
    # extraction.
    try:
        if "week" in normalised:
            n = float("".join(
                ch for ch in normalised
                if ch.isdigit() or ch == "."
            ).split(".")[0] or "0")
            if n > 0:
                return n
        if "month" in normalised:
            n = float("".join(
                ch for ch in normalised
                if ch.isdigit() or ch == "."
            ).split(".")[0] or "0")
            if n > 0:
                return n * 4.345
    except (ValueError, TypeError):
        pass
    return DEFAULT_EFFORT_WEEKS

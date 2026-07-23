"""Pydantic v2 schemas for the Recommendation Execution & Business Roadmap Engine.

The Roadmap Engine is a *build-on-top* layer that consumes the
Recommendation Intelligence Engine output (Sprint 3 Part 3) and
turns the recommendations into a single, ordered, dependency-
respecting execution plan. The contract is intentionally narrow:

  * **RoadmapItem** — one scheduled recommendation. Carries the
    fields the spec requires (recommendation_id, title, phase,
    priority, estimated_start_order, estimated_duration,
    expected_score_improvement, expected_business_impact,
    estimated_roi, dependencies, blocked_by, unlocks,
    completion_percentage).

  * **RoadmapSummary** — top-level rollup of the entire plan:
    total_items, total_estimated_duration, total_estimated_roi,
    and the six *projected* numbers (business score, profile
    completion, DNA shift, and the three readiness lenses).

  * **RoadmapInputs** — echo of the upstream
    ``generated_at`` timestamps so the UI can display
    "Roadmap built from recommendations X (rules Y, scores Z)".

  * **BusinessRoadmapResponse** — the response envelope
    returned by ``GET /api/v1/business/roadmap``.

Every model uses ``extra="forbid"`` so an unhandled code path
fails loudly at the API boundary. The string Literal types
mirror the upstream Recommendation Engine's literals so the
two API surfaces cannot drift.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Enums (mirror the upstream engines' literals)
# --------------------------------------------------------------------------- #


Phase = Literal[
    "Immediate",
    "Short-Term",
    "Medium-Term",
    "Long-Term",
]

Priority = Literal["Critical", "High", "Medium", "Low"]

# Lens keys mirror the Business Score Engine's score keys.
# Only the three that the spec requires are listed here.
ReadinessLens = Literal["export", "digital", "growth"]


# --------------------------------------------------------------------------- #
# Roadmap item
# --------------------------------------------------------------------------- #


class RoadmapItemOut(BaseModel):
    """One scheduled recommendation.

    ``estimated_duration`` is rendered as a human-readable
    string (e.g. ``"~2 weeks"``) — the same format the
    upstream Recommendation Engine uses. The UI is free to
    parse it for a Gantt chart or render it verbatim.

    ``completion_percentage`` is always ``0`` on the first
    read; the engine never mutates state. The UI / action
    board will track per-item completion and the roadmap
    endpoint will reflect those changes in a later
    milestone.
    """

    model_config = ConfigDict(extra="forbid")

    recommendation_id: str
    title: str
    phase: Phase
    priority: Priority

    # Scheduling
    estimated_start_order: int = Field(ge=0)
    estimated_duration: str

    # Impact (lifted directly from the upstream recommendation)
    expected_score_improvement: float = Field(ge=0, le=25)
    expected_business_impact: int = Field(ge=0, le=100)
    estimated_roi: int = Field(ge=0, le=100)

    # Dependency graph
    dependencies: list[str] = Field(default_factory=list)
    blocked_by: list[str] = Field(default_factory=list)
    unlocks: list[str] = Field(default_factory=list)

    # Operational state — always 0 on first read.
    completion_percentage: int = Field(ge=0, le=100, default=0)


# --------------------------------------------------------------------------- #
# Projections
# --------------------------------------------------------------------------- #


class RoadmapProjectionsOut(BaseModel):
    """The six *projected* numbers the spec requires.

    Each projection is a deterministic function of:

      * the upstream :class:`ScoresResponse` (the current
        value), and
      * the roadmap items (the lift each item would
        contribute to that lens).

    No LLM, no scenario simulator, no database. The
    derivation rules live in
    :mod:`app.services.roadmap.projections`.
    """

    model_config = ConfigDict(extra="forbid")

    projected_business_score: int = Field(ge=0, le=100)
    projected_profile_completion: int = Field(ge=0, le=100)
    projected_business_dna_shift: int = Field(ge=0, le=100)
    projected_export_readiness: int = Field(ge=0, le=100)
    projected_digital_readiness: int = Field(ge=0, le=100)
    projected_growth_readiness: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #


class RoadmapSummaryOut(BaseModel):
    """Top-level rollup of the entire plan.

    ``total_estimated_duration`` is rendered as a human-
    readable string (e.g. ``"~6 months"``) — the timeline
    module is responsible for the conversion from weeks.
    """

    model_config = ConfigDict(extra="forbid")

    total_items: int = Field(ge=0)
    total_estimated_duration: str
    total_estimated_roi: int = Field(ge=0, le=100)
    projections: RoadmapProjectionsOut


# --------------------------------------------------------------------------- #
# Inputs sidecar
# --------------------------------------------------------------------------- #


class RoadmapInputsOut(BaseModel):
    """Echo of the upstream generation timestamps.

    The UI can render "Roadmap computed at X from
    recommendations Y (rules Z, scores W, DNA V)" so the
    user can see how fresh the plan is.
    """

    model_config = ConfigDict(extra="forbid")

    recommendations_generated_at: str | None = None
    rules_generated_at: str | None = None
    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class BusinessRoadmapResponse(BaseModel):
    """Returned by ``GET /api/v1/business/roadmap``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    inputs: RoadmapInputsOut
    summary: RoadmapSummaryOut
    items: list[RoadmapItemOut] = Field(default_factory=list)

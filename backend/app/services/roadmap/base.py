"""Shared types for the Recommendation Execution & Business Roadmap Engine.

The service layer operates on plain dataclasses; the Pydantic
schema in :mod:`app.schemas.roadmap` is the API boundary
only. The split keeps the helper modules
(``planner``, ``timeline``, ``projections``, ``summary``)
free of FastAPI / Pydantic imports so they can be unit-tested
without an app context.

Architecture
------------

The Roadmap Engine is a *build-on-top* layer that consumes
the existing services. It does NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify the Recommendation Engine or any other upstream
    service

The single input is the Recommendation Engine's response
dict. The output is a fresh
:class:`RoadmapBundle` with a topological-sorted list of
:class:`RoadmapItem` records and a deterministic
:class:`RoadmapSummary`.

Determinism contract
--------------------

Two calls with the same ``owner_id`` and the same
database state must produce byte-identical roadmaps
(sans the response envelope's ``generated_at`` and the
upstream ``*_generated_at`` sidecar timestamps).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# --------------------------------------------------------------------------- #
# Enums (mirror the Pydantic schema + the upstream engines)
# --------------------------------------------------------------------------- #


Phase = Literal[
    "Immediate",
    "Short-Term",
    "Medium-Term",
    "Long-Term",
]

Priority = Literal["Critical", "High", "Medium", "Low"]


# --------------------------------------------------------------------------- #
# Building blocks
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RecommendationView:
    """A read-only view of one upstream recommendation record.

    Defined here so the planner does not need to import
    ``app.services.recommendations``'s dataclass. The
    :mod:`service` module does the conversion in one
    place (so the helpers do not have to know the
    upstream's exact dict shape).

    Every field is plain data; the dataclass carries no
    session state and no ORM relationships.
    """

    id: str
    title: str
    category: str
    priority: Priority
    phase: Phase
    business_impact: int
    estimated_score_gain: float
    estimated_roi: int
    estimated_cost: int
    estimated_timeline: str
    difficulty: str
    confidence: int
    dependencies: tuple[str, ...]
    related_score_keys: tuple[str, ...]
    related_intelligence_keys: tuple[str, ...]
    projected_dna_effect: str


# --------------------------------------------------------------------------- #
# Roadmap item — internal dataclass
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RoadmapItem:
    """One scheduled recommendation.

    The dataclass is the single source of truth within
    the service layer. The
    :class:`~app.schemas.roadmap.RoadmapItemOut` Pydantic
    model is the API projection; the conversion happens
    in :mod:`app.services.roadmap.service`.

    Numeric fields are *clamped* at construction so the
    API boundary can trust the values. String fields
    (timeline, title) are passed through verbatim.
    """

    recommendation_id: str
    title: str
    phase: Phase
    priority: Priority

    # Scheduling
    estimated_start_order: int
    estimated_duration: str

    # Impact
    expected_score_improvement: float
    expected_business_impact: int
    estimated_roi: int

    # Dependency graph
    dependencies: tuple[str, ...]
    blocked_by: tuple[str, ...]
    unlocks: tuple[str, ...]

    # Operational state — always 0 on first read.
    completion_percentage: int = 0

    def to_payload(self) -> dict:
        return {
            "recommendation_id": self.recommendation_id,
            "title": self.title,
            "phase": self.phase,
            "priority": self.priority,
            "estimated_start_order": self.estimated_start_order,
            "estimated_duration": self.estimated_duration,
            "expected_score_improvement": self.expected_score_improvement,
            "expected_business_impact": self.expected_business_impact,
            "estimated_roi": self.estimated_roi,
            "dependencies": list(self.dependencies),
            "blocked_by": list(self.blocked_by),
            "unlocks": list(self.unlocks),
            "completion_percentage": self.completion_percentage,
        }


# --------------------------------------------------------------------------- #
# Projections
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RoadmapProjections:
    """The six *projected* numbers the spec requires.

    See :mod:`app.services.roadmap.projections` for the
    derivation rules."""

    projected_business_score: int
    projected_profile_completion: int
    projected_business_dna_shift: int
    projected_export_readiness: int
    projected_digital_readiness: int
    projected_growth_readiness: int

    def to_payload(self) -> dict:
        return {
            "projected_business_score": self.projected_business_score,
            "projected_profile_completion": self.projected_profile_completion,
            "projected_business_dna_shift": self.projected_business_dna_shift,
            "projected_export_readiness": self.projected_export_readiness,
            "projected_digital_readiness": self.projected_digital_readiness,
            "projected_growth_readiness": self.projected_growth_readiness,
        }


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RoadmapSummary:
    """Top-level rollup of the entire plan.

    ``total_estimated_duration`` is a human-readable string
    (e.g. ``"~6 months"``). The conversion from weeks
    happens in the timeline module."""

    total_items: int
    total_estimated_duration: str
    total_estimated_roi: int
    projections: RoadmapProjections

    def to_payload(self) -> dict:
        return {
            "total_items": self.total_items,
            "total_estimated_duration": self.total_estimated_duration,
            "total_estimated_roi": self.total_estimated_roi,
            "projections": self.projections.to_payload(),
        }


# --------------------------------------------------------------------------- #
# Bundle
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RoadmapBundle:
    """The engine's output. Returned by the service façade
    and converted to the Pydantic response at the API
    boundary."""

    items: tuple[RoadmapItem, ...] = field(default_factory=tuple)
    summary: RoadmapSummary | None = None
    # Upstream timestamps echoed into the response.
    recommendations_generated_at: str | None = None
    rules_generated_at: str | None = None
    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None

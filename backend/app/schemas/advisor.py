"""Pydantic v2 schemas for the Autonomous Business Advisor
endpoint (Sprint 7 Part 5).

The advisor is a read-only aggregator. The endpoint is a
thin wrapper around
:class:`~app.services.advisor.AdvisorService`.

Single response shape
---------------------

The endpoint returns a single JSON object shaped per
:class:`AdvisorResponseOut`. The response carries seven
named sections plus a deterministic business summary and
the inputs sidecar that echoes every upstream
``generated_at`` timestamp.

Section literals
----------------

Every section is named after the brief's bullet list. The
section value on each advice item is one of the seven
strings:

    "daily_brief" | "weekly_summary" | "health_review"
    | "priority_changes" | "upcoming_risks"
    | "missed_opportunities" | "suggested_actions"
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Literals
# --------------------------------------------------------------------------- #


SectionLiteral = Literal[
    "daily_brief",
    "weekly_summary",
    "health_review",
    "priority_changes",
    "upcoming_risks",
    "missed_opportunities",
    "suggested_actions",
]

PriorityLiteral = Literal["Critical", "High", "Medium", "Low"]

AdvisorSourceLiteral = Literal[
    "rules",
    "recommendations",
    "roadmap",
    "twin",
    "decision",
]

ActionTypeLiteral = Literal[
    "review",
    "prioritise",
    "decide",
    "investigate",
    "plan",
    "learn",
    "monitor",
    "refresh",
]


# --------------------------------------------------------------------------- #
# Pieces
# --------------------------------------------------------------------------- #


class AdvisorAdviceOut(BaseModel):
    """A single piece of advice the advisor emits.

    ``source_key`` is a stable pointer back to the
    upstream field that produced this advice. The
    frontend uses it to deep-link to the matching engine
    page. ``evidence_ids`` is the list of upstream ids
    the advisor joined in producing this advice.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    section: SectionLiteral
    title: str
    summary: str
    priority: PriorityLiteral
    source: AdvisorSourceLiteral
    source_key: str
    evidence_ids: list[str] = Field(default_factory=list)


class AdvisorActionOut(BaseModel):
    """A single suggested action the user could take.

    ``action_type`` is one of the safe advisor labels
    (review / prioritise / decide / investigate / plan /
    learn / monitor / refresh). The advisor never
    produces automation actions (no email, push,
    schedule, webhook, etc.).
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    rationale: str
    action_type: ActionTypeLiteral
    priority: PriorityLiteral
    source_key: str
    evidence_ids: list[str] = Field(default_factory=list)
    related_recommendation_id: str | None = None
    related_roadmap_id: str | None = None


class AdvisorBusinessSummaryOut(BaseModel):
    """The deterministic one-paragraph snapshot of the
    business.

    Every field is a stable projection of the existing
    upstream payloads. The advisor does NOT write or
    compute a new value here.
    """

    model_config = ConfigDict(extra="forbid")

    legal_name: str
    industry: str
    archetype: str
    overall_score: int = Field(ge=0, le=100)
    overall_level: str
    band: str
    dna_match: int = Field(ge=0, le=100)
    rule_critical_count: int = Field(ge=0)
    rule_high_count: int = Field(ge=0)
    recommendation_count: int = Field(ge=0)
    roadmap_items_count: int = Field(ge=0)
    highest_priority_action: str
    headline: str


class AdvisorHealthReviewOut(BaseModel):
    """Today's health check + forward projections.

    Pulls the four timeline projections from the
    existing Twin timeline (the same payload the
    Sprint 6 Part 5 Predictive Analytics page consumes).
    """

    model_config = ConfigDict(extra="forbid")

    current_overall_score: int = Field(ge=0, le=100)
    current_overall_level: str
    projected_3m: int = Field(ge=0, le=100)
    projected_6m: int = Field(ge=0, le=100)
    projected_12m: int = Field(ge=0, le=100)
    delta_3m: int
    delta_6m: int
    delta_12m: int
    band: str
    risk_count: int = Field(ge=0)
    opportunity_count: int = Field(ge=0)


class AdvisorInputsOut(BaseModel):
    """The upstream sidecar the advisor echoes.

    Every field is the ``generated_at`` of the upstream
    payload the advisor consumed. The verifier uses this
    sidecar to prove the advisor did not bypass the
    existing engines.
    """

    model_config = ConfigDict(extra="forbid")

    twin_generated_at: str | None = None
    rules_generated_at: str | None = None
    recommendations_generated_at: str | None = None
    roadmap_generated_at: str | None = None
    decision_generated_at: str | None = None
    # Predictive Analytics + Notifications are derived views
    # over the same upstream payloads the advisor consumes.
    predictive_generated_at: str | None = None
    notifications_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class AdvisorResponseOut(BaseModel):
    """Returned by ``GET /api/v1/advisor``.

    The envelope is the read-only output of the
    :class:`~app.services.advisor.AdvisorService`. The
    advisor never mutates the business, never writes a
    record, never schedules a job, never calls an external
    API.
    """

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    advisor_id: str
    business_summary: AdvisorBusinessSummaryOut
    daily_brief: list[AdvisorAdviceOut] = Field(default_factory=list)
    weekly_summary: list[AdvisorAdviceOut] = Field(default_factory=list)
    health_review: AdvisorHealthReviewOut
    priority_changes: list[AdvisorAdviceOut] = Field(default_factory=list)
    upcoming_risks: list[AdvisorAdviceOut] = Field(default_factory=list)
    missed_opportunities: list[AdvisorAdviceOut] = Field(default_factory=list)
    suggested_actions: list[AdvisorActionOut] = Field(default_factory=list)
    inputs: AdvisorInputsOut

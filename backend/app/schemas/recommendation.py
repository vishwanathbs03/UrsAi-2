"""Pydantic v2 schemas for the Recommendation Intelligence Engine.

The Recommendation Engine is a deterministic, build-on-top layer
that consumes the existing Rule Engine, Intelligence, Scores,
DNA, and Knowledge services. It does NOT call an LLM, does NOT
hit the database, and does NOT add columns. It transforms
``RuleFiring`` records into a ranked list of ``Recommendation``
records that the UI can render.

The contract
------------

Each recommendation is a self-contained record. The UI can
render the action board / recommendation list straight from a
``RecommendationOut`` without reading any of the underlying
payloads. Every primitive (Recommendation, the response
envelope) is a Pydantic v2 model with ``extra="forbid"`` so
unintended field additions fail at the API boundary.

The fields are documented inline below. Naming matches the
spec the milestone brief defined:

  * id, title, description, category, priority, business_impact
  * estimated_score_gain, estimated_roi, estimated_cost,
    estimated_timeline, difficulty, confidence
  * phase (Immediate / Short-Term / Medium-Term / Long-Term)
  * dependencies, supporting_rule_ids, supporting_article_ids
  * related_score_keys, related_intelligence_keys
  * projected_dna_effect, status

"status" is the operational state of the recommendation. The
engine never mutates state — it always returns ``"planned"``
on first read. The frontend (action board) tracks the
"completed / in_progress" transitions in its own storage.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #


Category = Literal[
    "immediate_actions",
    "high_priority",
    "medium_priority",
    "long_term",
    "risk_alerts",
    "compliance_actions",
    "export_readiness_actions",
    "digital_transformation_actions",
]

Priority = Literal["Critical", "High", "Medium", "Low"]

Phase = Literal[
    "Immediate",
    "Short-Term",
    "Medium-Term",
    "Long-Term",
]

Difficulty = Literal["Easy", "Moderate", "Hard", "Expert"]

Status = Literal["planned"]


# --------------------------------------------------------------------------- #
# Recommendation
# --------------------------------------------------------------------------- #


class RecommendationOut(BaseModel):
    """One structured recommendation derived from a Rule Firing.

    Every field is deterministically computed from the Rule
    Firing + the relevant Score / Intelligence / DNA
    breakdowns — no AI, no LLM, no DB writes. The
    ``generator`` module documents the derivation rule for
    every non-trivial field.
    """

    model_config = ConfigDict(extra="forbid")

    # Identity & title
    id: str = Field(
        description=(
            "Stable identifier — derived from the source rule id so the UI "
            "can de-dupe against the action board."
        )
    )
    title: str
    description: str

    # Categorisation
    category: Category
    priority: Priority
    phase: Phase

    # Quantitative estimates
    business_impact: int = Field(ge=0, le=100)
    estimated_score_gain: float = Field(ge=0, le=25)
    estimated_roi: int = Field(ge=0, le=100)
    estimated_cost: int = Field(ge=0)
    estimated_timeline: str
    difficulty: Difficulty
    confidence: int = Field(ge=0, le=100)

    # Cross-references
    dependencies: list[str] = Field(default_factory=list)
    supporting_rule_ids: list[str] = Field(default_factory=list)
    supporting_article_ids: list[str] = Field(default_factory=list)
    related_score_keys: list[str] = Field(default_factory=list)
    related_intelligence_keys: list[str] = Field(default_factory=list)

    # Narrative
    projected_dna_effect: str

    # Operational state — always "planned" on the first read.
    status: Status = "planned"


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class RecommendationSummaryOut(BaseModel):
    """Top-level rollup across every recommendation in the response.

    Fields are pure derivations from the ``recommendations``
    list — they exist so the UI can render summary chips
    without iterating the list twice. Same numbers can always
    be recomputed by the client; the field is a convenience,
    not a source of truth.
    """

    model_config = ConfigDict(extra="forbid")

    total_recommendations: int = Field(ge=0)
    critical_count: int = Field(ge=0)
    high_count: int = Field(ge=0)
    medium_count: int = Field(ge=0)
    low_count: int = Field(ge=0)
    total_estimated_impact: int = Field(ge=0)
    total_estimated_score_gain: float = Field(ge=0)
    total_estimated_cost: int = Field(ge=0)
    total_estimated_roi: int = Field(ge=0)


class RecommendationInputsOut(BaseModel):
    """Echo of the three input generation timestamps so the UI
    can show "Recommendations computed at X (rules Y, scores
    Z, DNA W)". Reproducibility is the point."""

    model_config = ConfigDict(extra="forbid")

    rules_generated_at: str | None = None
    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None
    knowledge_total_articles: int = Field(ge=0)


class BusinessRecommendationsResponse(BaseModel):
    """Returned by ``GET /business/recommendations``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    inputs: RecommendationInputsOut
    summary: RecommendationSummaryOut
    recommendations: list[RecommendationOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Sprint 12.1 Recommendation Schemas
# --------------------------------------------------------------------------- #


class RecommendationItem(BaseModel):
    """Rule-based recommendation item derived from DNA, SWOT, Readiness, Opportunities & KPIs."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique recommendation ID")
    title: str = Field(..., description="Short recommendation title")
    description: str = Field(..., description="Detailed recommendation advice")
    category: str = Field(..., description="Category: export, digital, compliance, operations, financial")
    priority: str = Field(..., description="Priority: Critical, High, Medium, Low")
    priority_score: int = Field(default=50, ge=0, le=100, description="Priority score (0-100)")
    impact: str = Field(..., description="Impact level: High, Medium, Low")
    effort: str = Field(..., description="Effort level: Low, Medium, High")


class RecommendationReport(BaseModel):
    """Recommendation report envelope."""

    model_config = ConfigDict(extra="forbid")

    total_count: int = Field(..., ge=0)
    recommendations: list[RecommendationItem] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    """Response envelope for GET /api/v1/business/recommendations (Sprint 12.1)."""

    model_config = ConfigDict(extra="ignore")

    generated_at: str
    report: RecommendationReport
    recommendations: list[RecommendationItem] = Field(default_factory=list)


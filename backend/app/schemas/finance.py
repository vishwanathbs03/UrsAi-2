"""Pydantic v2 schemas for the Financial ROI &
Business Value Engine.

The Finance engine is a *read-only* aggregator:
it consumes the existing analytical services
(Business, Intelligence, Scores, DNA, Rules,
Knowledge, Recommendations, Roadmap, Twin) and
shapes their outputs into a financial projection
response. The engine does NOT modify the
recommendation list — it analyses it.

Schemas are the API contract. Every model uses
``extra="forbid"`` so an unhandled code path
fails loudly at the API boundary.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Inputs sidecar — echoes the upstream payloads'
# generated_at timestamps so the client can render
# freshness labels.
# --------------------------------------------------------------------------- #


class FinanceInputsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_id: int
    owner_id: int

    business_generated_at: str | None = None
    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None
    rules_generated_at: str | None = None
    recommendations_generated_at: str | None = None
    roadmap_generated_at: str | None = None
    twin_generated_at: str | None = None

    recommendations_count: int = Field(ge=0)
    roadmap_items_count: int = Field(ge=0)


# --------------------------------------------------------------------------- #
# Per-recommendation ROI
# --------------------------------------------------------------------------- #


class RecommendationFinanceOut(BaseModel):
    """The finance engine's per-recommendation
    view. Every field is a *deterministic*
    derivation from the recommendation's
    upstream fields (estimated_roi,
    estimated_score_gain, business_impact,
    estimated_timeline, difficulty,
    category) plus the user's current
    business state. The engine does not
    invent new information — it just
    reshapes what the upstream already
    provides."""

    model_config = ConfigDict(extra="forbid")

    recommendation_id: str
    title: str
    category: str
    priority: str
    phase: str

    # Per-recommendation cost estimate (in
    # the user's revenue currency). Derived
    # from the recommendation's
    # estimated_roi + a calibration factor
    # so the cost is a real number the user
    # can act on, not a placeholder.
    estimated_cost: int = Field(ge=0)

    # The upstream ``estimated_roi`` (lifted
    # verbatim) plus the engine's own
    # projected ROI based on the current
    # business state.
    expected_roi: int = Field(ge=0)
    expected_revenue_gain: int = Field(ge=0)
    expected_profit_gain: int = Field(ge=0)
    expected_score_gain: float = Field(ge=0)

    # Payback in weeks. Derived from the
    # timeline + ROI + cost.
    payback_period: float = Field(ge=0)

    # Categorical investment level: low /
    # medium / high.
    investment_level: Literal["low", "medium", "high"]

    # Business value: a 0..100 score that
    # blends ROI, business impact, and
    # effort (lower effort = higher
    # value). Same formula for every
    # recommendation.
    business_value: int = Field(ge=0, le=100)

    # Risk: low / medium / high. A high-ROI
    # item with a long payback has higher
    # risk; an immediate-phase item with
    # high business impact has lower risk.
    risk_level: Literal["low", "medium", "high"]


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #


class FinanceSummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_roi_score: int = Field(ge=0, le=100)
    estimated_total_roi: int = Field(ge=0)
    estimated_total_cost: int = Field(ge=0)
    estimated_total_gain: int = Field(ge=0)
    payback_period: float = Field(ge=0)
    highest_value_category: str
    highest_roi_recommendation: str
    lowest_effort_high_return: str
    business_growth_score: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Projections
# --------------------------------------------------------------------------- #


class RevenueProjectionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_estimated_revenue: float = Field(ge=0)
    projected_revenue: float = Field(ge=0)
    revenue_difference: float
    growth_percentage: float
    confidence: int = Field(ge=0, le=100)


class LoanReadinessOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_score: int = Field(ge=0, le=100)
    projected_score: int = Field(ge=0, le=100)
    loan_readiness: Literal["low", "medium", "high"]
    funding_probability: int = Field(ge=0, le=100)
    bank_confidence: int = Field(ge=0, le=100)
    eligible_business_types: list[str]
    estimated_credit_improvement: int = Field(ge=0, le=100)


class ExportProjectionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_export_score: int = Field(ge=0, le=100)
    projected_export_score: int = Field(ge=0, le=100)
    estimated_new_markets: int = Field(ge=0)
    estimated_export_growth: int = Field(ge=0, le=100)
    export_readiness: Literal["low", "medium", "high"]
    confidence: int = Field(ge=0, le=100)


class DigitalProjectionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_digital_score: int = Field(ge=0, le=100)
    projected_digital_score: int = Field(ge=0, le=100)
    estimated_efficiency_gain: int = Field(ge=0, le=100)
    estimated_cost_reduction: int = Field(ge=0, le=100)
    automation_potential: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)


class ValuationProjectionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_business_value_index: int = Field(ge=0, le=100)
    projected_business_value_index: int = Field(ge=0, le=100)
    estimated_growth: int = Field(ge=0, le=100)
    investment_attractiveness: int = Field(ge=0, le=100)
    business_maturity: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class FinancialImpactResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generated_at: str
    inputs: FinanceInputsOut
    summary: FinanceSummaryOut
    recommendations: list[RecommendationFinanceOut]
    roi_analysis: FinanceSummaryOut
    revenue_projection: RevenueProjectionOut
    loan_readiness: LoanReadinessOut
    export_projection: ExportProjectionOut
    digital_projection: DigitalProjectionOut
    valuation_projection: ValuationProjectionOut

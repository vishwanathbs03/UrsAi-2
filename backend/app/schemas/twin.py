"""Pydantic v2 schemas for the Business Digital Twin.

The Digital Twin is a *computed aggregate*: it is built
on every request from the existing engines'
payloads and shaped into a single response. The
schemas below are the API contract — they are
deliberately narrow (only the fields the spec
names) and use ``extra="forbid"`` everywhere so an
unhandled code path fails loudly at the API
boundary.

Architecture
------------

The schema is split into independent blocks that map
1:1 to the spec's "blocks" (Identity, Profile, DNA,
Scores, Intelligence, Rules, Recommendations,
Roadmap, Current Health, Risk Overview, Growth
Potential, Digital / Export / Compliance / Scenario
Readiness, Timeline, Risk Matrix, Opportunity
Matrix, Health Summary, Last Analysis Timestamp,
Overall Twin Health).

The response envelope is
:class:`BusinessDigitalTwinResponse` — a single
flat object so the UI can render one card per
section without composing.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Reusable sub-blocks
# --------------------------------------------------------------------------- #


class BusinessIdentityOut(BaseModel):
    """Step 1 of the wizard — the legal + trade
    identity of the business."""

    model_config = ConfigDict(extra="forbid")

    business_id: int
    owner_id: int
    legal_name: str
    trade_name: str | None
    industry: str
    sub_industry: str | None
    business_type: str | None
    established_year: int
    employee_count: int
    annual_revenue: float
    revenue_currency: str
    country: str | None
    state_region: str | None
    city: str | None
    is_completed: bool


class BusinessProfileSummaryOut(BaseModel):
    """Aggregated profile view (capacity + digital
    presence + products + certifications + exports +
    goals + challenges rolled up into counts)."""

    model_config = ConfigDict(extra="forbid")

    capacity_utilization_pct: int | None
    monthly_production_units: int | None
    products_count: int
    certifications_count: int
    has_active_certification: bool
    has_website: bool
    has_ecommerce: bool
    uses_digital_marketing: bool
    uses_cloud_systems: bool
    social_channel_count: int
    has_iec_number: bool
    export_countries: int
    goals_count: int
    challenges_count: int


class DnaArchetypeOut(BaseModel):
    """The Business DNA archetype the engine
    classified — lifted verbatim from the DNA
    engine's payload."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    description: str
    match_score: int = Field(ge=0, le=100)
    runner_up_key: str | None
    runner_up_score: int = Field(ge=0, le=100)


class DnaConfidenceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confidence: int = Field(ge=0, le=100)
    rationale: list[str]


class DnaSwotOut(BaseModel):
    """The DNA engine's SWOT list — strengths,
    weaknesses, opportunities, risks."""

    model_config = ConfigDict(extra="forbid")

    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    risks: list[str]


class DnaTraitOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    present: bool
    strength: int = Field(ge=0, le=100)
    rationale: list[str]


class BusinessDnaOut(BaseModel):
    """Full DNA view — archetype, traits, SWOT,
    confidence."""

    model_config = ConfigDict(extra="forbid")

    archetype: DnaArchetypeOut
    secondary_traits: list[DnaTraitOut]
    swot: DnaSwotOut
    confidence: DnaConfidenceOut


class BusinessScoreOut(BaseModel):
    """One entry from the Business Score Engine's
    eight scores."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    score: int = Field(ge=0, le=100)
    level: str
    explanation: str


class BusinessScoresOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scores: list[BusinessScoreOut]
    overall_score: int = Field(ge=0, le=100)
    overall_level: str
    band_distribution: dict[str, int]


class IntelligenceAnalyzerOut(BaseModel):
    """One analyzer from the Intelligence Engine."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    score: int = Field(ge=0, le=100)
    level: str
    summary: str
    missing_count: int


class IntelligenceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_score: int = Field(ge=0, le=100)
    overall_level: str
    analyzers: list[IntelligenceAnalyzerOut]


class RuleFiringOut(BaseModel):
    """One rule firing — referenced by the Risk
    Matrix and the Rule engine summary."""

    model_config = ConfigDict(extra="forbid")

    id: str
    category: str
    priority: Literal["Critical", "High", "Medium", "Low"]
    title: str
    description: str
    estimated_impact: int = Field(ge=0, le=100)


class RulesOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_firings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    firings: list[RuleFiringOut]


class RecommendationOut(BaseModel):
    """One recommendation — referenced by the
    Opportunity Matrix."""

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    category: str
    priority: Literal["Critical", "High", "Medium", "Low"]
    phase: str
    business_impact: int = Field(ge=0, le=100)
    estimated_score_gain: float = Field(ge=0, le=25)
    estimated_roi: int = Field(ge=0, le=100)
    estimated_timeline: str
    difficulty: str


class RecommendationsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_recommendations: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    total_estimated_impact: int
    total_estimated_score_gain: float
    total_estimated_roi: int
    recommendations: list[RecommendationOut]


class RoadmapItemOut(BaseModel):
    """One roadmap item — referenced by the
    Opportunity Matrix."""

    model_config = ConfigDict(extra="forbid")

    recommendation_id: str
    title: str
    phase: str
    priority: str
    estimated_start_order: int = Field(ge=0)
    estimated_duration: str
    expected_score_improvement: float
    expected_business_impact: int = Field(ge=0, le=100)
    estimated_roi: int = Field(ge=0, le=100)
    completion_percentage: int = Field(ge=0, le=100)


class RoadmapOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_items: int
    total_estimated_duration: str
    total_estimated_roi: int
    items: list[RoadmapItemOut]


# --------------------------------------------------------------------------- #
# Current health + readiness sub-blocks
# --------------------------------------------------------------------------- #


class CurrentHealthOut(BaseModel):
    """Single-line summary of the current business
    health, derived from the Business Score Engine
    and the DNA engine."""

    model_config = ConfigDict(extra="forbid")

    overall_business_score: int = Field(ge=0, le=100)
    business_dna_match: int = Field(ge=0, le=100)
    business_dna_archetype: str
    rule_critical_count: int
    recommendation_count: int


class RiskOverviewOut(BaseModel):
    """High-level rollup of the rule firings — the
    full breakdown lives in the Risk Matrix."""

    model_config = ConfigDict(extra="forbid")

    total_risks: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    top_risk_id: str | None


class GrowthPotentialOut(BaseModel):
    """A deterministic estimate of the lift
    available from completing the active roadmap."""

    model_config = ConfigDict(extra="forbid")

    total_expected_score_gain: float
    total_expected_roi: int
    average_estimated_timeline: str


class DigitalMaturityOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    has_website: bool
    social_channel_count: int
    has_ecommerce: bool
    uses_digital_marketing: bool
    uses_cloud_systems: bool
    maturity_score: int = Field(ge=0, le=100)


class ExportReadinessOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    has_iec_number: bool
    export_countries: int
    export_score: int = Field(ge=0, le=100)


class ComplianceReadinessOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    certifications_count: int
    has_active_certification: bool
    compliance_score: int = Field(ge=0, le=100)


class ScenarioReadinessOut(BaseModel):
    """Whether the business is in a state where
    simulating changes is meaningful. The block
    summarises the active recommendation / roadmap
    counts so the UI can show "X items remaining"
    chips."""

    model_config = ConfigDict(extra="forbid")

    active_recommendations: int
    remaining_roadmap_items: int
    simulation_ready: bool


# --------------------------------------------------------------------------- #
# Timeline
# --------------------------------------------------------------------------- #


class TimelineProjectionOut(BaseModel):
    """One projection slice — current, 3-month, 6-
    month, or 12-month. The same shape for every
    slice; the UI renders them as columns."""

    model_config = ConfigDict(extra="forbid")

    label: Literal["current", "3m", "6m", "12m"]
    months_from_now: int = Field(ge=0, le=12)
    projected_overall_score: int = Field(ge=0, le=100)
    projected_digital_score: int = Field(ge=0, le=100)
    projected_export_score: int = Field(ge=0, le=100)
    projected_compliance_score: int = Field(ge=0, le=100)
    projected_growth_score: int = Field(ge=0, le=100)
    roadmap_completion_pct: int = Field(ge=0, le=100)
    items_completed: int
    items_remaining: int
    notes: str


class TimelineOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current: TimelineProjectionOut
    three_month: TimelineProjectionOut
    six_month: TimelineProjectionOut
    twelve_month: TimelineProjectionOut


# --------------------------------------------------------------------------- #
# Risk matrix
# --------------------------------------------------------------------------- #


class RiskEntryOut(BaseModel):
    """One risk in the matrix. Always references the
    originating Rule ID."""

    model_config = ConfigDict(extra="forbid")

    risk_id: str
    rule_id: str
    title: str
    description: str
    priority: Literal["Critical", "High", "Medium", "Low"]
    category: str
    estimated_impact: int = Field(ge=0, le=100)


class RiskMatrixOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    critical_risks: list[RiskEntryOut]
    high_risks: list[RiskEntryOut]
    medium_risks: list[RiskEntryOut]
    resolved_risks: list[RiskEntryOut]
    emerging_risks: list[RiskEntryOut]


# --------------------------------------------------------------------------- #
# Opportunity matrix
# --------------------------------------------------------------------------- #


class OpportunityEntryOut(BaseModel):
    """One opportunity. Always references the
    originating recommendation + roadmap item."""

    model_config = ConfigDict(extra="forbid")

    opportunity_id: str
    recommendation_id: str
    roadmap_item: str  # the recommendation_id of the matching roadmap item
    title: str
    description: str
    category: str
    priority: Literal["Critical", "High", "Medium", "Low"]
    phase: str
    estimated_score_gain: float
    estimated_roi: int = Field(ge=0, le=100)
    estimated_timeline: str


class OpportunityMatrixOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quick_wins: list[OpportunityEntryOut]
    strategic_investments: list[OpportunityEntryOut]
    long_term_growth: list[OpportunityEntryOut]
    export_opportunities: list[OpportunityEntryOut]
    digital_opportunities: list[OpportunityEntryOut]
    funding_opportunities: list[OpportunityEntryOut]


# --------------------------------------------------------------------------- #
# Health summary (10 readiness scores, all 0-100)
# --------------------------------------------------------------------------- #


class HealthSummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_health: int = Field(ge=0, le=100)
    business_maturity: int = Field(ge=0, le=100)
    digital_maturity: int = Field(ge=0, le=100)
    operational_maturity: int = Field(ge=0, le=100)
    market_readiness: int = Field(ge=0, le=100)
    investment_readiness: int = Field(ge=0, le=100)
    export_readiness: int = Field(ge=0, le=100)
    compliance_readiness: int = Field(ge=0, le=100)
    growth_readiness: int = Field(ge=0, le=100)
    innovation_readiness: int = Field(ge=0, le=100)
    sustainability_readiness: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class BusinessDigitalTwinResponse(BaseModel):
    """Returned by ``GET /api/v1/business/twin``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    last_analysis_at: str

    # ---- Identity / profile ----
    identity: BusinessIdentityOut
    profile: BusinessProfileSummaryOut

    # ---- Engines ----
    dna: BusinessDnaOut
    scores: BusinessScoresOut
    intelligence: IntelligenceOut
    rules: RulesOut
    recommendations: RecommendationsOut
    roadmap: RoadmapOut

    # ---- Current state + readiness ----
    current_health: CurrentHealthOut
    risk_overview: RiskOverviewOut
    growth_potential: GrowthPotentialOut
    digital_maturity: DigitalMaturityOut
    export_readiness: ExportReadinessOut
    compliance_readiness: ComplianceReadinessOut
    scenario_readiness: ScenarioReadinessOut

    # ---- Spec blocks ----
    timeline: TimelineOut
    risk_matrix: RiskMatrixOut
    opportunity_matrix: OpportunityMatrixOut
    health_summary: HealthSummaryOut

    # ---- Top-level ----
    overall_twin_health: int = Field(ge=0, le=100)

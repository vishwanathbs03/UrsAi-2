"""Pydantic schemas for Aggregate Advisor API — Sprint 15.1."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.compliance import ComplianceReport
from app.schemas.funding import FundingReport
from app.schemas.growth import GrowthAdvisorReport
from app.schemas.recommendation import RecommendationReport
from app.schemas.risk import RiskReport


class SwotAnalysisData(BaseModel):
    """SWOT Analysis structure."""

    model_config = ConfigDict(extra="forbid")

    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    threats: list[str] = Field(default_factory=list)


class RiskAssessmentData(BaseModel):
    """Risk Assessment categorized by severity."""

    model_config = ConfigDict(extra="forbid")

    low_risks: list[str] = Field(default_factory=list)
    medium_risks: list[str] = Field(default_factory=list)
    high_risks: list[str] = Field(default_factory=list)


class AdvisorAggregateReport(BaseModel):
    """Aggregated Advisor Report envelope combining all 8 Sprint 15 advisor sections."""

    model_config = ConfigDict(extra="forbid")

    executive_summary: str
    overall_advisor_score: int = Field(..., ge=0, le=100)
    business_maturity_level: str
    advisor_confidence: int = Field(..., ge=0, le=100)
    swot_analysis: SwotAnalysisData
    risk_assessment: RiskAssessmentData
    growth_opportunities: list[str] = Field(default_factory=list)
    recommended_next_actions: list[str] = Field(default_factory=list)
    priority_tasks: list[str] = Field(default_factory=list)
    recommendations: RecommendationReport
    risks: RiskReport
    growth: GrowthAdvisorReport
    funding: FundingReport
    compliance: ComplianceReport


class AdvisorAggregateResponse(BaseModel):
    """Response envelope for GET /api/v1/advisor."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: AdvisorAggregateReport

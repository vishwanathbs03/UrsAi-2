"""Pydantic schemas for Insights API — Sprint 16."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class IndustryComparisonData(BaseModel):
    """Industry benchmark comparison metrics."""

    model_config = ConfigDict(extra="forbid")

    industry_name: str
    percentile_rank: int = Field(..., ge=0, le=100)
    health_vs_industry_avg: str
    revenue_growth_percentile: int = Field(..., ge=0, le=100)


class BusinessInsightsData(BaseModel):
    """Business Insights payload."""

    model_config = ConfigDict(extra="forbid")

    key_findings: list[str] = Field(default_factory=list)
    positive_observations: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    industry_comparison: IndustryComparisonData
    improvement_suggestions: list[str] = Field(default_factory=list)


class BusinessInsightsResponse(BaseModel):
    """Response envelope for GET /api/v1/insights."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    insights: BusinessInsightsData

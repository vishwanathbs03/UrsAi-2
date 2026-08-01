"""Pydantic schemas for /api/v1/analytics endpoint — Sprint 13.1."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TrendPoint(BaseModel):
    """Trend data point."""

    model_config = ConfigDict(extra="forbid")

    label: str
    value: float


class AnalyticsOverviewInfo(BaseModel):
    """Overview section."""

    model_config = ConfigDict(extra="forbid")

    business_name: str
    industry: str
    profile_completion: int = Field(..., ge=0, le=100)
    health_score: int = Field(..., ge=0, le=100)
    employee_count: int = Field(..., ge=0)
    years_in_business: int = Field(..., ge=0)


class BusinessMetrics(BaseModel):
    """Business metrics section."""

    model_config = ConfigDict(extra="forbid")

    growth_score: int = Field(..., ge=0, le=100)
    digital_readiness: int = Field(..., ge=0, le=100)
    operational_maturity: int = Field(..., ge=0, le=100)
    market_presence: int = Field(..., ge=0, le=100)
    customer_reach: int = Field(..., ge=0, le=100)


class AnalyticsTrends(BaseModel):
    """Trend analysis section."""

    model_config = ConfigDict(extra="forbid")

    monthly_trend: list[TrendPoint]
    yearly_trend: list[TrendPoint]


class AnalyticsOverviewData(BaseModel):
    """Full analytics payload for GET /api/v1/analytics."""

    model_config = ConfigDict(extra="forbid")

    overview: AnalyticsOverviewInfo
    metrics: BusinessMetrics
    trends: AnalyticsTrends
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class AnalyticsOverviewResponse(BaseModel):
    """Response envelope for GET /api/v1/analytics."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    analytics: AnalyticsOverviewData

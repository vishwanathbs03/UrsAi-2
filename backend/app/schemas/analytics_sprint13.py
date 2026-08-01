"""Pydantic schemas for Sprint 13 Analytics API."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class MonthlyGrowthItem(BaseModel):
    """Monthly growth entry."""

    model_config = ConfigDict(extra="forbid")

    month: str
    revenue: float
    growth_rate: float


class HealthHistoryItem(BaseModel):
    """Historical health score entry."""

    model_config = ConfigDict(extra="forbid")

    month: str
    score: int


class BusinessAnalyticsData(BaseModel):
    """Business Analytics payload."""

    model_config = ConfigDict(extra="forbid")

    profile_completion: int = Field(..., ge=0, le=100)
    health_score: int = Field(..., ge=0, le=100)
    employee_distribution: dict[str, int]
    products_count: int = Field(..., ge=0)
    services_count: int = Field(..., ge=0)
    locations_count: int = Field(..., ge=0)
    years_in_business: int = Field(..., ge=0)
    industry: str
    business_age_category: str
    monthly_growth: list[MonthlyGrowthItem]
    health_history: list[HealthHistoryItem]


class BusinessAnalyticsResponse(BaseModel):
    """Response envelope for GET /api/v1/business/analytics."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    analytics: BusinessAnalyticsData

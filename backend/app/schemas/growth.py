"""Pydantic schemas for the Growth Advisor Engine (Sprint 12.4)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class GrowthAdviceItem(BaseModel):
    """Single actionable growth advice item."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique growth advice ID")
    title: str = Field(..., description="Short growth title")
    advice: str = Field(..., description="Detailed growth guidance and strategy")
    category: str = Field(..., description="Category: sales, marketing, operations, digital, hiring, products")
    priority: str = Field(..., description="Priority: Critical, High, Medium, Low")
    timeline: str = Field(..., description="Execution timeline e.g. 1-3 months, 3-6 months")
    expected_impact: str = Field(..., description="Quantifiable expected impact")


class GrowthAdvisorReport(BaseModel):
    """Growth advisor report envelope."""

    model_config = ConfigDict(extra="forbid")

    growth_stage: str = Field(..., description="Stage classification e.g. Early Stage, Scaling, Established")
    total_advice_count: int = Field(..., ge=0)
    recommendations: list[GrowthAdviceItem] = Field(default_factory=list)


class GrowthAdvisorResponse(BaseModel):
    """Response envelope for GET /api/v1/business/growth."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: GrowthAdvisorReport

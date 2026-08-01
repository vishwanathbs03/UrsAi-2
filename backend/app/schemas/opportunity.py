"""Pydantic schemas for the Opportunity Detector Engine (Sprint 11.4)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class OpportunityItem(BaseModel):
    """Detected business opportunity item."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique opportunity identifier")
    title: str = Field(..., description="Short title of the opportunity")
    description: str = Field(..., description="Detailed explanation and action step")
    priority: str = Field(..., description="Priority: Critical, High, Medium, Low")
    impact: str = Field(..., description="Impact level: High, Medium, Low")
    difficulty: str = Field(..., description="Execution difficulty: Easy, Medium, Hard")
    estimated_value: float = Field(..., description="Estimated monetary value or ROI (USD)")
    category: str = Field(..., description="Category: export, digital, compliance, operations, financial")


class OpportunityReport(BaseModel):
    """Opportunity detector report envelope."""

    model_config = ConfigDict(extra="forbid")

    total_count: int = Field(..., ge=0)
    total_estimated_value: float = Field(..., ge=0)
    opportunities: list[OpportunityItem] = Field(default_factory=list)


class OpportunityResponse(BaseModel):
    """Response envelope for GET /api/v1/business/opportunities."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: OpportunityReport

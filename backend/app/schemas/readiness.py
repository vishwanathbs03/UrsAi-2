"""Pydantic schemas for the Business Readiness Engine (Sprint 11.3)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ReadinessDimensionItem(BaseModel):
    """Breakdown item for a single readiness dimension."""

    model_config = ConfigDict(extra="forbid")

    dimension: str = Field(..., description="Dimension name: Digital, Operations, Finance, Market, Compliance, Growth")
    score: int = Field(..., ge=0, le=100, description="Dimension readiness score (0-100)")
    level: str = Field(..., description="Level: Low, Medium, High, Advanced")
    details: str = Field(..., description="Summary explanation of the dimension score")


class ReadinessReport(BaseModel):
    """Readiness scoring report envelope."""

    model_config = ConfigDict(extra="forbid")

    overall_score: int = Field(..., ge=0, le=100, description="Composite readiness score (0-100)")
    grade: str = Field(..., description="Letter grade: A, B, C, D, E, F")
    breakdown: list[ReadinessDimensionItem] = Field(default_factory=list)


class ReadinessResponse(BaseModel):
    """Response envelope for GET /api/v1/business/readiness."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    readiness: ReadinessReport

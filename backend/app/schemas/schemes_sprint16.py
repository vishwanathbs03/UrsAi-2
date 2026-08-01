"""Pydantic schemas for Sprint 16 Government Schemes Engine."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SchemeItem(BaseModel):
    """A government scheme recommendation item."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str
    category: str
    eligibility_status: str = Field(..., description="eligible, partiallyEligible, notEligible")
    eligibility_reason: str
    matching_score: int = Field(..., ge=0, le=100)
    priority: str = Field(..., description="High, Medium, Low")
    benefits: list[str] = Field(default_factory=list)
    documents_required: list[str] = Field(default_factory=list)
    application_steps: list[str] = Field(default_factory=list)
    application_link: str
    target_industries: list[str] = Field(default_factory=list)
    max_turnover: float | None = None
    min_turnover: float | None = None


class CategorizedSchemes(BaseModel):
    """Categorized government scheme lists."""

    model_config = ConfigDict(extra="forbid")

    recommended: list[SchemeItem] = Field(default_factory=list)
    eligible: list[SchemeItem] = Field(default_factory=list)
    partially_eligible: list[SchemeItem] = Field(default_factory=list)
    not_eligible: list[SchemeItem] = Field(default_factory=list)


class BusinessSchemesResponse(BaseModel):
    """Response envelope for GET /api/v1/business/schemes."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    total_schemes: int
    schemes: CategorizedSchemes

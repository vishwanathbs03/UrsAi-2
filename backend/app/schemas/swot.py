"""Pydantic schemas for the SWOT Engine (Sprint 11.2)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SWOTItem(BaseModel):
    """Single item in SWOT category."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., description="Short title of the SWOT factor")
    description: str = Field(..., description="Detailed explanation of the factor")
    impact: str = Field(default="medium", description="Impact level: high, medium, low")
    category: str = Field(default="general", description="Category e.g. financial, digital, export, team, compliance")


class SWOTReport(BaseModel):
    """SWOT report containing strengths, weaknesses, opportunities, and threats."""

    model_config = ConfigDict(extra="forbid")

    strengths: list[SWOTItem] = Field(default_factory=list)
    weaknesses: list[SWOTItem] = Field(default_factory=list)
    opportunities: list[SWOTItem] = Field(default_factory=list)
    threats: list[SWOTItem] = Field(default_factory=list)


class SWOTResponse(BaseModel):
    """Response envelope for GET /api/v1/business/swot."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    swot: SWOTReport

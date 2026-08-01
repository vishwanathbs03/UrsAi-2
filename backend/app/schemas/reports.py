"""Pydantic schemas for the Report Engine (Sprint 13)."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.dna import BusinessDNAData
from app.schemas.opportunity import OpportunityReport
from app.schemas.readiness import ReadinessReport
from app.schemas.recommendation import RecommendationReport
from app.schemas.swot import SWOTReport


class ExecutiveSummary(BaseModel):
    """Executive summary section of unified business report."""

    model_config = ConfigDict(extra="forbid")

    business_name: str
    industry: str
    overall_health_score: int
    health_grade: str
    health_status: str
    readiness_grade: str
    headline: str
    summary_text: str


class UnifiedReportModel(BaseModel):
    """Unified Business Report model combining all 8 Sprint 10 & 11 analytics engines."""

    model_config = ConfigDict(extra="forbid")

    executive_summary: ExecutiveSummary
    business_health: dict[str, Any]
    kpi_summary: dict[str, Any]
    swot: SWOTReport
    business_dna: BusinessDNAData
    readiness: ReadinessReport
    opportunities: OpportunityReport
    recommendations: RecommendationReport


class UnifiedReportResponse(BaseModel):
    """Response envelope for GET /api/v1/reports/unified."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: UnifiedReportModel

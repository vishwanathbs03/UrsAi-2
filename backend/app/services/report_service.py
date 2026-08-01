"""Report Engine Service — Sprint 13.1.

Generates a unified business report consolidating:
  * Executive Summary
  * Business Health
  * KPI Summary
  * SWOT Analysis
  * Business DNA
  * Business Readiness
  * Opportunities
  * Recommendations

Pure rule-based aggregation over existing domain services.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.reports import (
    ExecutiveSummary,
    UnifiedReportModel,
    UnifiedReportResponse,
)
from app.services.business_dna_service import BusinessDNAService
from app.services.health_score_service import HealthScoreService
from app.services.kpi_service import KpiService
from app.services.opportunity_service import OpportunityService
from app.services.readiness_service import ReadinessService
from app.services.recommendation_service import RecommendationService
from app.services.swot_service import SwotService


class ReportService:
    """Service layer for unified Business Report Engine (Sprint 13.1)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._dna_service = BusinessDNAService(repo)
        self._swot_service = SwotService(repo)
        self._readiness_service = ReadinessService(repo)
        self._opp_service = OpportunityService(repo)
        self._rec_service = RecommendationService(repo)

    def generate_unified_report(self, business: Business) -> UnifiedReportModel:
        """Generate unified business report model for a business instance."""
        health = HealthScoreService.compute(business)
        kpis = KpiService.compute(business)
        swot = self._swot_service.analyze_swot(business)
        dna = self._dna_service.analyze_dna(business)
        readiness = self._readiness_service.analyze_readiness(business)
        opps = self._opp_service.detect_opportunities(business)
        recs = self._rec_service.generate_recommendations(business)

        exec_summary = ExecutiveSummary(
            business_name=business.legal_name or "Business Profile",
            industry=business.industry or "General MSME",
            overall_health_score=health.score,
            health_grade=health.grade,
            health_status=health.status,
            readiness_grade=readiness.grade,
            headline=f"Executive Performance Brief for {business.legal_name}",
            summary_text=(
                f"{business.legal_name} operates in the {business.industry or 'N/A'} sector with an overall "
                f"Health Score of {health.score}/100 (Grade {health.grade}, Status: {health.status}) and a "
                f"Readiness Score of {readiness.overall_score}/100 (Grade {readiness.grade}). "
                f"The business DNA is evaluated as {dna.business_stage} with {dna.digital_maturity} digital maturity."
            ),
        )

        return UnifiedReportModel(
            executive_summary=exec_summary,
            business_health=health.model_dump(),
            kpi_summary=kpis.model_dump(),
            swot=swot,
            business_dna=dna,
            readiness=readiness,
            opportunities=opps,
            recommendations=recs,
        )

    def compute(self, owner_id: int) -> UnifiedReportResponse:
        """Compute unified report response envelope for given owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.generate_unified_report(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return UnifiedReportResponse(generated_at=now_iso, report=report)

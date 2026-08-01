"""Dashboard service — Sprint 10 Task 10.2.

Assembles the dashboard response for the authenticated user by fetching
the user's business profile via BusinessRepository and returning
KPI, health score, AI summary, recent activity, and quick action placeholders.
"""

from __future__ import annotations

from typing import Any

from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.business import BusinessSummary
from app.schemas.dashboard import DashboardResponse
from app.services.health_score_service import HealthScoreService
from app.services.kpi_service import KpiService


class DashboardService:
    """Service layer for assembling dashboard data."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    def get_dashboard(self, owner_id: int) -> DashboardResponse:
        """Fetch dashboard metrics for the given owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile for this user yet.")

        summary = BusinessSummary.model_validate(business)
        computed_kpis = KpiService.compute(business)
        kpis = computed_kpis.model_dump()

        health_report = HealthScoreService.compute(business)
        health = health_report.score
        ai_summary_text = (
            f"{business.legal_name} operates in {business.industry} with "
            f"{business.employee_count} employees. Digital twin analytics indicate stable growth metrics."
        )

        return DashboardResponse(
            business=summary,
            kpis=kpis,
            health_score=health,
            healthScore=health,
            ai_summary=ai_summary_text,
            aiSummary=ai_summary_text,
            recent_activity=[],
            recentActivity=[],
            quick_actions=[],
            quickActions=[],
        )

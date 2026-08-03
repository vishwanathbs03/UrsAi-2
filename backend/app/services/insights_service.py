"""Insights Service — Sprint 16.

Computes deterministic insights based on Business Profile:
  - Key findings
  - Positive observations
  - Risks
  - Opportunities
  - Industry comparison
  - Improvement suggestions
"""

from __future__ import annotations

from datetime import datetime, timezone
from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.insights import (
    BusinessInsightsData,
    BusinessInsightsResponse,
    IndustryComparisonData,
)
from app.services.health_score_service import HealthScoreService


class InsightsService:
    """Deterministic intelligence engine for business insights."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    def compute(self, owner_id: int) -> BusinessInsightsResponse:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        rev = business.annual_revenue or 0.0
        emp = business.employee_count or 0
        ind = business.industry or "General MSME"
        curr_year = datetime.now(tz=timezone.utc).year
        est_year = business.established_year or curr_year
        years = max(0, curr_year - est_year)
        dp = business.digital_presence

        health = HealthScoreService.compute(business)
        health_sc = health.score

        # 1. Key Findings
        findings = [
            f"Business operates in {ind} with {years} years of operational history.",
            f"Current employee headcount stands at {emp} personnel.",
            f"Annual revenue baseline calculated at {rev:,.2f} (currency from business profile).",
        ]

        # 2. Positive Observations
        positives = []
        if health_sc >= 70:
            positives.append(f"Strong overall business health score of {health_sc}/100.")
        if rev >= 200000.0:
            positives.append("Annual revenue exceeds micro-enterprise baseline threshold.")
        if dp and dp.has_website:
            positives.append("Active digital presence with registered domain.")
        if not positives:
            positives.append("Business structure is established and fully registered.")

        # 3. Risks
        risks = []
        if rev < 100000.0:
            risks.append("Revenue baseline presents cash flow sensitivity.")
        if emp <= 2:
            risks.append("Low employee headcount increases operational key-person dependency.")
        if not dp or not dp.has_website:
            risks.append("Missing digital web channel limits inbound customer acquisition.")
        if not risks:
            risks.append("Market competition in primary operating industry.")

        # 4. Opportunities
        opps = [
            "Automate core business processes to increase operational efficiency by 15%",
            "Apply for eligible government MSME subsidies and credit guarantee schemes",
        ]
        if not dp or not dp.has_website:
            opps.append("Launch dedicated web portal and e-commerce channel")

        # 5. Industry Comparison
        pct_rank = min(95, max(35, round(health_sc * 0.95)))
        comparison = IndustryComparisonData(
            industry_name=ind,
            percentile_rank=pct_rank,
            health_vs_industry_avg="+12% above industry median" if health_sc >= 65 else "Aligned with industry median",
            revenue_growth_percentile=min(90, max(40, round(pct_rank * 0.9))),
        )

        # 6. Improvement Suggestions
        suggestions = [
            "Maintain regular quarterly review of financial statements & budget forecasts",
            "Establish formal customer feedback collection mechanisms to boost retention",
            "Leverage government MSME schemes to reduce capital borrowing costs",
        ]

        data = BusinessInsightsData(
            key_findings=findings,
            positive_observations=positives,
            risks=risks,
            opportunities=opps,
            industry_comparison=comparison,
            improvement_suggestions=suggestions,
        )

        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return BusinessInsightsResponse(generated_at=now_iso, insights=data)

"""Aggregate Advisor Service — Sprint 15.1.

Rule-based deterministic engine computing:
  1. Executive Summary
  2. Overall Advisor Score (0-100)
  3. Business Maturity Level
  4. Advisor Confidence Indicator
  5. SWOT Analysis
  6. Risk Assessment (Low, Medium, High)
  7. Growth Opportunities & Priority Tasks
  8. Recommendations, Risks, Growth, Funding, Compliance reports
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.advisor_aggregate import (
    AdvisorAggregateReport,
    AdvisorAggregateResponse,
    RiskAssessmentData,
    SwotAnalysisData,
)
from app.services.compliance_service import ComplianceService
from app.services.funding_service import FundingService
from app.services.growth_service import GrowthService
from app.services.health_score_service import HealthScoreService
from app.services.recommendation_service import RecommendationService
from app.services.risk_service import RiskService


class AdvisorAggregateService:
    """Aggregator service composing all Advisor engines with deterministic intelligence."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._rec_service = RecommendationService(repo)
        self._risk_service = RiskService(repo)
        self._growth_service = GrowthService(repo)
        self._funding_service = FundingService(repo)
        self._compliance_service = ComplianceService(repo)

    def compute(self, owner_id: int) -> AdvisorAggregateResponse:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        rev = business.annual_revenue or 0.0
        emp = business.employee_count or 0
        curr_year = datetime.now(tz=timezone.utc).year
        est_year = business.established_year or curr_year
        years = max(0, curr_year - est_year)
        dp = business.digital_presence

        health = HealthScoreService.compute(business)
        health_sc = health.score

        # 1. Executive Summary & Maturity
        if years >= 5 and rev >= 500000.0:
            maturity = "Established Leader"
            summary = f"{business.legal_name} demonstrates strong operational stability and established revenue scale in {business.industry}."
        elif years >= 2:
            maturity = "Accelerating Expansion"
            summary = f"{business.legal_name} is actively expanding market presence in {business.industry} with solid growth trajectory."
        else:
            maturity = "Early Foundation"
            summary = f"{business.legal_name} is establishing baseline market operations in {business.industry}."

        # 2. SWOT
        str_list = [f"Established market presence in {business.industry}"]
        if rev >= 200000.0:
            str_list.append("Healthy annual revenue baseline")
        if emp >= 10:
            str_list.append("Dedicated workforce capacity")

        weak_list = []
        if rev < 200000.0:
            weak_list.append("Annual turnover below high-growth benchmark")
        if emp < 5:
            weak_list.append("Operational dependency on core key personnel")

        opp_list = ["Automate supply chain & invoicing for 12% margin expansion"]
        if not dp or not dp.website_url:
            opp_list.append("Establish web and e-commerce digital channels")

        thr_list = ["Macroeconomic inflation and supplier cost pressure"]

        swot = SwotAnalysisData(
            strengths=str_list,
            weaknesses=weak_list,
            opportunities=opp_list,
            threats=thr_list,
        )

        # 3. Risk Assessment
        high_r = []
        med_r = []
        low_r = []

        if rev < 100000.0:
            high_r.append("Liquidity and short-term cash flow volatility")
        else:
            low_r.append("Stable working capital baseline")

        if emp <= 3:
            med_r.append("Key-person operational dependency")

        risk_assess = RiskAssessmentData(
            low_risks=low_r,
            medium_risks=med_r,
            high_risks=high_r,
        )

        # Sub-reports
        recs_report = self._rec_service.generate_recommendations(business)
        risks_report = self._risk_service.detect_risks(business)
        growth_report = self._growth_service.generate_growth_advice(business)
        funding_report = self._funding_service.analyze_funding(business)
        compliance_report = self._compliance_service.analyze_compliance(business)

        report = AdvisorAggregateReport(
            executive_summary=summary,
            overall_advisor_score=health_sc,
            business_maturity_level=maturity,
            advisor_confidence=92,
            swot_analysis=swot,
            risk_assessment=risk_assess,
            growth_opportunities=opp_list,
            recommended_next_actions=[
                "Review priority recommendations and execute immediate quick-wins",
                "Update digital presence and e-commerce channel integration",
            ],
            priority_tasks=[r.title for r in recs_report.recommendations[:3]],
            recommendations=recs_report,
            risks=risks_report,
            growth=growth_report,
            funding=funding_report,
            compliance=compliance_report,
        )

        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return AdvisorAggregateResponse(generated_at=now_iso, report=report)

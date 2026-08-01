"""Business Readiness Engine — Sprint 11.3.

Computes readiness scores (0-100) across six operational dimensions:
  1. Digital
  2. Operations
  3. Finance
  4. Market
  5. Compliance
  6. Growth

Returns:
  * overall_score (0-100)
  * grade ("A", "B", "C", "D", "E", "F")
  * breakdown[] list of dimension items
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.readiness import (
    ReadinessDimensionItem,
    ReadinessReport,
    ReadinessResponse,
)
from app.services.business_service import BusinessService


class ReadinessService:
    """Service layer for deterministic Business Readiness scoring (Sprint 11.3)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def analyze_readiness(business: Business) -> ReadinessReport:
        """Analyze business profile and return deterministic ReadinessReport."""
        dp = business.digital_presence
        emp = business.employee_count or 0
        prods = len(business.products) if business.products else 0
        exports = len(business.export_history) if business.export_history else 0
        certs = len(business.certifications) if business.certifications else 0
        rev = business.annual_revenue or 0.0

        # 1. Digital Readiness (0-100)
        digital_pts = 0
        if dp:
            if dp.website_url and dp.website_url.strip():
                digital_pts += 25
            if dp.linkedin_url and dp.linkedin_url.strip():
                digital_pts += 15
            if dp.has_ecommerce:
                digital_pts += 25
            if dp.uses_digital_marketing:
                digital_pts += 15
            if dp.uses_cloud_systems:
                digital_pts += 20
        digital_score = min(100, digital_pts)
        digital_level = (
            "Advanced"
            if digital_score >= 80
            else ("High" if digital_score >= 60 else ("Medium" if digital_score >= 30 else "Low"))
        )

        # 2. Operations Readiness (0-100)
        ops_pts = 0
        if emp > 0:
            ops_pts += 30 if emp >= 10 else 15
        if business.production_capacity and business.production_capacity.strip():
            ops_pts += 25
        if business.capacity_utilization_pct and business.capacity_utilization_pct > 0:
            ops_pts += 25
        if prods > 0:
            ops_pts += 20
        ops_score = min(100, ops_pts)
        ops_level = (
            "Advanced"
            if ops_score >= 80
            else ("High" if ops_score >= 60 else ("Medium" if ops_score >= 30 else "Low"))
        )

        # 3. Finance Readiness (0-100)
        fin_pts = 0
        if rev > 0:
            fin_pts += 50
            if rev >= 250000:
                fin_pts += 30
            elif rev >= 50000:
                fin_pts += 15
        if business.revenue_currency and business.revenue_currency.strip():
            fin_pts += 20
        fin_score = min(100, fin_pts)
        fin_level = (
            "Advanced"
            if fin_score >= 80
            else ("High" if fin_score >= 60 else ("Medium" if fin_score >= 30 else "Low"))
        )

        # 4. Market Readiness (0-100)
        mkt_pts = 0
        if business.country and business.country.strip():
            mkt_pts += 25
        if business.city or business.state_region:
            mkt_pts += 25
        if exports > 0:
            mkt_pts += 50
        else:
            mkt_pts += 15
        mkt_score = min(100, mkt_pts)
        mkt_level = (
            "Advanced"
            if mkt_score >= 80
            else ("High" if mkt_score >= 60 else ("Medium" if mkt_score >= 30 else "Low"))
        )

        # 5. Compliance Readiness (0-100)
        comp_pts = 0
        if certs > 0:
            comp_pts += 60 if certs >= 2 else 40
        if business.legal_name and business.business_type:
            comp_pts += 40
        else:
            comp_pts += 20
        comp_score = min(100, comp_pts)
        comp_level = (
            "Advanced"
            if comp_score >= 80
            else ("High" if comp_score >= 60 else ("Medium" if comp_score >= 30 else "Low"))
        )

        # 6. Growth Readiness (0-100)
        try:
            profile_score = BusinessService._compute_completeness(business).score
        except Exception:
            profile_score = 50

        growth_pts = round(0.5 * profile_score)
        if business.goals and len(business.goals) > 0:
            growth_pts += 30
        if exports > 0 or (dp and dp.has_ecommerce):
            growth_pts += 20
        growth_score = min(100, growth_pts)
        growth_level = (
            "Advanced"
            if growth_score >= 80
            else ("High" if growth_score >= 60 else ("Medium" if growth_score >= 30 else "Low"))
        )

        # Overall Readiness Score
        scores = [digital_score, ops_score, fin_score, mkt_score, comp_score, growth_score]
        overall = round(sum(scores) / len(scores))

        if overall >= 90:
            grade = "A"
        elif overall >= 80:
            grade = "B"
        elif overall >= 70:
            grade = "C"
        elif overall >= 60:
            grade = "D"
        elif overall >= 50:
            grade = "E"
        else:
            grade = "F"

        breakdown = [
            ReadinessDimensionItem(
                dimension="Digital",
                score=digital_score,
                level=digital_level,
                details=f"Digital adoption readiness score is {digital_score}/100.",
            ),
            ReadinessDimensionItem(
                dimension="Operations",
                score=ops_score,
                level=ops_level,
                details=f"Operational capacity readiness score is {ops_score}/100.",
            ),
            ReadinessDimensionItem(
                dimension="Finance",
                score=fin_score,
                level=fin_level,
                details=f"Financial baseline readiness score is {fin_score}/100.",
            ),
            ReadinessDimensionItem(
                dimension="Market",
                score=mkt_score,
                level=mkt_level,
                details=f"Market positioning readiness score is {mkt_score}/100.",
            ),
            ReadinessDimensionItem(
                dimension="Compliance",
                score=comp_score,
                level=comp_level,
                details=f"Compliance & certification readiness score is {comp_score}/100.",
            ),
            ReadinessDimensionItem(
                dimension="Growth",
                score=growth_score,
                level=growth_level,
                details=f"Growth readiness score is {growth_score}/100.",
            ),
        ]

        return ReadinessReport(
            overall_score=overall,
            grade=grade,
            breakdown=breakdown,
        )

    def compute(self, owner_id: int) -> ReadinessResponse:
        """Compute readiness response envelope for given owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.analyze_readiness(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return ReadinessResponse(generated_at=now_iso, readiness=report)

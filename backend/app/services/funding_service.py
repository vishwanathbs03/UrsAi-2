"""Funding Advisor Engine — Sprint 12.5.

Rule-based engine evaluating business profile funding readiness:
  * Loan readiness score (0-100)
  * Investor readiness score (0-100)
  * Grant eligibility score (0-100)
  * Recommended MSME government schemes
  * Actionable funding checklist
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.funding import (
    FundingChecklistItem,
    FundingReport,
    FundingResponse,
)


class FundingService:
    """Service layer for deterministic Funding Advisor engine (Sprint 12.5)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def analyze_funding(business: Business) -> FundingReport:
        """Analyze business profile and generate funding readiness report."""
        rev = business.annual_revenue or 0.0
        emp = business.employee_count or 0
        certs = len(business.certifications) if business.certifications else 0
        exports = len(business.export_history) if business.export_history else 0
        current_year = datetime.now().year
        age = max(0, current_year - business.established_year) if (business.established_year and business.established_year > 0) else 0

        # 1. Loan Readiness Score
        loan_score = 40
        if age >= 2:
            loan_score += 20
        if rev >= 100000.0:
            loan_score += 20
        if certs > 0:
            loan_score += 20
        loan_score = min(100, max(0, loan_score))

        # 2. Investor Readiness Score
        investor_score = 30
        if emp >= 10:
            investor_score += 25
        if rev >= 250000.0:
            investor_score += 25
        if exports > 0:
            investor_score += 20
        investor_score = min(100, max(0, investor_score))

        # 3. Grant Eligibility Score
        grant_score = 50
        if age <= 5:
            grant_score += 20
        if business.industry in ["Technology", "Healthcare Technology", "Robotics", "Software & AI", "Manufacturing"]:
            grant_score += 20
        if certs > 0:
            grant_score += 10
        grant_score = min(100, max(0, grant_score))

        # 4. Applicable MSME Schemes
        schemes: list[str] = [
            "CGTMSE Collateral-Free Credit Guarantee",
            "PMEGP Credit Linked Subsidy Scheme",
        ]
        if exports > 0:
            schemes.append("International Market Access Support (MAI)")
        if certs > 0 or business.industry in ["Technology", "Robotics", "Software & AI"]:
            schemes.append("Technology Upgradation Capital Subsidy (CLCSS)")

        # 5. Funding Checklist
        checklist = [
            FundingChecklistItem(
                task="Audit 2 Years Financial Balance Sheets & P&L",
                completed=age >= 2 and rev > 0,
                category="Bank Loan",
            ),
            FundingChecklistItem(
                task="Obtain ISO / Quality Certification Credentials",
                completed=certs > 0,
                category="Govt Grant",
            ),
            FundingChecklistItem(
                task="Prepare 3-Year Pro-Forma Investor Pitch Deck",
                completed=rev >= 250000.0 and emp >= 10,
                category="Equity Investor",
            ),
            FundingChecklistItem(
                task="Register Udyam MSME Enterprise Certificate",
                completed=business.legal_name is not None and len(business.legal_name.strip()) > 0,
                category="Govt Grant",
            ),
            FundingChecklistItem(
                task="Establish Import Export Code (IEC) Registration",
                completed=exports > 0,
                category="Bank Loan",
            ),
        ]

        return FundingReport(
            loan_readiness_score=loan_score,
            investor_readiness_score=investor_score,
            grant_eligibility_score=grant_score,
            msme_schemes=schemes,
            funding_checklist=checklist,
        )

    def compute(self, owner_id: int) -> FundingResponse:
        """Compute funding advisor response envelope for owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.analyze_funding(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return FundingResponse(generated_at=now_iso, report=report)

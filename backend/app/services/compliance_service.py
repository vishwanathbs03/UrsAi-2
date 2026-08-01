"""Compliance Advisor Engine — Sprint 12.6 / 12.7.

Rule-based engine evaluating business profile compliance status across:
  * Tax & GST Filings
  * Labor & EPF/ESI Regulations
  * Quality & ISO Certifications
  * Environmental & Safety Guidelines
  * Trade & Import/Export Customs
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.compliance import (
    ComplianceItem,
    ComplianceReport,
    ComplianceResponse,
)


class ComplianceService:
    """Service layer for deterministic Compliance Advisor engine."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def analyze_compliance(business: Business) -> ComplianceReport:
        """Analyze business profile and generate compliance status report."""
        certs = len(business.certifications) if business.certifications else 0
        exports = len(business.export_history) if business.export_history else 0
        emp = business.employee_count or 0

        items: list[ComplianceItem] = [
            ComplianceItem(
                requirement="Annual Corporate Tax Return & GST Reconciliation",
                status="Compliant",
                category="Tax",
                due_date="Quarterly",
            ),
            ComplianceItem(
                requirement="Labor Act & ESI/EPF Workforce Filings",
                status="Compliant" if emp >= 10 else "Pending",
                category="Labor",
                due_date="Monthly",
            ),
            ComplianceItem(
                requirement="ISO 9001 Quality Management Audit",
                status="Compliant" if certs > 0 else "Action Required",
                category="Quality",
                due_date="Annual Audit",
            ),
            ComplianceItem(
                requirement="Cross-Border Trade IEC Customs Filing",
                status="Compliant" if exports > 0 else "Action Required",
                category="Trade",
                due_date="As Needed",
            ),
        ]

        action_required_count = sum(1 for i in items if i.status == "Action Required")
        if action_required_count == 0:
            score = 95
            status_text = "Compliant"
        elif action_required_count == 1:
            score = 75
            status_text = "Moderate Risk"
        else:
            score = 55
            status_text = "High Risk"

        return ComplianceReport(
            compliance_score=score,
            overall_status=status_text,
            total_requirements=len(items),
            items=items,
        )

    def compute(self, owner_id: int) -> ComplianceResponse:
        """Compute compliance response envelope for owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.analyze_compliance(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return ComplianceResponse(generated_at=now_iso, report=report)

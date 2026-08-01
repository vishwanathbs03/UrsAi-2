"""Risk Detection Engine — Sprint 12.3.

Rule-based engine that analyzes a Business profile to detect risks across 5 categories:
  1. Financial Risk
  2. Operational Risk
  3. Compliance Risk
  4. Digital Risk
  5. Growth Risk

Returns:
  * overall_risk_level ("High", "Medium", "Low")
  * total_risks_detected (int)
  * risks[] list of RiskItem objects (risk, category, severity, recommendation)
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.risk import RiskItem, RiskReport, RiskResponse


class RiskService:
    """Service layer for deterministic Risk Detection engine (Sprint 12.3)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def detect_risks(business: Business) -> RiskReport:
        """Analyze business profile and return deterministic RiskReport."""
        risks: list[RiskItem] = []

        rev = business.annual_revenue or 0.0
        emp = business.employee_count or 0
        certs = len(business.certifications) if business.certifications else 0
        exports = len(business.export_history) if business.export_history else 0
        dp = business.digital_presence
        utilization = business.capacity_utilization_pct or 0

        # 1. Financial Risk Detection
        if rev < 50000.0:
            risks.append(
                RiskItem(
                    risk="Low Annual Revenue Liquidity Buffer",
                    category="financial",
                    severity="High",
                    recommendation="Diversify buyer accounts and establish a cash credit line to buffer against short-term payment delays.",
                )
            )
        elif rev < 150000.0:
            risks.append(
                RiskItem(
                    risk="Moderate Revenue Margin Exposure",
                    category="financial",
                    severity="Medium",
                    recommendation="Implement strict invoice collection milestones and monitor customer credit terms.",
                )
            )

        # 2. Operational Risk Detection
        if emp <= 3:
            risks.append(
                RiskItem(
                    risk="Key Person Operational Dependency",
                    category="operational",
                    severity="High",
                    recommendation="Cross-train administrative staff and document standard operating procedure manuals.",
                )
            )

        if utilization >= 80:
            risks.append(
                RiskItem(
                    risk="Facility Over-Utilization & Capacity Strain",
                    category="operational",
                    severity="High",
                    recommendation="Expand shift schedules or modular machinery to prevent equipment downtime.",
                )
            )

        # 3. Compliance Risk Detection
        if certs == 0:
            risks.append(
                RiskItem(
                    risk="Lack of Industry & Quality Certifications",
                    category="compliance",
                    severity="Medium",
                    recommendation="Enroll in ISO 9001 quality management framework to satisfy enterprise vendor requirements.",
                )
            )

        # 4. Digital Risk Detection
        if not dp or not dp.website_url or not dp.website_url.strip():
            risks.append(
                RiskItem(
                    risk="Absence of Verified Web Presence",
                    category="digital",
                    severity="High",
                    recommendation="Register a business domain and establish an official company website.",
                )
            )

        if not dp or not dp.uses_cloud_systems:
            risks.append(
                RiskItem(
                    risk="Manual Accounting & Inventory Workflow Bottlenecks",
                    category="digital",
                    severity="Medium",
                    recommendation="Migrate spreadsheet ledger and stock tracking onto cloud ERP software.",
                )
            )

        # 5. Growth Risk Detection
        if exports == 0:
            risks.append(
                RiskItem(
                    risk="Domestic Market Revenue Dependence",
                    category="growth",
                    severity="Medium",
                    recommendation="Evaluate cross-border export channels to insulate business against local economic slowdowns.",
                )
            )

        # Fallback if no specific risks triggered
        if not risks:
            risks.append(
                RiskItem(
                    risk="Routine Operational Monitoring",
                    category="operational",
                    severity="Low",
                    recommendation="Perform quarterly operational reviews to maintain current performance standards.",
                )
            )

        # Compute Overall Risk Level
        critical_or_high_count = sum(1 for r in risks if r.severity in ["Critical", "High"])
        if critical_or_high_count >= 2:
            overall_level = "High"
        elif len(risks) >= 3 or critical_or_high_count == 1:
            overall_level = "Medium"
        else:
            overall_level = "Low"

        return RiskReport(
            overall_risk_level=overall_level,
            total_risks_detected=len(risks),
            risks=risks,
        )

    def compute(self, owner_id: int) -> RiskResponse:
        """Compute risk response envelope for owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.detect_risks(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return RiskResponse(generated_at=now_iso, report=report)

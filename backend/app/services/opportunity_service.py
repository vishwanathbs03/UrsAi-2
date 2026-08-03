"""Opportunity Detector Engine — Sprint 11.4.

Pure rule-based deterministic engine that analyzes a Business profile
and detects actionable growth, digital, export, and operational opportunities.

Each opportunity contains:
  * id
  * title
  * description
  * priority (Critical, High, Medium, Low)
  * impact (High, Medium, Low)
  * difficulty (Easy, Medium, Hard)
  * estimated_value (float, scenario estimate — currency = business's
    currency; treated as illustrative opportunity value, NOT
    expected revenue or guaranteed outcome)
  * category (export, digital, compliance, operations, financial)

P0.6 — fixed estimated_value floors are now explicitly labelled as
scenario estimates. They are NOT expected revenue or guaranteed
income. The frontend renders them as "Illustrative opportunity
value" / "Modelled potential".
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.opportunity import (
    OpportunityItem,
    OpportunityReport,
    OpportunityResponse,
)


class OpportunityService:
    """Service layer for deterministic Business Opportunity Detection (Sprint 11.4)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def detect_opportunities(business: Business) -> OpportunityReport:
        """Detect business opportunities using deterministic rules."""
        opps: list[OpportunityItem] = []
        rev = business.annual_revenue or 0.0
        exports = len(business.export_history) if business.export_history else 0
        certs = len(business.certifications) if business.certifications else 0
        dp = business.digital_presence
        utilization = business.capacity_utilization_pct or 0

        # Rule 1: Export Expansion
        if exports == 0:
            est_val = max(50000.0, round(0.25 * rev, 2)) if rev > 0 else 50000.0
            opps.append(
                OpportunityItem(
                    id="opp_export_expansion",
                    title="Cross-Border Export Market Expansion",
                    description=(
                        "Your business currently relies solely on local sales. Initiating exports to "
                        "neighboring international markets can unlock lucrative new revenue streams."
                    ),
                    priority="High",
                    impact="High",
                    difficulty="Medium",
                    estimated_value=est_val,
                    category="export",
                )
            )

        # Rule 2: E-Commerce Storefront Adoption
        if not dp or not dp.has_ecommerce:
            est_val = max(30000.0, round(0.15 * rev, 2)) if rev > 0 else 30000.0
            opps.append(
                OpportunityItem(
                    id="opp_ecommerce_storefront",
                    title="Launch Direct-to-Consumer E-Commerce Storefront",
                    description=(
                        "Deploying an automated online storefront enables direct digital customer orders "
                        "and expands your sales reach beyond physical territory."
                    ),
                    priority="High",
                    impact="High",
                    difficulty="Easy",
                    estimated_value=est_val,
                    category="digital",
                )
            )

        # Rule 3: Quality Certification Standard
        if certs == 0:
            opps.append(
                OpportunityItem(
                    id="opp_iso_certification",
                    title="Acquire ISO Quality & Safety Certifications",
                    description=(
                        "Obtaining ISO 9001 or industry-specific certifications qualifies your firm "
                        "for lucrative corporate vendor contracts and government procurement."
                    ),
                    priority="Medium",
                    impact="High",
                    difficulty="Medium",
                    estimated_value=40000.0,
                    category="compliance",
                )
            )

        # Rule 4: Cloud ERP & Workflow Systems
        if not dp or not dp.uses_cloud_systems:
            opps.append(
                OpportunityItem(
                    id="opp_cloud_automation",
                    title="Deploy Cloud ERP & Inventory Automation",
                    description=(
                        "Migrating manual operations to cloud ERP and automated inventory tracking "
                        "reduces overhead expenses and processing bottlenecks."
                    ),
                    priority="Medium",
                    impact="Medium",
                    difficulty="Easy",
                    estimated_value=25000.0,
                    category="operations",
                )
            )

        # Rule 5: Production Capacity Tuning
        if utilization >= 70 or (business.production_capacity and not utilization):
            opps.append(
                OpportunityItem(
                    id="opp_capacity_scaling",
                    title="Expand Modular Production Machinery & Shift Schedules",
                    description=(
                        f"Facility utilization is high ({utilization}%). Adding modular equipment or "
                        "staggered shifts will satisfy unmet market demand."
                    ),
                    priority="High",
                    impact="High",
                    difficulty="Hard",
                    estimated_value=75000.0,
                    category="operations",
                )
            )

        # Rule 6: Targeted Digital Marketing Campaign
        if not dp or not dp.uses_digital_marketing:
            opps.append(
                OpportunityItem(
                    id="opp_digital_marketing",
                    title="Launch Search & Social Digital Marketing Campaigns",
                    description=(
                        "Implementing targeted B2B/B2C digital marketing ads accelerates lead "
                        "generation and brand recognition."
                    ),
                    priority="Medium",
                    impact="Medium",
                    difficulty="Easy",
                    estimated_value=20000.0,
                    category="digital",
                )
            )

        # Fallback if profile is complete and no default opp triggered
        if not opps:
            opps.append(
                OpportunityItem(
                    id="opp_general_scale",
                    title="Strategic Strategic Alliances & JV Partnerships",
                    description="Form joint ventures and strategic alliances with regional distributors.",
                    priority="Low",
                    impact="Medium",
                    difficulty="Medium",
                    estimated_value=35000.0,
                    category="financial",
                )
            )

        total_value = sum(item.estimated_value for item in opps)
        return OpportunityReport(
            total_count=len(opps),
            total_estimated_value=round(total_value, 2),
            opportunities=opps,
        )

    def compute(self, owner_id: int) -> OpportunityResponse:
        """Compute opportunities response envelope for given owner_id.

        Raises BusinessNotFound (404) when user has no business profile.
        """
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.detect_opportunities(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return OpportunityResponse(generated_at=now_iso, report=report)

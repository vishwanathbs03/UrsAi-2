"""Growth Advisor Engine — Sprint 12.4.

Rule-based engine generating strategic growth advice across 6 core categories:
  1. Sales
  2. Marketing
  3. Operations
  4. Digital
  5. Hiring
  6. Products

Returns:
  * growth_stage ("Early Stage", "Scaling", "Established")
  * total_advice_count (int)
  * recommendations[] list of GrowthAdviceItem objects (id, title, advice, category, priority, timeline, expected_impact)
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.growth import (
    GrowthAdviceItem,
    GrowthAdvisorReport,
    GrowthAdvisorResponse,
)


class GrowthService:
    """Service layer for deterministic Growth Advisor engine (Sprint 12.4)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def generate_growth_advice(business: Business) -> GrowthAdvisorReport:
        """Analyze business profile and generate strategic growth advice across 6 categories."""
        recs: list[GrowthAdviceItem] = []

        rev = business.annual_revenue or 0.0
        emp = business.employee_count or 0
        exports = len(business.export_history) if business.export_history else 0
        dp = business.digital_presence
        current_year = datetime.now().year
        age = max(0, current_year - business.established_year) if (business.established_year and business.established_year > 0) else 0

        # Determine Growth Stage
        if age < 3 or emp <= 5:
            stage = "Early Stage"
        elif emp <= 25 or rev < 500000.0:
            stage = "Scaling"
        else:
            stage = "Established"

        # 1. Sales Advice
        if exports == 0:
            recs.append(
                GrowthAdviceItem(
                    id="growth_sales_export",
                    title="Cross-Border Sales & Export Pipeline Expansion",
                    advice="Initiate targeted outreach to regional international trade buyers and register on cross-border B2B marketplaces.",
                    category="sales",
                    priority="High",
                    timeline="1-3 months",
                    expected_impact="+30% International Revenue",
                )
            )
        else:
            recs.append(
                GrowthAdviceItem(
                    id="growth_sales_key_accounts",
                    title="Key Account Upsell & Volume Incentives",
                    advice="Structure tiered annual volume discounts and dedicated account manager check-ins for top 20% buyers.",
                    category="sales",
                    priority="High",
                    timeline="1-3 months",
                    expected_impact="+20% Account Retention & LTV",
                )
            )

        # 2. Marketing Advice
        if not dp or not dp.uses_digital_marketing:
            recs.append(
                GrowthAdviceItem(
                    id="growth_marketing_digital_ads",
                    title="Targeted Search & Social Customer Acquisition Campaigns",
                    advice="Launch focused Google Search and LinkedIn B2B lead generation ad campaigns targeting regional decision makers.",
                    category="marketing",
                    priority="High",
                    timeline="1-3 months",
                    expected_impact="2x Qualified Inbound Leads",
                )
            )
        else:
            recs.append(
                GrowthAdviceItem(
                    id="growth_marketing_content_case_studies",
                    title="Customer Case Studies & ROI Showcase",
                    advice="Publish video testimonials and downloadable PDF case studies detailing quantifiable client ROI.",
                    category="marketing",
                    priority="Medium",
                    timeline="3-6 months",
                    expected_impact="+15% Lead Conversion Rate",
                )
            )

        # 3. Operations Advice
        if not dp or not dp.uses_cloud_systems:
            recs.append(
                GrowthAdviceItem(
                    id="growth_ops_cloud_erp",
                    title="Cloud ERP & Order Automation Deployment",
                    advice="Transition spreadsheet inventory tracking onto cloud ERP software to eliminate fulfillment delays.",
                    category="operations",
                    priority="High",
                    timeline="3-6 months",
                    expected_impact="20% Order Cycle Time Reduction",
                )
            )
        else:
            recs.append(
                GrowthAdviceItem(
                    id="growth_ops_sop_automation",
                    title="Standard Operating Procedure (SOP) Optimization",
                    advice="Document formal workflow manuals and establish automated quality control checkpoints.",
                    category="operations",
                    priority="Medium",
                    timeline="3-6 months",
                    expected_impact="15% Reduction in Operating Waste",
                )
            )

        # 4. Digital Advice
        if not dp or not dp.has_ecommerce:
            recs.append(
                GrowthAdviceItem(
                    id="growth_digital_storefront",
                    title="Direct E-Commerce Storefront & Self-Service Portal",
                    advice="Deploy an automated digital storefront allowing customer self-service ordering, invoice downloads, and re-orders.",
                    category="digital",
                    priority="Critical",
                    timeline="1-3 months",
                    expected_impact="+35% Online Order Growth",
                )
            )
        else:
            recs.append(
                GrowthAdviceItem(
                    id="growth_digital_analytics",
                    title="Customer Analytics & Personalization Tuning",
                    advice="Implement web analytics heatmaps and automated email re-engagement sequences for cart abandoners.",
                    category="digital",
                    priority="Medium",
                    timeline="1-3 months",
                    expected_impact="+18% E-Commerce Conversion",
                )
            )

        # 5. Hiring Advice
        if emp <= 10:
            recs.append(
                GrowthAdviceItem(
                    id="growth_hiring_sales_rep",
                    title="Recruit Full-Time B2B Technical Sales Representative",
                    advice="Hire a dedicated sales engineer to handle inbound lead qualification and outbound buyer presentations.",
                    category="hiring",
                    priority="High",
                    timeline="3-6 months",
                    expected_impact="3x Sales Outreach Velocity",
                )
            )
        else:
            recs.append(
                GrowthAdviceItem(
                    id="growth_hiring_ops_manager",
                    title="Appoint Operations & Quality Assurance Manager",
                    advice="Bring on an experienced operations lead to oversee facility throughput and logistics coordination.",
                    category="hiring",
                    priority="Medium",
                    timeline="3-6 months",
                    expected_impact="Enhanced Execution Capacity",
                )
            )

        # 6. Products Advice
        recs.append(
            GrowthAdviceItem(
                id="growth_products_bundling",
                title="Product Subscription & Maintenance Service Bundles",
                advice="Package core products with recurring maintenance subscriptions or extended warranty service plans.",
                category="products",
                priority="Medium",
                timeline="6-12 months",
                expected_impact="+25% Recurring Monthly Revenue",
            )
        )

        return GrowthAdvisorReport(
            growth_stage=stage,
            total_advice_count=len(recs),
            recommendations=recs,
        )

    def compute(self, owner_id: int) -> GrowthAdvisorResponse:
        """Compute growth advisor response for given owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.generate_growth_advice(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return GrowthAdvisorResponse(generated_at=now_iso, report=report)

"""Deterministic SWOT Engine — Sprint 11.2.

Analyzes a Business profile and generates a rule-based SWOTReport containing:
  * strengths[]
  * weaknesses[]
  * opportunities[]
  * threats[]
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.swot import SWOTItem, SWOTReport, SWOTResponse


class SwotService:
    """Service layer for deterministic SWOT analysis (Sprint 11.2)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def analyze_swot(business: Business) -> SWOTReport:
        """Analyze business profile and return deterministic SWOTReport."""
        strengths: list[SWOTItem] = []
        weaknesses: list[SWOTItem] = []
        opportunities: list[SWOTItem] = []
        threats: list[SWOTItem] = []

        current_year = datetime.now().year
        age = (
            max(0, current_year - business.established_year)
            if (business.established_year and business.established_year > 0)
            else 0
        )
        emp = business.employee_count or 0
        prods = len(business.products) if business.products else 0
        exports = len(business.export_history) if business.export_history else 0
        certs = len(business.certifications) if business.certifications else 0
        dp = business.digital_presence
        rev = business.annual_revenue or 0.0

        # ---- Strengths ----
        if age >= 3:
            strengths.append(
                SWOTItem(
                    title="Operating Maturity",
                    description=f"{age} years of operating history provides market presence and stability.",
                    impact="high",
                    category="general",
                )
            )

        if emp >= 10:
            strengths.append(
                SWOTItem(
                    title="Workforce Scale",
                    description=f"Active workforce of {emp} employees enables execution capability.",
                    impact="high",
                    category="team",
                )
            )

        if rev >= 100000:
            strengths.append(
                SWOTItem(
                    title="Solid Financial Baseline",
                    description=f"Annual revenue of {rev:,.0f} {business.revenue_currency} supports reinvestment.",
                    impact="high",
                    category="financial",
                )
            )

        if exports > 0:
            strengths.append(
                SWOTItem(
                    title="Export Footprint",
                    description=f"Established export sales channels across {exports} target market(s).",
                    impact="high",
                    category="export",
                )
            )

        if certs > 0:
            strengths.append(
                SWOTItem(
                    title="Quality Certifications",
                    description=f"Holds {certs} formal industry certification(s).",
                    impact="medium",
                    category="compliance",
                )
            )

        if dp and (dp.has_ecommerce or dp.uses_cloud_systems):
            strengths.append(
                SWOTItem(
                    title="Digital Infrastructure",
                    description="Employs cloud management systems and/or e-commerce sales channels.",
                    impact="medium",
                    category="digital",
                )
            )

        # Fallback strength if none triggered
        if not strengths:
            strengths.append(
                SWOTItem(
                    title="Business Foundation",
                    description=f"Registered in {business.industry} with active operations.",
                    impact="low",
                    category="general",
                )
            )

        # ---- Weaknesses ----
        if not dp or (not dp.website_url and not dp.has_ecommerce):
            weaknesses.append(
                SWOTItem(
                    title="Limited Digital Footprint",
                    description="Lacks an official website or direct-to-consumer e-commerce portal.",
                    impact="high",
                    category="digital",
                )
            )

        if certs == 0:
            weaknesses.append(
                SWOTItem(
                    title="Lack of ISO/Industry Certifications",
                    description="No quality, safety, or industry certifications currently registered.",
                    impact="medium",
                    category="compliance",
                )
            )

        if exports == 0:
            weaknesses.append(
                SWOTItem(
                    title="Domestic Market Dependence",
                    description="100% revenue dependence on local/domestic markets.",
                    impact="medium",
                    category="export",
                )
            )

        if emp <= 5:
            weaknesses.append(
                SWOTItem(
                    title="Lean Team Capacity",
                    description="Small employee headcount may bottleneck rapid order scaling.",
                    impact="medium",
                    category="team",
                )
            )

        # ---- Opportunities ----
        if exports == 0:
            opportunities.append(
                SWOTItem(
                    title="Cross-Border Export Expansion",
                    description="Entering regional international markets offers untapped growth potential.",
                    impact="high",
                    category="export",
                )
            )

        if not dp or not dp.has_ecommerce:
            opportunities.append(
                SWOTItem(
                    title="E-Commerce Storefront Adoption",
                    description="Launching online sales channels broadens customer acquisition.",
                    impact="high",
                    category="digital",
                )
            )

        if certs == 0:
            opportunities.append(
                SWOTItem(
                    title="ISO Certification Acquisition",
                    description="Obtaining ISO or trade certifications unlocks corporate supply chains.",
                    impact="medium",
                    category="compliance",
                )
            )

        opportunities.append(
            SWOTItem(
                title="Capacity & Automation Tuning",
                description="Optimizing production utilization and cloud workflows to boost margins.",
                impact="medium",
                category="general",
            )
        )

        # ---- Threats ----
        if rev < 50000:
            threats.append(
                SWOTItem(
                    title="Revenue Margin Vulnerability",
                    description="Modest revenue base increases exposure to economic shocks.",
                    impact="high",
                    category="financial",
                )
            )

        if business.challenges and len(business.challenges) > 0:
            threats.append(
                SWOTItem(
                    title="Unresolved Operational Friction",
                    description=f"{len(business.challenges)} reported business challenge(s) threaten timeline execution.",
                    impact="medium",
                    category="general",
                )
            )

        if not dp or not dp.uses_cloud_systems:
            threats.append(
                SWOTItem(
                    title="Competitor Tech Disruption",
                    description="Rivals adopting AI and cloud automation may outpace manual operations.",
                    impact="medium",
                    category="digital",
                )
            )

        return SWOTReport(
            strengths=strengths,
            weaknesses=weaknesses,
            opportunities=opportunities,
            threats=threats,
        )

    def compute(self, owner_id: int) -> SWOTResponse:
        """Compute SWOT response envelope for given owner_id.

        Raises BusinessNotFound (404) when user has no business profile.
        """
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        swot_report = self.analyze_swot(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return SWOTResponse(generated_at=now_iso, swot=swot_report)

"""Recommendation Engine & Priority Engine — Sprint 12.1 & 12.2.

Generates and prioritizes rule-based recommendations derived from:
  * Business DNA
  * SWOT Analysis
  * Business Readiness Score
  * Business Health Score
  * Opportunities
  * Dashboard KPIs

Priority Engine scores every recommendation using 4 factors:
  1. Business Health Urgency
  2. Readiness Urgency
  3. Risk Profile
  4. Growth Potential

Outputs sorted recommendations ranked by priority_score (0-100) and priority label (Critical, High, Medium, Low).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.recommendation import (
    RecommendationItem,
    RecommendationReport,
)
from app.services.business_dna_service import BusinessDNAService
from app.services.health_score_service import HealthScoreService
from app.services.kpi_service import KpiService
from app.services.opportunity_service import OpportunityService
from app.services.readiness_service import ReadinessService
from app.services.swot_service import SwotService


class RecommendationService:
    """Service layer for deterministic Business Recommendation & Priority engine (Sprint 12.1 & 12.2)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._dna_service = BusinessDNAService(repo)
        self._swot_service = SwotService(repo)
        self._readiness_service = ReadinessService(repo)
        self._opp_service = OpportunityService(repo)

    def _prioritize_and_sort(
        self, recs: list[RecommendationItem], business: Business
    ) -> list[RecommendationItem]:
        """Score every recommendation using Health, Readiness, Risk, and Growth factors, then sort descending."""
        try:
            health_res = HealthScoreService.compute(business)
            health_score = health_res.score
        except Exception:
            health_score = 70

        try:
            readiness_report = self._readiness_service.analyze_readiness(business)
            readiness_score = readiness_report.overall_score
        except Exception:
            readiness_score = 70

        try:
            dna_data = self._dna_service.analyze_dna(business)
            risk_prof = dna_data.risk_profile
            growth_pot = dna_data.growth_potential
        except Exception:
            risk_prof = "Moderate"
            growth_pot = "Moderate"

        health_urgency = (100.0 - health_score) * 0.20
        readiness_urgency = (100.0 - readiness_score) * 0.20

        risk_pts = 15.0 if risk_prof in ["Elevated", "High"] else (10.0 if risk_prof == "Moderate" else 5.0)
        growth_pts = 15.0 if growth_pot == "Very High" else (10.0 if growth_pot == "High" else 5.0)

        scored_recs: list[RecommendationItem] = []
        for item in recs:
            impact_pts = 35.0 if item.impact == "High" else (25.0 if item.impact == "Medium" else 15.0)
            effort_pts = 25.0 if item.effort == "Low" else (15.0 if item.effort == "Medium" else 5.0)

            raw = impact_pts + effort_pts + health_urgency + readiness_urgency + risk_pts + growth_pts
            p_score = min(100, max(10, round(raw)))

            if p_score >= 85:
                p_label = "Critical"
            elif p_score >= 70:
                p_label = "High"
            elif p_score >= 50:
                p_label = "Medium"
            else:
                p_label = "Low"

            scored_recs.append(
                RecommendationItem(
                    id=item.id,
                    title=item.title,
                    description=item.description,
                    category=item.category,
                    priority=p_label,
                    priority_score=p_score,
                    impact=item.impact,
                    effort=item.effort,
                )
            )

        scored_recs.sort(key=lambda r: r.priority_score, reverse=True)
        return scored_recs

    def generate_recommendations(self, business: Business) -> RecommendationReport:
        """Generate and prioritize deterministic recommendations."""
        raw_recs: list[RecommendationItem] = []
        seen_ids: set[str] = set()

        def add_rec(item: RecommendationItem) -> None:
            if item.id not in seen_ids:
                seen_ids.add(item.id)
                raw_recs.append(item)

        # 1. Business DNA Rules
        dna = self._dna_service.analyze_dna(business)
        if dna.business_stage in ["Early Stage", "Growth"]:
            add_rec(
                RecommendationItem(
                    id="rec_dna_sop",
                    title="Formalize Standard Operating Procedures (SOPs)",
                    description=(
                        f"As an {dna.business_stage} firm, establishing written SOPs for order handling "
                        "and inventory management ensures consistent quality during workforce expansion."
                    ),
                    category="operations",
                    priority="High",
                    impact="High",
                    effort="Medium",
                )
            )

        if dna.digital_maturity in ["Low", "Medium"]:
            add_rec(
                RecommendationItem(
                    id="rec_dna_digital_boost",
                    title="Upgrade Core Digital Workflows",
                    description=(
                        f"Digital maturity is currently {dna.digital_maturity}. Implementing cloud "
                        "accounting and digital marketing tools will significantly boost operating efficiency."
                    ),
                    category="digital",
                    priority="Critical",
                    impact="High",
                    effort="Low",
                )
            )

        # 2. SWOT Rules
        swot = self._swot_service.analyze_swot(business)
        for w in swot.weaknesses:
            if "Digital" in w.title:
                add_rec(
                    RecommendationItem(
                        id="rec_swot_digital_footprint",
                        title="Establish Official Online Web & Commerce Presence",
                        description="Address limited digital presence by launching an official website and e-commerce channel.",
                        category="digital",
                        priority="High",
                        impact="High",
                        effort="Low",
                    )
                )
            elif "Certifications" in w.title:
                add_rec(
                    RecommendationItem(
                        id="rec_swot_certification",
                        title="Enroll in ISO 9001 Certification Framework",
                        description="Acquire industry quality certifications to satisfy corporate vendor procurement criteria.",
                        category="compliance",
                        priority="Medium",
                        impact="High",
                        effort="Medium",
                    )
                )
            elif "Export" in w.title or "Domestic" in w.title:
                add_rec(
                    RecommendationItem(
                        id="rec_swot_export_prep",
                        title="Prepare Cross-Border Export Readiness Documentation",
                        description="Register for trade export compliance codes (e.g. IEC) to diversify domestic revenue dependence.",
                        category="export",
                        priority="High",
                        impact="High",
                        effort="Medium",
                    )
                )

        # 3. Readiness Rules
        readiness = self._readiness_service.analyze_readiness(business)
        for dim in readiness.breakdown:
            if dim.score < 60:
                if dim.dimension == "Finance":
                    add_rec(
                        RecommendationItem(
                            id="rec_readiness_finance",
                            title="Upgrade Financial Accounting Controls",
                            description="Finance readiness is low (<60). Transition from spreadsheet tracking to cloud accounting software.",
                            category="financial",
                            priority="High",
                            impact="High",
                            effort="Low",
                        )
                    )
                elif dim.dimension == "Digital":
                    add_rec(
                        RecommendationItem(
                            id="rec_readiness_digital_store",
                            title="Implement E-Commerce & Customer Portal",
                            description="Digital readiness score is under 60. Automate customer order intake online.",
                            category="digital",
                            priority="High",
                            impact="High",
                            effort="Low",
                        )
                    )
                elif dim.dimension == "Operations":
                    add_rec(
                        RecommendationItem(
                            id="rec_readiness_ops_capacity",
                            title="Optimize Production Capacity & Batching",
                            description="Operations score is below 60. Conduct time-motion study to optimize facility throughput.",
                            category="operations",
                            priority="Medium",
                            impact="Medium",
                            effort="Medium",
                        )
                    )

        # 4. Opportunities Rules
        opps = self._opp_service.detect_opportunities(business)
        for o in opps.opportunities:
            effort_map = {"Easy": "Low", "Medium": "Medium", "Hard": "High"}
            eff = effort_map.get(o.difficulty, "Medium")
            add_rec(
                RecommendationItem(
                    id=f"rec_opp_{o.id}",
                    title=f"Capitalize on Opportunity: {o.title}",
                    description=o.description,
                    category=o.category,
                    priority=o.priority,
                    impact=o.impact,
                    effort=eff,
                )
            )

        # 5. Dashboard KPIs Rules
        kpis = KpiService.compute(business)
        if kpis.profileCompletion < 100:
            add_rec(
                RecommendationItem(
                    id="rec_kpi_profile_completeness",
                    title="Complete Business Profile Information",
                    description=(
                        f"Profile completion is at {kpis.profileCompletion}%. Providing complete product, "
                        "location, and employee records improves AI recommendation accuracy."
                    ),
                    category="operations",
                    priority="Medium",
                    impact="Medium",
                    effort="Low",
                )
            )

        # Fallback if empty
        if not raw_recs:
            add_rec(
                RecommendationItem(
                    id="rec_general_review",
                    title="Conduct Quarterly Strategic Business Review",
                    description="Review financial margins and operational goals quarterly with key stakeholders.",
                    category="operations",
                    priority="Low",
                    impact="Medium",
                    effort="Low",
                )
            )

        sorted_recs = self._prioritize_and_sort(raw_recs, business)
        return RecommendationReport(
            total_count=len(sorted_recs),
            recommendations=sorted_recs,
        )

    def compute(self, owner_id: int) -> dict:
        """Compute recommendation response payload for owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.generate_recommendations(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return {
            "generated_at": now_iso,
            "report": report,
            "recommendations": report.recommendations,
        }

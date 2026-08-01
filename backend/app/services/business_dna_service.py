"""Business DNA Engine — Sprint 11.1.

Pure rule-based deterministic engine that analyzes a Business profile
and generates a BusinessDNAData object containing:
  * business_stage
  * digital_maturity
  * operational_complexity
  * growth_potential
  * market_position
  * automation_level
  * risk_profile
  * overall_dna
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.dna import (
    ArchetypeOut,
    BusinessDNAData,
    BusinessDNAResponse,
    DNAInputsOut,
    DNAPayload,
    FindingOut,
    RationaleOut,
)
from app.services.business_service import BusinessService


class BusinessDNAService:
    """Service layer for deterministic Business DNA analysis (Sprint 11.1)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def analyze_dna(business: Business) -> BusinessDNAData:
        """Analyze business profile and return deterministic BusinessDNAData."""
        current_year = datetime.now().year
        age_years = (
            max(0, current_year - business.established_year)
            if (business.established_year and business.established_year > 0)
            else 0
        )
        emp = business.employee_count or 0
        prods = len(business.products) if business.products else 0
        exports = len(business.export_history) if business.export_history else 0
        certs = len(business.certifications) if business.certifications else 0
        dp = business.digital_presence

        # 1. business_stage
        if age_years < 2 or emp <= 5:
            stage = "Early Stage"
        elif age_years <= 5 or emp <= 25:
            stage = "Growth"
        elif age_years <= 10 or emp <= 100:
            stage = "Mature"
        else:
            stage = "Established"

        # 2. digital_maturity
        dp_count = 0
        if dp:
            if dp.website_url and dp.website_url.strip():
                dp_count += 1
            if dp.linkedin_url and dp.linkedin_url.strip():
                dp_count += 1
            if dp.has_ecommerce:
                dp_count += 1
            if dp.uses_digital_marketing:
                dp_count += 1
            if dp.uses_cloud_systems:
                dp_count += 1

        if dp_count >= 4:
            mat = "Advanced"
        elif dp_count >= 3:
            mat = "High"
        elif dp_count >= 1:
            mat = "Medium"
        else:
            mat = "Low"

        # 3. operational_complexity
        if prods > 5 or exports > 2 or emp > 50:
            complexity = "High"
        elif prods > 2 or emp > 10:
            complexity = "Medium"
        else:
            complexity = "Low"

        # 4. growth_potential
        if dp and dp.has_ecommerce and exports > 0:
            growth = "Very High"
        elif (business.annual_revenue and business.annual_revenue > 100000) or (
            business.goals and len(business.goals) > 0
        ):
            growth = "High"
        else:
            growth = "Moderate"

        # 5. market_position
        if exports > 0:
            position = "Global Exporter"
        elif business.state_region or business.city:
            position = "Regional Leader"
        else:
            position = "Local Player"

        # 6. automation_level
        if dp and dp.uses_cloud_systems and dp.has_ecommerce:
            auto = "Fully Automated"
        elif dp and (dp.uses_cloud_systems or dp.uses_digital_marketing):
            auto = "Semi-Automated"
        else:
            auto = "Manual"

        # 7. risk_profile
        try:
            completeness = BusinessService._compute_completeness(business).score
        except Exception:
            completeness = 50

        if (business.challenges and len(business.challenges) > 2) or completeness < 50:
            risk = "Elevated"
        elif certs > 0 and completeness >= 80:
            risk = "Low"
        else:
            risk = "Moderate"

        # 8. overall_dna
        if exports > 0:
            overall = "Global Exporter"
        elif dp and dp.has_ecommerce:
            overall = "Digital Native"
        elif certs > 0:
            overall = "Compliance Leader"
        elif emp > 20:
            overall = "Growth Operator"
        else:
            overall = "Emerging Builder"

        return BusinessDNAData(
            business_stage=stage,
            digital_maturity=mat,
            operational_complexity=complexity,
            growth_potential=growth,
            market_position=position,
            automation_level=auto,
            risk_profile=risk,
            overall_dna=overall,
        )

    def compute(self, owner_id: int) -> dict:
        """Compute DNA response payload for the given owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile to analyze.")

        dna_data = self.analyze_dna(business)

        archetype_out = ArchetypeOut(
            key=dna_data.overall_dna.lower().replace(" ", "_"),
            title=dna_data.overall_dna,
            description=f"Primary archetype classified as {dna_data.overall_dna}.",
            match_score=85,
            rationale=[
                RationaleOut(
                    claim=f"Business categorized as {dna_data.overall_dna}.",
                    signal=f"Stage: {dna_data.business_stage}, Digital Maturity: {dna_data.digital_maturity}",
                )
            ],
        )

        payload = DNAPayload(
            archetype=archetype_out,
            secondary_traits=[],
            strengths=[
                FindingOut(
                    title="Operating Foundation",
                    detail=f"Stage is {dna_data.business_stage}.",
                    severity="info",
                )
            ],
            weaknesses=[],
            opportunities=[
                FindingOut(
                    title="Digital Scaling",
                    detail=f"Automation level is {dna_data.automation_level}.",
                    severity="info",
                )
            ],
            risk_areas=[],
            confidence=85,
            confidence_rationale=[],
            business_dna=dna_data,
        )

        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return {
            "generated_at": now_iso,
            "inputs": {
                "intelligence_generated_at": now_iso,
                "scores_generated_at": now_iso,
            },
            "dna": payload,
        }

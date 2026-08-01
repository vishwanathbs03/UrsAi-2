"""Business Health Score Engine — Sprint 10 Task 10.4.

Computes a deterministic health score (0-100) based on six weighted components:
  1. Profile Completeness  (30 pts)
  2. Business Info        (15 pts)
  3. Products/Services    (15 pts)
  4. Team                 (10 pts)
  5. Financial            (20 pts)
  6. Online Presence      (10 pts)

Returns:
  * score (0-100)
  * grade ("A", "B", "C", "D", "E", "F")
  * status ("Excellent", "Good", "Fair", "Needs Improvement", "Critical")
  * missingFields / missing_fields list of unpopulated items
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.business import Business
from app.services.business_service import BusinessService


class BusinessHealthReport(BaseModel):
    """Health score report schema for Sprint 10 Task 10.4."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    score: int = Field(default=0, ge=0, le=100)
    grade: str = Field(default="F")
    status: str = Field(default="Critical")
    missing_fields: list[str] = Field(default_factory=list, alias="missingFields")
    missingFields: list[str] = Field(default_factory=list)


class HealthScoreService:
    """Engine to calculate business health score (Sprint 10 Task 10.4)."""

    @staticmethod
    def compute(business: Business | None) -> BusinessHealthReport:
        """Compute business health score report from a Business model instance."""
        if business is None:
            return BusinessHealthReport(
                score=0,
                grade="F",
                status="Critical",
                missing_fields=["business_profile"],
                missingFields=["business_profile"],
            )

        total_score = 0.0
        missing: list[str] = []

        # 1. Profile Completeness (Max 30 pts)
        try:
            completeness = BusinessService._compute_completeness(business)
            comp_score = completeness.score
        except Exception:
            comp_score = 0

        total_score += 30.0 * (comp_score / 100.0)
        if comp_score < 100:
            missing.append("profile_completeness")

        # 2. Business Info (Max 15 pts: legal_name 3pt, industry 3pt, established_year 3pt, business_type 3pt, country 3pt)
        info_score = 0.0
        if business.legal_name and business.legal_name.strip():
            info_score += 3.0
        else:
            missing.append("legal_name")

        if business.industry and business.industry.strip():
            info_score += 3.0
        else:
            missing.append("industry")

        if business.established_year and business.established_year > 0:
            info_score += 3.0
        else:
            missing.append("established_year")

        if business.business_type and business.business_type.strip():
            info_score += 3.0
        else:
            missing.append("business_type")

        if business.country and business.country.strip():
            info_score += 3.0
        else:
            missing.append("country")

        total_score += info_score

        # 3. Products/Services (Max 15 pts)
        prods = business.products or []
        if len(prods) > 0:
            total_score += 15.0
        else:
            missing.append("products_and_services")

        # 4. Team (Max 10 pts)
        if business.employee_count and business.employee_count > 0:
            total_score += 10.0
        else:
            missing.append("employee_count")

        # 5. Financial (Max 20 pts)
        if business.annual_revenue and business.annual_revenue > 0:
            total_score += 20.0
        else:
            missing.append("annual_revenue")

        # 6. Online Presence (Max 10 pts)
        dp = business.digital_presence
        has_presence = False
        if dp is not None:
            if (
                (dp.website_url and dp.website_url.strip())
                or (dp.linkedin_url and dp.linkedin_url.strip())
                or dp.has_ecommerce
                or dp.uses_digital_marketing
                or dp.uses_cloud_systems
            ):
                has_presence = True

        if has_presence:
            total_score += 10.0
        else:
            missing.append("digital_presence")

        # Final Score Rounding (0 - 100)
        final_score = min(100, max(0, round(total_score)))

        # Determine Grade and Status
        if final_score >= 90:
            grade = "A"
            status_text = "Excellent"
        elif final_score >= 80:
            grade = "B"
            status_text = "Good"
        elif final_score >= 70:
            grade = "C"
            status_text = "Fair"
        elif final_score >= 60:
            grade = "D"
            status_text = "Needs Improvement"
        elif final_score >= 50:
            grade = "E"
            status_text = "Needs Improvement"
        else:
            grade = "F"
            status_text = "Critical"

        return BusinessHealthReport(
            score=final_score,
            grade=grade,
            status=status_text,
            missing_fields=missing,
            missingFields=missing,
        )

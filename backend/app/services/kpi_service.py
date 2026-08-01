"""KPI Engine — Sprint 10 Task 10.3.

Computes core business KPIs from a Business model instance:
  * businessName / business_name     — legal name or None
  * industry                         — primary industry or None
  * employees                        — employee count or 0
  * products                         — total products count or 0
  * services                         — count of service-category products or 0
  * locations                        — total locations count (domestic + export destinations) or 0
  * yearsInBusiness / years_in_business — elapsed years since established_year or 0
  * profileCompletion / profile_completion — completeness percentage score (0-100) or 0

Returns 0 / None (null) when data is unavailable.
"""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.business import Business
from app.services.business_service import BusinessService


class ComputedKPIs(BaseModel):
    """Structured KPIs computed directly from a Business model instance."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    business_name: str | None = Field(default=None, alias="businessName")
    businessName: str | None = Field(default=None)

    industry: str | None = Field(default=None)

    employees: int = Field(default=0)

    products: int = Field(default=0)

    services: int = Field(default=0)

    locations: int = Field(default=0)

    years_in_business: int = Field(default=0, alias="yearsInBusiness")
    yearsInBusiness: int = Field(default=0)

    profile_completion: int = Field(default=0, alias="profileCompletion")
    profileCompletion: int = Field(default=0)


class KpiService:
    """KPI Computation Engine (Sprint 10 Task 10.3)."""

    @staticmethod
    def compute(business: Business | None) -> ComputedKPIs:
        """Compute KPIs from a Business model instance.

        Returns 0/null when field data is unavailable.
        """
        if business is None:
            return ComputedKPIs()

        # 1. businessName
        name = business.legal_name.strip() if (business.legal_name and business.legal_name.strip()) else None

        # 2. industry
        ind = business.industry.strip() if (business.industry and business.industry.strip()) else None

        # 3. employees
        emp = (
            business.employee_count
            if (business.employee_count is not None and business.employee_count >= 0)
            else 0
        )

        # 4. products
        all_products = business.products or []
        prod_count = len(all_products)

        # 5. services (products whose category or name contains 'service')
        service_count = sum(
            1
            for p in all_products
            if (p.category and "service" in p.category.lower())
            or (p.name and "service" in p.name.lower())
        )

        # 6. locations (domestic location + export destination countries)
        locs: set[str] = set()
        if business.city and business.city.strip():
            locs.add(business.city.strip().lower())
        if business.state_region and business.state_region.strip():
            locs.add(business.state_region.strip().lower())
        if business.country and business.country.strip():
            locs.add(business.country.strip().lower())

        for exp in (business.export_history or []):
            if exp.destination_country and exp.destination_country.strip():
                locs.add(exp.destination_country.strip().lower())

        loc_count = len(locs) if locs else (1 if (business.country or business.city) else 0)

        # 7. yearsInBusiness
        current_year = datetime.now().year
        years = (
            max(0, current_year - business.established_year)
            if (business.established_year and business.established_year > 0)
            else 0
        )

        # 8. profileCompletion
        try:
            completeness = BusinessService._compute_completeness(business)
            completion_score = completeness.score
        except Exception:
            completion_score = 0

        return ComputedKPIs(
            business_name=name,
            businessName=name,
            industry=ind,
            employees=emp,
            products=prod_count,
            services=service_count,
            locations=loc_count,
            years_in_business=years,
            yearsInBusiness=years,
            profile_completion=completion_score,
            profileCompletion=completion_score,
        )

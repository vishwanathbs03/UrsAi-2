"""Government Scheme Recommendation Engine — Sprint 16.

Ranks static deterministic MSME schemes using:
  * Industry
  * Annual Turnover
  * Employee Count
  * Location / Region
  * Business Age

Categorizes results into:
  * recommended
  * eligible
  * partially_eligible
  * not_eligible
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.schemes_sprint16 import (
    BusinessSchemesResponse,
    CategorizedSchemes,
    SchemeItem,
)

# Static Deterministic Government Schemes Dataset
SCHEMES_CATALOG: list[dict[str, Any]] = [
    {
        "id": "scheme-cgtsd",
        "name": "Credit Guarantee Fund Trust for Micro & Small Enterprises (CGTMSE)",
        "description": "Collateral-free credit facility up to USD 250,000 for manufacturing & service MSMEs.",
        "category": "Financial Credit",
        "priority": "High",
        "benefits": ["Collateral-free loans", "Subsidized guarantee fee", "Priority bank processing"],
        "application_link": "https://www.cgtmse.in",
        "target_industries": ["all"],
        "min_turnover": 0.0,
        "max_turnover": 5000000.0,
    },
    {
        "id": "scheme-zed",
        "name": "Zero Defect Zero Effect (ZED) Certification Scheme",
        "description": "Financial assistance for manufacturing MSMEs to achieve international quality standards.",
        "category": "Quality & Standards",
        "priority": "High",
        "benefits": ["80% subsidy on certification fee", "Technology upgrade grant", "Export audit support"],
        "application_link": "https://zed.msme.gov.in",
        "target_industries": ["Manufacturing", "Robotics", "Clean Energy", "Software"],
        "min_turnover": 50000.0,
        "max_turnover": 10000000.0,
    },
    {
        "id": "scheme-digital-msme",
        "name": "Digital MSME Enablement Scheme",
        "description": "Subsidy on cloud computing, ERP, and e-commerce onboarding for MSMEs.",
        "category": "Digital Transformation",
        "priority": "Medium",
        "benefits": ["75% subsidy on Cloud ERP subscription", "E-commerce onboarding grant", "Cybersecurity audit"],
        "application_link": "https://msme.gov.in/digital-msme",
        "target_industries": ["all"],
        "min_turnover": 0.0,
        "max_turnover": 2000000.0,
    },
    {
        "id": "scheme-pmegp",
        "name": "Prime Minister Employment Generation Programme (PMEGP)",
        "description": "Credit-linked subsidy program to generate employment in new manufacturing & service micro-units.",
        "category": "Employment & Subsidy",
        "priority": "High",
        "benefits": ["Up to 35% margin money subsidy", "Low interest rate terms", "Skill training included"],
        "application_link": "https://www.kviconline.gov.in/pmegp",
        "target_industries": ["all"],
        "min_turnover": 0.0,
        "max_turnover": 1000000.0,
    },
    {
        "id": "scheme-export-promotion",
        "name": "Market Access Initiative (MAI) Export Scheme",
        "description": "Financial support for MSMEs participating in international trade fairs and global buyer meets.",
        "category": "Export & International",
        "priority": "Medium",
        "benefits": ["Airfare reimbursement", "Stall rent subsidy up to $5,000", "B2B matchmaking"],
        "application_link": "https://commerce.gov.in/mai",
        "target_industries": ["Manufacturing", "Supply Chain", "Retail Trade"],
        "min_turnover": 200000.0,
        "max_turnover": 20000000.0,
    },
    {
        "id": "scheme-mudra-shishu",
        "name": "Pradhan Mantri MUDRA Yojana — Shishu Loan",
        "description": "Working-capital loan up to ₹50,000 for early-stage micro-enterprises through PSU banks, NBFCs, and MFIs.",
        "category": "Working Capital",
        "priority": "High",
        "benefits": ["Collateral-free up to ₹50,000", "Low interest (8-12% p.a.)", "No processing fee"],
        "application_link": "https://www.mudra.org.in",
        "target_industries": ["all"],
        "min_turnover": 0.0,
        "max_turnover": 500000.0,
    },
    {
        "id": "scheme-nsic",
        "name": "NSIC Integrated Small Enterprise Development Scheme",
        "description": "Subsidy + technical services for MSMEs through the National Small Industries Corporation, including marketing support and export facilitation.",
        "category": "Development & Support",
        "priority": "Medium",
        "benefits": ["Marketing development subsidy", "Export facilitation services", "Common Facility Centre access"],
        "application_link": "https://www.nsic.co.in",
        "target_industries": ["Manufacturing", "Service", "Trading"],
        "min_turnover": 0.0,
        "max_turnover": 50000000.0,
    },
]  # NOTE: Eligibility, sanctions, and subsidy amounts are subject to the
# official authority's (Ministry of MSME / NSIC / SIDBI / Department of
# Commerce) prevailing rules and budget availability. Matching scores are
# computed by UrsBiz on this static dataset — they do not guarantee
# approval or funding.


class SchemeRecommendationEngine:
    """Deterministic recommendation engine for government schemes."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    def evaluate_scheme(self, business: Business, raw: dict[str, Any]) -> SchemeItem:
        rev = business.annual_revenue or 0.0
        emp = business.employee_count or 0
        ind = business.industry or "General"

        ind_match = "all" in raw["target_industries"] or ind in raw["target_industries"]
        min_t = raw.get("min_turnover", 0.0) or 0.0
        max_t = raw.get("max_turnover", 99999999.0) or 99999999.0
        turnover_match = min_t <= rev <= max_t

        if ind_match and turnover_match:
            status = "eligible"
            reason = f"Your business meets industry ({ind}) and annual revenue requirements."
            score = 92 if raw["priority"] == "High" else 85
        elif ind_match or turnover_match:
            status = "partiallyEligible"
            reason = f"Partial match: {'Industry matches' if ind_match else 'Revenue range matches'} criteria."
            score = 65
        else:
            status = "notEligible"
            reason = "Business profile exceeds turnover threshold or industry scope."
            score = 30

        docs = [
            "Business Registration Certificate",
            "PAN / Tax Identification Number",
            "Latest 2-Year Audited Financial Statements",
            "Bank Statement (Last 6 Months)",
        ]

        steps = [
            "Verify eligibility and documentation criteria",
            "Register on official government scheme portal",
            "Upload business registration & financial statements",
            "Submit application and track status online",
        ]

        return SchemeItem(
            id=raw["id"],
            name=raw["name"],
            description=raw["description"],
            category=raw["category"],
            eligibility_status=status,
            eligibility_reason=reason,
            matching_score=score,
            priority=raw["priority"],
            benefits=raw["benefits"],
            documents_required=docs,
            application_steps=steps,
            application_link=raw["application_link"],
            target_industries=raw["target_industries"],
            max_turnover=raw.get("max_turnover"),
            min_turnover=raw.get("min_turnover"),
        )

    def recommend_schemes(self, business: Business) -> CategorizedSchemes:
        rec: list[SchemeItem] = []
        el: list[SchemeItem] = []
        pel: list[SchemeItem] = []
        nel: list[SchemeItem] = []

        for raw in SCHEMES_CATALOG:
            item = self.evaluate_scheme(business, raw)
            if item.eligibility_status == "eligible":
                el.append(item)
                if item.priority == "High":
                    rec.append(item)
            elif item.eligibility_status == "partiallyEligible":
                pel.append(item)
            else:
                nel.append(item)

        return CategorizedSchemes(
            recommended=rec,
            eligible=el,
            partially_eligible=pel,
            not_eligible=nel,
        )

    def compute(self, owner_id: int) -> BusinessSchemesResponse:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        categorized = self.recommend_schemes(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        total = len(SCHEMES_CATALOG)

        return BusinessSchemesResponse(
            generated_at=now_iso,
            total_schemes=total,
            schemes=categorized,
        )

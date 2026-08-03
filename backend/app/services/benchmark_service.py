"""Industry Benchmark Engine — Sprint 11.5.

Compares business profile metrics against INTERNAL ILLUSTRATIVE
BASELINES (P0.5 — not external industry averages, not market
benchmarks, not top-performer percentiles). The constants below
are internal reference baselines used to provide a directional
view of where a business sits relative to a plausible
illustrative peer set. They are NOT validated against any
external dataset.

Returns:
  * industry_average   (INTERNAL_ILLUSTRATIVE_BASELINE)
  * user_score
  * difference
  * percentile         (illustrative, not top-performer)
  * benchmark_grade
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.benchmark import (
    BenchmarkMetric,
    BenchmarkReport,
    BenchmarkResponse,
)
from app.services.readiness_service import ReadinessService

# P0.5 — these constants are INTERNAL ILLUSTRATIVE BASELINES, not
# external industry averages. They are not validated against any
# external dataset and must be presented as "Illustrative baseline"
# or "Internal reference baseline" in user-facing surfaces.
INDUSTRY_DEFAULTS = {
    "Information Technology": {"digital": 85.0, "employees": 20.0, "revenue": 500000.0, "certs": 2.0},
    "Software & AI": {"digital": 90.0, "employees": 15.0, "revenue": 450000.0, "certs": 2.0},
    "Manufacturing": {"digital": 50.0, "employees": 35.0, "revenue": 750000.0, "certs": 1.0},
    "Healthcare": {"digital": 65.0, "employees": 25.0, "revenue": 600000.0, "certs": 2.0},
    "Retail": {"digital": 70.0, "employees": 12.0, "revenue": 300000.0, "certs": 0.0},
    "Services": {"digital": 60.0, "employees": 10.0, "revenue": 250000.0, "certs": 1.0},
    "Construction": {"digital": 40.0, "employees": 30.0, "revenue": 800000.0, "certs": 1.0},
    "DEFAULT": {"digital": 55.0, "employees": 15.0, "revenue": 350000.0, "certs": 1.0},
}


class BenchmarkService:
    """Service layer for deterministic Industry Benchmark engine (Sprint 11.5)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    @staticmethod
    def compute_benchmark(business: Business) -> BenchmarkReport:
        """Analyze business against industry benchmark standards."""
        ind = business.industry or "General Services"
        b_data = INDUSTRY_DEFAULTS.get(ind, INDUSTRY_DEFAULTS["DEFAULT"])

        dp = business.digital_presence
        dp_score = 0.0
        if dp:
            if dp.website_url:
                dp_score += 25
            if dp.linkedin_url:
                dp_score += 15
            if dp.has_ecommerce:
                dp_score += 25
            if dp.uses_digital_marketing:
                dp_score += 15
            if dp.uses_cloud_systems:
                dp_score += 20

        emp_score = float(business.employee_count or 0)
        rev_score = float(business.annual_revenue or 0.0)
        certs_score = float(len(business.certifications) if business.certifications else 0)

        readiness_report = ReadinessService.analyze_readiness(business)
        readiness_user = float(readiness_report.overall_score)
        readiness_ind = 65.0

        # Metric 1: Digital Adoption
        diff_digital = round(dp_score - b_data["digital"], 1)
        perc_digital = max(10, min(99, int(50 + (diff_digital * 0.8))))
        status_digital = "above_average" if diff_digital > 5 else ("below_average" if diff_digital < -5 else "average")

        # Metric 2: Employee Capacity
        diff_emp = round(emp_score - b_data["employees"], 1)
        perc_emp = max(10, min(99, int(50 + (diff_emp * 1.5))))
        status_emp = "above_average" if diff_emp > 2 else ("below_average" if diff_emp < -2 else "average")

        # Metric 3: Revenue Scale
        diff_rev = round(rev_score - b_data["revenue"], 1)
        ratio_rev = (rev_score / b_data["revenue"]) if b_data["revenue"] > 0 else 1.0
        perc_rev = max(10, min(99, int(50 + ((ratio_rev - 1.0) * 40))))
        status_rev = "above_average" if ratio_rev > 1.1 else ("below_average" if ratio_rev < 0.9 else "average")

        # Metric 4: Quality Certifications
        diff_certs = round(certs_score - b_data["certs"], 1)
        perc_certs = max(10, min(99, int(50 + (diff_certs * 25))))
        status_certs = "above_average" if diff_certs > 0 else ("below_average" if diff_certs < 0 else "average")

        # Metric 5: Readiness Score
        diff_readiness = round(readiness_user - readiness_ind, 1)
        perc_readiness = max(10, min(99, int(50 + (diff_readiness * 0.9))))
        status_readiness = "above_average" if diff_readiness > 5 else ("below_average" if diff_readiness < -5 else "average")

        metrics = [
            BenchmarkMetric(
                metric_name="Digital Adoption Index",
                user_score=dp_score,
                industry_average=b_data["digital"],
                difference=diff_digital,
                percentile=perc_digital,
                status=status_digital,
            ),
            BenchmarkMetric(
                metric_name="Workforce Scale",
                user_score=emp_score,
                industry_average=b_data["employees"],
                difference=diff_emp,
                percentile=perc_emp,
                status=status_emp,
            ),
            BenchmarkMetric(
                metric_name="Annual Revenue Scale",
                user_score=rev_score,
                industry_average=b_data["revenue"],
                difference=diff_rev,
                percentile=perc_rev,
                status=status_rev,
            ),
            BenchmarkMetric(
                metric_name="Certifications Count",
                user_score=certs_score,
                industry_average=b_data["certs"],
                difference=diff_certs,
                percentile=perc_certs,
                status=status_certs,
            ),
            BenchmarkMetric(
                metric_name="Business Readiness Index",
                user_score=readiness_user,
                industry_average=readiness_ind,
                difference=diff_readiness,
                percentile=perc_readiness,
                status=status_readiness,
            ),
        ]

        overall_percentile = round(sum(m.percentile for m in metrics) / len(metrics))

        if overall_percentile >= 85:
            grade = "A"
        elif overall_percentile >= 70:
            grade = "B"
        elif overall_percentile >= 55:
            grade = "C"
        elif overall_percentile >= 40:
            grade = "D"
        else:
            grade = "F"

        return BenchmarkReport(
            industry=ind,
            overall_benchmark_score=overall_percentile,
            benchmark_grade=grade,
            metrics=metrics,
        )

    def compute(self, owner_id: int) -> BenchmarkResponse:
        """Compute benchmark response for given owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        report = self.compute_benchmark(business)
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return BenchmarkResponse(generated_at=now_iso, report=report)

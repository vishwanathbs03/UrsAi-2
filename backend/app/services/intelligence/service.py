"""Intelligence service — façade that runs every analyzer and
builds the API response.

The service is intentionally thin: it owns no scoring rules
itself. The analyzers in :mod:`app.services.intelligence.analyzers`
do all the work; this module's job is to:

  1. Find the user's business (or raise 404)
  2. Run every analyzer in a stable, documented order
  3. Add a top-level "overall" summary so the UI can render
     one chip plus five section bars
  4. Stamp the response with the time it was generated so the
     UI can display "Updated X minutes ago"
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.business import Business
from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.services.intelligence.analyzers import (
    ComplianceReadinessAnalyzer,
    DigitalReadinessAnalyzer,
    ExportReadinessAnalyzer,
    GrowthReadinessAnalyzer,
    ProfileCompletenessAnalyzer,
)
from app.services.intelligence.base import AnalyzerResult, level_for


# Order is the order the cards appear in the UI.
_DEFAULT_ANALYZERS = (
    ProfileCompletenessAnalyzer(),
    ExportReadinessAnalyzer(),
    DigitalReadinessAnalyzer(),
    ComplianceReadinessAnalyzer(),
    GrowthReadinessAnalyzer(),
)


class IntelligenceService:
    """Generate structured intelligence for the authenticated user's
    business profile.

    Constructed with a BusinessRepository so it can be unit-tested
    with an in-memory session and a hand-built Business row.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    def analyze(self, owner_id: int) -> dict:
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile to analyze.")

        results: list[AnalyzerResult] = [
            analyzer.run(business) for analyzer in _DEFAULT_ANALYZERS
        ]

        from app.services.benchmark_service import BenchmarkService
        from app.services.business_dna_service import BusinessDNAService
        from app.services.opportunity_service import OpportunityService
        from app.services.readiness_service import ReadinessService
        from app.services.swot_service import SwotService

        dna_dict = BusinessDNAService(self._repo).compute(owner_id)
        swot_report = SwotService.analyze_swot(business)
        readiness_report = ReadinessService.analyze_readiness(business)
        benchmark_report = BenchmarkService.compute_benchmark(business)
        opp_report = OpportunityService.detect_opportunities(business)

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "overall": _overall(results),
            "analyzers": [r.to_payload() for r in results],
            "dna": dna_dict["dna"],
            "swot": swot_report,
            "readiness": readiness_report,
            "benchmark": benchmark_report,
            "opportunities": opp_report,
        }


def _overall(results: list[AnalyzerResult]) -> dict:
    """Top-level rollup.

    The overall score is the simple average of every analyzer so
    no single lens dominates. (Profile completeness is *not*
    double-counted just because it overlaps with the other
    analyzers — each lens is meant to be independent.)
    """
    if not results:
        score = 0
    else:
        score = round(sum(r.score for r in results) / len(results))
    return {
        "score": score,
        "level": level_for(score),
        "analyzer_count": len(results),
    }

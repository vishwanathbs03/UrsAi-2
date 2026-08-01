"""Unified Intelligence Aggregate Service — Sprint 11.6.

Composes the individual Sprint 11 engine services:
  * BusinessDNAService (DNA)
  * SwotService (SWOT)
  * ReadinessService (Readiness)
  * BenchmarkService (Benchmark)
  * OpportunityService (Opportunities)

No duplicated business logic inside this service or endpoint.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.intelligence_aggregate import FullBusinessIntelligencePayload
from app.services.benchmark_service import BenchmarkService
from app.services.business_dna_service import BusinessDNAService
from app.services.opportunity_service import OpportunityService
from app.services.readiness_service import ReadinessService
from app.services.swot_service import SwotService


class IntelligenceAggregateService:
    """Service layer for aggregated Sprint 11 business intelligence."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._dna_service = BusinessDNAService(repo)
        self._swot_service = SwotService(repo)
        self._readiness_service = ReadinessService(repo)
        self._benchmark_service = BenchmarkService(repo)
        self._opp_service = OpportunityService(repo)

    def get_full_intelligence(self, owner_id: int) -> FullBusinessIntelligencePayload:
        """Compute and aggregate all 5 Business Intelligence modules for owner_id.

        Raises BusinessNotFound (404) if user has no business profile.
        """
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        dna_dict = self._dna_service.compute(owner_id)
        dna_payload = dna_dict["dna"]
        swot_report = self._swot_service.analyze_swot(business)
        readiness_report = self._readiness_service.analyze_readiness(business)
        benchmark_report = self._benchmark_service.compute_benchmark(business)
        opp_report = self._opp_service.detect_opportunities(business)

        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return FullBusinessIntelligencePayload(
            generated_at=now_iso,
            dna=dna_payload,
            swot=swot_report,
            readiness=readiness_report,
            benchmark=benchmark_report,
            opportunities=opp_report,
        )

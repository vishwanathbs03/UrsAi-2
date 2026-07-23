"""Aggregator — collect every upstream engine's
payload in a single read pass.

The Finance engine is a *read-only* aggregator
on top of the existing analytical services. The
aggregator runs each *leaf* service once and
packages the result into a
:class:`FinanceBundle` the per-domain
builders consume.

The aggregator does NOT call the Scenario
Simulator, the Digital Twin endpoint, or the
OCR engine — those are user-facing endpoints,
not analytical leaf services. The Twin
*service* is a leaf (the aggregator invokes
its ``compute`` method directly).

Determinism
-----------

The aggregator is a pure function of the
``owner_id`` and the database state. Same
``owner_id`` + same DB → byte-identical bundle
(sans the upstream ``*_generated_at`` fields
the builders carry through).
"""

from __future__ import annotations

from typing import Any

from app.repositories.business_repository import BusinessRepository
from app.services.business_service import BusinessService
from app.services.dna import BusinessDNAService
from app.services.intelligence import IntelligenceService
from app.services.recommendations import RecommendationService
from app.services.roadmap import RoadmapService
from app.services.scoring import BusinessScoreService
from app.services.twin import TwinService

from app.services.finance.base import FinanceBundle


class FinanceAggregator:
    """One-pass upstream read for the Finance
    engine.

    The aggregator instantiates each existing
    service with the shared
    :class:`BusinessRepository` and calls its
    ``analyze`` / ``compute`` method once. The
    result is packaged into a
    :class:`FinanceBundle`."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._business = BusinessService(repo)
        self._intelligence = IntelligenceService(repo)
        self._scores = BusinessScoreService(repo)
        self._dna = BusinessDNAService(repo)
        self._recommendations = RecommendationService(repo)
        self._roadmap = RoadmapService(repo)
        self._twin = TwinService(repo)

    def collect(self, owner_id: int) -> FinanceBundle:
        """Read every upstream service once and
        return a :class:`FinanceBundle`.

        Raises :class:`BusinessNotFound` when
        the user has no Business Profile. The
        endpoint translates this to 404.
        """
        business = self._business.get_for_owner(owner_id)
        business_dump = business.model_dump()
        # The Pydantic business_dump does
        # not carry business_id / owner_id
        # by name; the aggregator reads them
        # off the Business row so the
        # inputs sidecar can echo them.
        orm_business = self._repo.get_by_owner(owner_id)
        business_id = int(getattr(orm_business, "id", 0) or 0)
        intelligence = self._intelligence.analyze(owner_id)
        scores = self._scores.compute(owner_id)
        dna = self._dna.compute(owner_id)
        recommendations = self._recommendations.compute(owner_id)
        roadmap = self._roadmap.compute(owner_id)
        twin = self._twin.compute(owner_id)
        return FinanceBundle(
            owner_id=owner_id,
            business_id=business_id,
            business=business_dump,
            business_summary=business_dump,
            intelligence=intelligence,
            scores=scores,
            dna=dna,
            rules={},  # recommendations service already merged rules
            recommendations=recommendations,
            roadmap=roadmap,
            twin=twin,
        )

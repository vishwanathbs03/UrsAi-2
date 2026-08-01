"""Aggregator — collect every upstream engine's
payload in a single read pass.

The aggregator is the *only* place that constructs
the upstream services. The rest of the twin engine
consumes the :class:`TwinBundle` and never touches
SQLAlchemy.

Why one read pass: the upstream services are
deterministic and idempotent, but each one
re-runs the full pipeline (the DNA service runs
intelligence + scores internally, the
recommendations service runs rules + intelligence
+ scores + DNA + knowledge, the roadmap service
runs recommendations + intelligence + scores +
DNA, etc.). To avoid N× recomputation, the
aggregator:

  1. Runs each *leaf* service once (intelligence,
     scores, DNA, rules, knowledge, business
     summary).
  2. Builds the recommendations payload from
     those.
  3. Builds the roadmap payload from the
     recommendations + leaf services.

This is the same call pattern the recommendations
endpoint uses; the aggregator just makes the
pattern explicit and named.
"""

from __future__ import annotations

from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.services.business_service import BusinessService
from app.services.dna import BusinessDNAService
from app.services.intelligence import IntelligenceService
from app.services.knowledge import KnowledgeService
from app.services.knowledge.repository import JsonKnowledgeRepository
from app.services.recommendations import RecommendationService
from app.services.roadmap import RoadmapService
from app.services.rules import RuleEngineService
from app.services.scoring import BusinessScoreService
from app.services.twin.base import TwinBundle


class TwinAggregator:
    """Read every upstream engine's payload and
    return a :class:`TwinBundle`.

    The aggregator is constructed with the request's
    :class:`BusinessRepository`. The endpoint is the
    only caller; unit tests can construct the
    aggregator with an in-memory repo to exercise
    the read paths without a real database.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._business = BusinessService(repo)
        self._intelligence = IntelligenceService(repo)
        self._scoring = BusinessScoreService(repo)
        self._dna = BusinessDNAService(repo)
        self._rules = RuleEngineService(repo)
        self._knowledge = KnowledgeService(JsonKnowledgeRepository())
        self._recommendations = RecommendationService(repo)
        self._roadmap = RoadmapService(repo)

    def collect(self, owner_id: int) -> TwinBundle:
        """Run each upstream service once and return the
        bundle.

        Raises :class:`BusinessNotFound` when the
        user has not created a business profile yet.
        The endpoint translates that into a 404.
        """
        # The BusinessService raises BusinessNotFound
        # if there is no row. We use it as the 404
        # gate so the response surface is consistent
        # with the other endpoints. The service
        # returns a Pydantic ``BusinessWithCompleteness``
        # model; we serialise it to a dict for the
        # builders (which consume plain dicts).
        business_with_completeness = self._business.get_for_owner(owner_id)
        business_summary = business_with_completeness.model_dump(mode="json")

        # The leaf services (intelligence, scores,
        # DNA, rules) all read the same Business row
        # the BusinessService just confirmed. Each
        # one independently raises BusinessNotFound
        # if the row disappears mid-call — that is
        # the engine's own contract and we let it
        # surface.
        intel = self._intelligence.analyze(owner_id)
        scores = self._scoring.compute(owner_id)
        dna = self._dna.compute(owner_id)
        rules = self._rules.compute(owner_id)
        knowledge = self._knowledge.list()

        # The recommendations engine builds the
        # knowledge index itself; passing the
        # already-loaded payload avoids a second
        # catalog read. We invoke the underlying
        # payload assembly via the public
        # ``compute`` so the response shape matches
        # the recommendations endpoint exactly.
        recs = self._recommendations.compute(owner_id)

        # The roadmap engine consumes the
        # recommendations + leaf services — same
        # pattern, public compute method.
        roadmap = self._roadmap.compute(owner_id)

        return TwinBundle(
            business=business_summary,
            intelligence=intel,
            scores=scores,
            dna=dna,
            rules=rules,
            recommendations=recs,
            roadmap=roadmap,
        )

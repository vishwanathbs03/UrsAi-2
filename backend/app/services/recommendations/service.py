"""Recommendation Intelligence Engine — service façade.

This is the *only* place the Recommendation Engine wires
its helpers together. The endpoint depends on this class;
the helpers in the sibling modules are private to the
package.

Architecture
------------

The engine is a **build-on-top** layer that consumes the
five existing analytical services. It does NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model

The five inputs are read via the existing services, all of
which are pure functions of the Business row in the
database. The output is a fresh list of
:class:`Recommendation` records plus a summary rollup.

Determinism contract
--------------------

Two calls with the same ``owner_id`` and the same
database state must produce byte-identical recommendations
(sans the response envelope's ``generated_at``). The
service does not cache, sample, or randomise. The
``generated_at`` is the only non-deterministic field on the
response and is explicitly excluded from any
two-call comparison the verifier runs.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.services.knowledge import KnowledgeService
from app.services.recommendations.base import (
    Priority,
    Recommendation,
    RuleSnapshot,
)
from app.services.recommendations.dependencies import build_knowledge_index
from app.services.recommendations.generator import generate
from app.services.recommendations.priorities import priority_weight


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #


class RecommendationService:
    """Generate the list of structured recommendations for the
    authenticated user's business profile.

    The service is constructed with a
    :class:`BusinessRepository` so it can be unit-tested
    with an in-memory session. The endpoint is the only
    other caller.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        # Build-on-top: the engine is a *consumer* of the
        # existing services, not a parallel re-deriver.
        # Each helper is constructed lazily to avoid the
        # circular import between services/knowledge and
        # the business repository.
        from app.services.dna import BusinessDNAService
        from app.services.intelligence import IntelligenceService
        from app.services.knowledge.repository import (
            JsonKnowledgeRepository,
        )
        from app.services.rules import RuleEngineService
        from app.services.scoring import BusinessScoreService

        self._repo = repo
        self._rules = RuleEngineService(repo)
        self._intelligence = IntelligenceService(repo)
        self._scoring = BusinessScoreService(repo)
        self._dna = BusinessDNAService(repo)
        self._knowledge = KnowledgeService(JsonKnowledgeRepository())

    # ---- Public API ---------------------------------------------------- #

    def compute(self, owner_id: int) -> dict:
        """Run the engine and return the response envelope.

        Raises :class:`BusinessNotFound` when the user has
        not created a business profile yet. The endpoint
        translates that into a 404.
        """
        # 1.  Pull the upstream payloads. Each call goes
        #     through the existing service module — no
        #     parallel re-derivation.
        if self._repo.get_by_owner(owner_id) is None:
            raise BusinessNotFound("No business profile to evaluate.")

        rules_payload = self._rules.compute(owner_id)
        intelligence_payload = self._intelligence.analyze(owner_id)
        scores_payload = self._scoring.compute(owner_id)
        dna_payload = self._dna.compute(owner_id)
        knowledge_payload = self._knowledge.list()

        # 2.  Flatten the rule firings into RuleSnapshots.
        snapshots = _flatten_firings(rules_payload)

        # 3.  Build the knowledge index once.
        knowledge_index = build_knowledge_index(knowledge_payload.get("articles", []))

        # 4.  Generate one Recommendation per snapshot.
        recommendations: list[Recommendation] = []
        for snap in snapshots:
            rec = generate(
                snap,
                all_rules=snapshots,
                knowledge=knowledge_index,
            )
            recommendations.append(rec)

        # 5.  Stable sort: by (priority_rank desc, business_impact desc, id asc).
        recommendations.sort(
            key=lambda r: (
                -priority_weight(r.priority),
                -r.business_impact,
                r.id,
            )
        )

        # 6.  Build the summary rollup.
        summary = _build_summary(recommendations)

        # 7.  Stitch the response envelope.
        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "inputs": {
                "rules_generated_at": rules_payload.get("generated_at"),
                "intelligence_generated_at": intelligence_payload.get("generated_at"),
                "scores_generated_at": scores_payload.get("generated_at"),
                "dna_generated_at": dna_payload.get("generated_at"),
                "knowledge_total_articles": int(knowledge_payload.get("total", 0)),
            },
            "summary": summary,
            "recommendations": [r.to_payload() for r in recommendations],
        }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _flatten_firings(rules_payload: dict) -> tuple[RuleSnapshot, ...]:
    """Convert the Rule Engine's grouped-by-category payload
    into a flat tuple of :class:`RuleSnapshot`.

    The grouping in the rules response is for the UI; the
    Recommendation Engine works on a flat list.
    """
    out: list[RuleSnapshot] = []
    for cat_block in (rules_payload.get("categories") or {}).values():
        if not cat_block or not isinstance(cat_block, dict):
            continue
        for firing in (cat_block.get("firings") or []):
            try:
                out.append(
                    RuleSnapshot(
                        id=str(firing["id"]),
                        title=str(firing.get("title", "")),
                        description=str(firing.get("description", "")),
                        category=firing["category"],
                        priority=firing["priority"],
                        reason=str(firing.get("reason", "")),
                        source_keys=tuple(firing.get("source_keys", ()) or ()),
                        estimated_impact=int(firing.get("estimated_impact", 0)),
                    )
                )
            except (KeyError, TypeError, ValueError):
                # Defensive: skip a malformed firing rather
                # than fail the whole engine. The Rule
                # Engine's own output is the contract.
                continue
    return tuple(out)


def _build_summary(recommendations: list[Recommendation]) -> dict:
    """Aggregate rollup for the response envelope."""
    crit = high = med = low = 0
    total_impact = 0
    total_score_gain = 0.0
    total_cost = 0
    total_roi = 0
    for r in recommendations:
        p: Priority = r.priority
        if p == "Critical":
            crit += 1
        elif p == "High":
            high += 1
        elif p == "Medium":
            med += 1
        else:
            low += 1
        total_impact += r.business_impact
        total_score_gain += r.estimated_score_gain
        total_cost += r.estimated_cost
        total_roi += r.estimated_roi
    return {
        "total_recommendations": len(recommendations),
        "critical_count": crit,
        "high_count": high,
        "medium_count": med,
        "low_count": low,
        "total_estimated_impact": min(100, total_impact),
        "total_estimated_score_gain": round(total_score_gain, 1),
        "total_estimated_cost": total_cost,
        "total_estimated_roi": min(100, total_roi),
    }

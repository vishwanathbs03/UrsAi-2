"""Rule Engine — façade that runs every rule and builds the API
response.

The engine is intentionally thin: it owns no rule logic. Each
rule in :mod:`app.services.rules.rules_*` is a plain
:class:`RuleDef` with a ``firer`` function. The engine's job
is to:

  1. Build the signal table from the three input payloads
     (intelligence, scores, DNA).
  2. Walk every rule, collect the firings.
  3. Group firings by category, sort by priority then impact,
     stamp the response with the time it was generated.

Output ordering within a category is by priority (Critical
first, then High, Medium, Low) and then by ``estimated_impact``
descending. The UI can rely on this ordering.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.services.rules.base import PRIORITIES, RuleFiring, RuleSignalMap
from app.services.rules.registry import rules_by_category
from app.services.rules.signal_extractor import extract


_PRIORITY_RANK = {p: i for i, p in enumerate(PRIORITIES)}  # Critical=0, High=1, ...


class RuleEngine:
    """Deterministic rule firing engine.

    The engine is stateless — every call to :meth:`evaluate`
    takes the signal table as input and returns a fresh list
    of firings. There is no per-call caching, no LLM, and no
    side effects.
    """

    def evaluate(self, sig: RuleSignalMap) -> list[RuleFiring]:
        """Run every rule and return all firings, sorted.

        Returned list is sorted by ``(category_order,
        priority_rank, -impact)`` so the UI can render the
        response in the order the spec defines.
        """
        by_cat = rules_by_category()
        cat_order = list(by_cat.keys())

        firings: list[RuleFiring] = []
        for cat in cat_order:
            for rule in by_cat[cat]:
                firing = rule.fire(sig)
                if firing is not None:
                    firings.append(firing)

        firings.sort(key=lambda f: (
            cat_order.index(f.category),
            _PRIORITY_RANK.get(f.priority, 99),
            -f.estimated_impact,
        ))
        return firings


# --------------------------------------------------------------------------- #
# Service façade
# --------------------------------------------------------------------------- #


class RuleEngineService:
    """Top-level façade for the Rule Engine.

    Pulls the three input payloads from the existing services
    (intelligence, scoring, DNA), builds the signal table,
    runs the engine, and stamps the response envelope.
    """

    def __init__(self, repo) -> None:
        # Avoid a hard import cycle: the service is constructed
        # with a BusinessRepository and the three sub-services
        # are instantiated here, in the same way the DNA
        # service does.
        from app.services.dna import BusinessDNAService
        from app.services.intelligence import IntelligenceService
        from app.services.scoring import BusinessScoreService

        self._repo = repo
        self._intelligence = IntelligenceService(repo)
        self._scoring = BusinessScoreService(repo)
        self._dna = BusinessDNAService(repo)
        self._engine = RuleEngine()

    def compute(self, owner_id: int) -> dict:
        if self._repo.get_by_owner(owner_id) is None:
            from app.repositories.business_repository import BusinessNotFound
            raise BusinessNotFound("No business profile to evaluate.")

        intelligence = self._intelligence.analyze(owner_id)
        scores = self._scoring.compute(owner_id)
        dna = self._dna.compute(owner_id)

        sig = extract(intelligence=intelligence, scores=scores, dna=dna)
        firings = self._engine.evaluate(sig)

        # Group by category for the API response. The eight
        # categories always appear, in spec order, even when a
        # category produced no firings.
        by_cat = rules_by_category()
        categories_out: dict[str, dict] = {}
        total_impact = 0
        for cat, rules in by_cat.items():
            cat_firings = [f for f in firings if f.category == cat]
            cat_firings.sort(key=lambda f: (_PRIORITY_RANK.get(f.priority, 99), -f.estimated_impact))
            total_impact += sum(f.estimated_impact for f in cat_firings)
            categories_out[cat] = {
                "firing_count": len(cat_firings),
                "rules_evaluated": len(rules),
                "firings": [f.to_payload() for f in cat_firings],
            }

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "inputs": {
                "intelligence_generated_at": intelligence.get("generated_at"),
                "scores_generated_at": scores.get("generated_at"),
                "dna_generated_at": dna.get("generated_at"),
            },
            "summary": {
                "total_firings": len(firings),
                "categories_with_firings": sum(1 for v in categories_out.values() if v["firing_count"] > 0),
                "categories_evaluated": len(by_cat),
                "total_estimated_impact": min(100, total_impact // max(1, len(by_cat))),
            },
            "categories": categories_out,
        }

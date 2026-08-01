"""CopilotContextBuilder — gather *only* the
upstream services the intent needs.

The spec says:

  "Build conversation context by consuming
   existing services. Use only what is required.
   ... Avoid unnecessary service calls."

The builder is a pure function over the
:class:`BusinessRepository` and the detected
intent. Each intent is mapped to a fixed set of
upstream services; the builder calls them in
order and returns a :class:`CopilotContext`.

The mapping mirrors the spec's intent-by-intent
examples:

  * ``EXPORT``        → scores, rules,
                        recommendations,
                        knowledge, roadmap
  * ``DNA``           → dna, scores,
                        recommendations
  * ``RULES``         → rules (only)
  * ``BUSINESS_SCORE``→ scores, dna
  * ``DIGITAL``       → scores, rules,
                        recommendations
  * ``COMPLIANCE``    → rules, recommendations,
                        knowledge
  * ``ROADMAP``       → recommendations,
                        roadmap
  * ``RECOMMENDATIONS``→ recommendations, rules
  * ``SCENARIO``      → recommendations,
                        roadmap, twin
  * ``OCR``           → knowledge, business
  * ``FINANCE``       → finance, recommendations
  * ``GENERAL_BUSINESS``→ scores, dna, rules
  * ``GREETING``      → (none; lightweight)
  * ``UNKNOWN``       → scores (one
                        engine, never zero — the
                        user can always ask for
                        their business score)

The builder never writes to the database. The
two-service-intent rule (the spec's
"RULES consumes Rule Engine only") is
preserved — :data:`_INTENT_SERVICES` is the
single source of truth.
"""

from __future__ import annotations

from app.repositories.business_repository import BusinessRepository
from app.services.copilot.base import (
    CopilotContext,
    IntentCategory,
    IntentResult,
)


# Single source of truth for the
# "which engines does this intent need?"
# decision. Adding a new intent means adding a
# row here; the rest of the engine reads the
# table.
_INTENT_SERVICES: dict[IntentCategory, tuple[str, ...]] = {
    # General intents — keep the call count
    # tight so a curious first message is fast.
    "GREETING":           (),
    "GENERAL_BUSINESS":   ("scores", "dna"),
    "BUSINESS_SCORE":     ("scores", "dna"),
    # Pillar-specific intents — pull the
    # pillar's lens score + the rules /
    # recommendations / knowledge / roadmap
    # that talk about it.
    "EXPORT":             (
        "scores", "rules", "recommendations",
        "knowledge", "roadmap",
    ),
    "DIGITAL":            (
        "scores", "rules", "recommendations",
        "roadmap",
    ),
    "COMPLIANCE":         (
        "scores", "rules", "recommendations",
        "knowledge",
    ),
    # DNA / DNA-adjacent.
    "DNA":                ("dna", "scores", "recommendations"),
    # Execution / actions.
    "ROADMAP":            ("recommendations", "roadmap", "scores"),
    "RECOMMENDATIONS":    ("recommendations", "rules", "scores"),
    "RULES":              ("rules",),  # spec: Rule Engine only
    # Composite / future-milestone intents.
    "SCENARIO":           ("recommendations", "roadmap", "scores", "dna"),
    "OCR":                ("knowledge", "business"),
    "FINANCE":            ("recommendations", "scores", "dna"),
    # Fallback — keep the user unblocked.
    "UNKNOWN":            ("scores",),
}


class CopilotContextBuilder:
    """Build a :class:`CopilotContext` for the
    detected intent.

    The builder depends on a
    :class:`BusinessRepository` so it can be
    unit-tested with an in-memory session. It
    is the *only* place the Copilot calls
    upstream services; the orchestrator and
    provider never touch the repo directly.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    def build(
        self,
        *,
        owner_id: int,
        intent: IntentResult,
    ) -> CopilotContext:
        """Run the services mapped to ``intent``
        and return a :class:`CopilotContext`.

        Raises :class:`BusinessNotFound` when the
        user has not created a business profile
        yet. The endpoint translates that into a
        404.
        """
        if self._repo.get_by_owner(owner_id) is None:
            from app.repositories.business_repository import (
                BusinessNotFound,
            )
            raise BusinessNotFound(
                "No business profile to consult on."
            )

        services = _INTENT_SERVICES.get(
            intent.category, ("scores",)
        )
        # Pull every required service. Each
        # helper tolerates upstream errors by
        # returning ``None`` so a single broken
        # service does not blank the whole
        # response.
        scores = self._scores(owner_id) if "scores" in services else None
        rules = self._rules(owner_id) if "rules" in services else None
        recs = (
            self._recommendations(owner_id)
            if "recommendations" in services
            else None
        )
        roadmap = (
            self._roadmap(owner_id)
            if "roadmap" in services
            else None
        )
        dna = self._dna(owner_id) if "dna" in services else None
        knowledge = (
            self._knowledge()
            if "knowledge" in services
            else None
        )
        # finance + twin are not part of Sprint
        # 6 — left as future hooks. The Copilot
        # never calls them in this milestone.
        finance: dict | None = None
        twin: dict | None = None
        business = (
            self._business(owner_id)
            if "business" in services
            else None
        )

        return CopilotContext(
            business_id=owner_id,
            intent=intent.category,
            intent_confidence=intent.confidence,
            services_used=tuple(services),
            scores=scores,
            rules=rules,
            recommendations=recs,
            roadmap=roadmap,
            dna=dna,
            knowledge=knowledge,
            finance=finance,
            twin=twin,
            business=business,
            # Pre-compute counters the provider
            # templates will need.
            recommendations_count=_count_recommendations(recs),
            rules_count=_count_rules(rules),
            roadmap_count=_count_roadmap(roadmap),
            knowledge_count=_count_knowledge(knowledge),
            score_keys=_collect_score_keys(scores),
        )

    # ------------------------------------------------------------------ #
    # Upstream service wrappers — every
    # helper returns ``None`` on failure so the
    # pipeline stays live when one engine is
    # in a bad state.
    # ------------------------------------------------------------------ #

    def _scores(self, owner_id: int) -> dict | None:
        from app.services.scoring import BusinessScoreService
        try:
            return BusinessScoreService(self._repo).compute(owner_id)
        except Exception:
            return None

    def _rules(self, owner_id: int) -> dict | None:
        from app.services.rules import RuleEngineService
        try:
            return RuleEngineService(self._repo).compute(owner_id)
        except Exception:
            return None

    def _recommendations(self, owner_id: int) -> dict | None:
        from app.services.recommendations import RecommendationService
        try:
            return RecommendationService(self._repo).compute(owner_id)
        except Exception:
            return None

    def _roadmap(self, owner_id: int) -> dict | None:
        from app.services.roadmap import RoadmapService
        try:
            return RoadmapService(self._repo).compute(owner_id)
        except Exception:
            return None

    def _dna(self, owner_id: int) -> dict | None:
        from app.services.dna import BusinessDNAService
        try:
            return BusinessDNAService(self._repo).compute(owner_id)
        except Exception:
            return None

    def _knowledge(self) -> dict | None:
        # The knowledge service does not need a
        # DB session. Reuse the endpoint's
        # singleton repository so we get the
        # same instance the /knowledge endpoint
        # would have returned.
        from app.api.v1.endpoints.knowledge import _get_repository
        from app.services.knowledge import KnowledgeService
        try:
            return KnowledgeService(_get_repository()).list()
        except Exception:
            return None

    def _business(self, owner_id: int) -> dict | None:
        # Read the business row so the OCR
        # intent can hint at what is on file.
        # The BusinessService returns a
        # Pydantic-shaped dict (with a
        # ``meta`` block) — keep it raw.
        from app.services.business_service import BusinessService
        try:
            biz = BusinessService(self._repo).get_for_owner(owner_id)
            return biz.model_dump() if hasattr(biz, "model_dump") else dict(biz)
        except Exception:
            return None


# --------------------------------------------------------------------------- #
# Counter helpers
# --------------------------------------------------------------------------- #


def _count_recommendations(recs: dict | None) -> int:
    if not recs:
        return 0
    return len(recs.get("recommendations") or [])


def _count_rules(rules: dict | None) -> int:
    if not rules:
        return 0
    # The rules payload groups by category.
    cats = rules.get("categories") or {}
    if not isinstance(cats, dict):
        return 0
    return sum(
        len(((block or {}).get("firings") or []))
        for block in cats.values()
    )


def _count_roadmap(roadmap: dict | None) -> int:
    if not roadmap:
        return 0
    return len(roadmap.get("items") or [])


def _count_knowledge(knowledge: dict | None) -> int:
    if not knowledge:
        return 0
    # knowledge payload uses ``count`` and
    # ``total``; the articles list is the
    # canonical source.
    return len(knowledge.get("articles") or [])


def _collect_score_keys(scores: dict | None) -> tuple[str, ...]:
    if not scores:
        return ()
    out: list[str] = []
    for s in scores.get("scores") or []:
        if isinstance(s, dict):
            key = s.get("key")
            if key:
                out.append(str(key))
    return tuple(out)

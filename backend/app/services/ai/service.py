"""AIDecisionService — façade the endpoint depends on.

The service is thin: it composes ContextBuilder, PromptBuilder,
the LLM provider, and ResponseParser, then wraps the
:class:`AIDecision` in the response envelope. It does not
implement the AI itself; it only wires the four pieces
together.

Swapping the provider is a one-line change in
:meth:`AIDecisionService.__init__` (or, more typically, in the
endpoint's dependency-injection factory).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import BusinessRepository
from app.services.ai.base import (
    AIDecision,
    AIProviderError,
    LLMProvider,
)
from app.services.ai.context_builder import ContextBuilder
from app.services.ai.mock_provider import MockLLMProvider
from app.services.ai.prompt_builder import PromptBuilder
from app.services.ai.response_parser import ResponseParser
from app.services.dna import BusinessDNAService
from app.services.intelligence import IntelligenceService
from app.services.knowledge import KnowledgeService
from app.services.rules import RuleEngineService
from app.services.scoring import BusinessScoreService


class AIDecisionService:
    """Top-level façade for the AI Decision Engine.

    The service depends on the four upstream services + the
    knowledge repository + an :class:`LLMProvider`. For this
    milestone the provider is :class:`MockLLMProvider`.
    """

    def __init__(
        self,
        repo: BusinessRepository,
        *,
        provider: LLMProvider | None = None,
    ) -> None:
        self._repo = repo
        self._intelligence = IntelligenceService(repo)
        self._scoring = BusinessScoreService(repo)
        self._dna = BusinessDNAService(repo)
        self._rules = RuleEngineService(repo)

        # The knowledge service does not need a DB; its
        # repository is the JSON catalog. Build a single
        # process-wide instance for the same reason the
        # /knowledge endpoint does.
        from app.api.v1.endpoints.knowledge import _get_repository
        self._knowledge = KnowledgeService(_get_repository())

        self._context_builder = ContextBuilder(
            rule_service=self._rules,
            knowledge_service=self._knowledge,
        )
        self._prompt_builder = PromptBuilder()
        self._parser = ResponseParser()
        self._provider: LLMProvider = provider or MockLLMProvider()

    @property
    def provider_name(self) -> str:
        return self._provider.name

    # ---- public API -------------------------------------------------------- #

    def compute(self, owner_id: int) -> dict:
        if self._repo.get_by_owner(owner_id) is None:
            from app.repositories.business_repository import BusinessNotFound
            raise BusinessNotFound("No business profile to evaluate.")

        intelligence = self._intelligence.analyze(owner_id)
        scores = self._scoring.compute(owner_id)
        dna = self._dna.compute(owner_id)
        rules = self._rules.compute(owner_id)

        context = self._context_builder.build(
            owner_id=owner_id,
            intelligence=intelligence,
            scores=scores,
            dna=dna,
        )
        prompt = self._prompt_builder.build(context)
        try:
            response = self._provider.complete(prompt)
        except AIProviderError:
            raise
        decision = self._parser.parse(response)

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "inputs": {
                "intelligence_generated_at": intelligence.get("generated_at"),
                "scores_generated_at": scores.get("generated_at"),
                "dna_generated_at": dna.get("generated_at"),
                "rules_generated_at": rules.get("generated_at"),
                "model": self._provider.name,
            },
            "context": {
                "business_id": context.business_id,
                "archetype": {
                    "key": context.archetype_key,
                    "title": context.archetype_title,
                    "match_score": context.archetype_match_score,
                },
                "intelligence_overall": context.intelligence_overall,
                "scores": [
                    {
                        "key": s.key, "title": s.title,
                        "score": s.score, "level": s.level,
                    }
                    for s in context.scores
                ],
                "rules": [
                    {
                        "id": r.id, "title": r.title, "category": r.category,
                        "priority": r.priority,
                        "estimated_impact": r.estimated_impact,
                        "reason": r.reason,
                    }
                    for r in context.rules
                ],
                "knowledge": [
                    {
                        "id": a.id, "title": a.title, "topic": a.topic,
                        "category": a.category, "summary": a.summary,
                        "relevance": a.relevance,
                    }
                    for a in context.knowledge
                ],
            },
            "decision": {
                "summary": decision.summary,
                "archetype_label": decision.archetype_label,
                "overall_health": decision.overall_health,
                "top_strengths": list(decision.top_strengths),
                "top_risks": list(decision.top_risks),
                "insights": [
                    {
                        "id": i.id, "title": i.title,
                        "explanation": i.explanation,
                        "category": i.category,
                        "priority": i.priority,
                        "confidence": i.confidence,
                        "supporting_rule_ids": list(i.supporting_rule_ids),
                        "supporting_article_ids": list(i.supporting_article_ids),
                    }
                    for i in decision.insights
                ],
            },
        }

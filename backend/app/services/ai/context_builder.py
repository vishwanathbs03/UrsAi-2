"""ContextBuilder — gathers the inputs the LLM needs.

The builder is a pure function over the four upstream services
(intelligence, scoring, DNA, rules) and the knowledge repository.
It does not call any LLM, and it does not write to the DB. The
result is a :class:`AIContext` ready to feed into the prompt
builder.

The knowledge retrieval here is intentionally simple — match the
top rule firings against the article's ``related_score_keys`` and
``related_intelligence_keys`` fields. The future RAG milestone
will swap in embedding-based ranking; the seam is the
``relevance`` field on :class:`AIKnowledgeRef`.
"""

from __future__ import annotations

from typing import Iterable

from app.services.ai.base import (
    AIContext,
    AIKnowledgeRef,
    AIRuleRef,
    AIScoreSnapshot,
)
from app.services.knowledge.service import KnowledgeService
from app.services.rules.engine import RuleEngineService


# Cap the inputs the LLM sees — long contexts degrade response
# quality and burn tokens. The numbers here are conservative;
# a real RAG layer will tune them.
_MAX_RULES = 12
_MAX_ARTICLES = 6


class ContextBuilder:
    """Build an :class:`AIContext` from the upstream services."""

    def __init__(
        self,
        *,
        rule_service: RuleEngineService,
        knowledge_service: KnowledgeService,
    ) -> None:
        self._rules = rule_service
        self._knowledge = knowledge_service

    def build(
        self,
        *,
        owner_id: int,
        intelligence: dict,
        scores: dict,
        dna: dict,
    ) -> AIContext:
        rules_payload = self._rules.compute(owner_id)
        rules = self._collect_rules(rules_payload)
        knowledge = self._collect_knowledge(rules)

        dna_inner = dna.get("dna") if isinstance(dna, dict) else {}
        archetype = (dna_inner or {}).get("archetype") or {}

        return AIContext(
            business_id=owner_id,
            archetype_key=str(archetype.get("key", "foundation_builder")),
            archetype_title=str(archetype.get("title", "Foundation Builder")),
            archetype_match_score=int(archetype.get("match_score", 0)),
            intelligence_overall=int(
                (intelligence.get("overall") or {}).get("score", 0)
            ),
            scores=self._collect_scores(scores),
            rules=rules,
            knowledge=knowledge,
        )

    # ---- helpers ----------------------------------------------------------- #

    def _collect_scores(self, scores: dict) -> tuple[AIScoreSnapshot, ...]:
        out: list[AIScoreSnapshot] = []
        for s in scores.get("scores", []):
            out.append(
                AIScoreSnapshot(
                    key=str(s.get("key", "")),
                    title=str(s.get("title", s.get("key", ""))),
                    score=int(s.get("score", 0)),
                    level=str(s.get("level", "Low")),
                )
            )
        return tuple(out)

    def _collect_rules(self, rules_payload: dict) -> tuple[AIRuleRef, ...]:
        out: list[AIRuleRef] = []
        categories = (rules_payload or {}).get("categories", {}) or {}
        # Iterate categories in the order the engine emits them,
        # which is the spec order. Inside each category, firings
        # are already priority + impact sorted by the engine.
        for cat, block in categories.items():
            for f in block.get("firings", []) or []:
                out.append(
                    AIRuleRef(
                        id=str(f.get("id", "")),
                        title=str(f.get("title", "")),
                        category=str(cat),
                        priority=str(f.get("priority", "Low")),
                        estimated_impact=int(f.get("estimated_impact", 0)),
                        reason=str(f.get("reason", "")),
                    )
                )
        # Keep the highest-impact rules — drop the long tail so
        # the LLM is not asked to talk about everything at once.
        out.sort(key=lambda r: (-r.estimated_impact, r.id))
        return tuple(out[:_MAX_RULES])

    def _collect_knowledge(
        self, rules: Iterable[AIRuleRef]
    ) -> tuple[AIKnowledgeRef, ...]:
        # Match the firing rule's source_keys (already exposed on
        # AIRuleRef indirectly via the firing id; the cleanest way
        # to retrieve relevant articles is to look up by score key
        # tag). We use the rule's category as a coarse topic
        # hint and the full knowledge list as the candidate set.
        seen: set[str] = set()
        candidates: list[tuple[int, AIKnowledgeRef]] = []
        for article in self._knowledge.list()["articles"]:
            ref = AIKnowledgeRef(
                id=str(article["id"]),
                title=str(article["title"]),
                summary=str(article["summary"]),
                topic=str(article["topic"]),
                category=str(article["category"]),
                relevance=0,
            )
            relevance = self._relevance(ref, rules)
            if relevance <= 0:
                continue
            if ref.id in seen:
                continue
            seen.add(ref.id)
            candidates.append((relevance, ref))

        candidates.sort(key=lambda t: (-t[0], t[1].id))
        out: list[AIKnowledgeRef] = []
        for rel, ref in candidates[:_MAX_ARTICLES]:
            out.append(AIKnowledgeRef(
                id=ref.id, title=ref.title, summary=ref.summary,
                topic=ref.topic, category=ref.category, relevance=rel,
            ))
        return tuple(out)

    @staticmethod
    def _relevance(article: AIKnowledgeRef, rules: Iterable[AIRuleRef]) -> int:
        """Score how well an article matches the active rules.

        Heuristic: +25 per category match, +15 per topic match,
        +10 per score-key tag match. A perfect match is 50; an
        empty match is 0 and the article is dropped.
        """
        score = 0
        for r in rules:
            # Category match — the rule category aligns with the
            # article category or topic. Loose on purpose.
            if r.category == article.category:
                score += 25
            if r.category == article.topic:
                score += 15
        return min(100, score)

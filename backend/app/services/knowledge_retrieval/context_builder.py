"""KnowledgeContextBuilder - Sprint 7 Part 4.

Builds the :class:`KnowledgeContext` envelope. The
envelope has three consumers:

  1. The chat service renders the citations into the
     assistant's ``ChatMessage.sources``.
  2. The chat service appends the articles' titles +
     snippets into the prompt the provider receives (the
     existing Sprint 7 Part 2 ``AssistantProviderService``
     keeps the prompt surface; this builder hands the
     service the fragments in a stable shape).
  3. The verifier asserts the envelope is deterministic
     across two calls.

No duplicates
-------------

The builder is a pure projection: it consumes the
:class:`RankedArticle` list and the
``KnowledgeService`` repository. It does not re-score
articles, deduplicate text, or call any LLM.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.services.knowledge.base import Article
from app.services.knowledge.service import KnowledgeService
from app.services.knowledge_retrieval.base import (
    Citation,
    KnowledgeContext,
    RankedArticle,
)
from app.services.knowledge_retrieval.citation_builder import CitationBuilder


class KnowledgeContextBuilder:
    """Assemble the final :class:`KnowledgeContext`."""

    def __init__(
        self,
        knowledge_service: KnowledgeService,
        citation_builder: CitationBuilder | None = None,
    ) -> None:
        self._knowledge = knowledge_service
        self._citations = citation_builder or CitationBuilder()

    def build(
        self,
        *,
        query: str,
        ranked: tuple[RankedArticle, ...],
        total_candidates: int,
    ) -> KnowledgeContext:
        # Reverse-lookup the article objects referenced by
        # the ranked list. Reuse the existing KnowledgeService
        # repository so we never load the JSON catalog twice.
        articles_by_id = {
            a.id: a
            for a in self._knowledge._repo.list_articles()  # type: ignore[attr-defined]
        }
        ranked_articles: tuple[Article, ...] = tuple(
            articles_by_id[r.article_id] for r in ranked if r.article_id in articles_by_id
        )
        citations: tuple[Citation, ...] = tuple(
            self._citations.build(article) for article in ranked_articles
        )
        return KnowledgeContext(
            query=query,
            ranked=ranked,
            citations=citations,
            articles=tuple(a.to_payload() for a in ranked_articles),
            total_candidates=total_candidates,
            generated_at=datetime.now(tz=timezone.utc).isoformat(),
        )
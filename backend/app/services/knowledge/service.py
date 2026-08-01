"""Knowledge service — façade that the endpoint depends on.

The service is intentionally thin. It owns the filter rules
(topic / category / tag) and the deterministic ordering. There is
no scoring, no ranking, no LLM — the spec is explicit: this is a
retrieval layer for future RAG, not a recommendation engine.

Filter semantics (matters for the API contract):
  * ``topic`` — exact match, case-insensitive.
  * ``category`` — exact match, case-insensitive.
  * ``tag`` — repeated query param allowed; an article is included
    if it has at least one of the requested tags (OR).
  * When multiple filters are supplied, they are AND-combined.
  * Unknown filter values return an empty list, not an error —
    the caller is asking a question, the answer is "no".

Output ordering: id-sorted (same as the repository's
``list_articles()``). Two calls with the same filters must
produce byte-identical payloads minus ``generated_at``.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.services.knowledge.base import (
    KnowledgeArticleNotFound,
    KnowledgeRepositoryBase,
)


class KnowledgeService:
    """Read-only retrieval façade over a :class:`KnowledgeRepositoryBase`."""

    def __init__(self, repository: KnowledgeRepositoryBase) -> None:
        self._repo = repository

    # ---- Public API -------------------------------------------------------- #

    def list(
        self,
        *,
        topic: str | None = None,
        category: str | None = None,
        tags: list[str] | None = None,
    ) -> dict:
        """List articles, optionally filtered by topic / category / tags.

        Returns the response envelope (generated_at, filters echo,
        count, articles). The endpoint does not need to do anything
        else with the result.
        """
        topic_n = topic.strip().lower() if topic else None
        category_n = category.strip().lower() if category else None
        tags_n = sorted({t.strip().lower() for t in (tags or []) if t and t.strip()})

        all_articles = self._repo.list_articles()
        filtered = [
            a
            for a in all_articles
            if (topic_n is None or a.topic.lower() == topic_n)
            and (category_n is None or a.category.lower() == category_n)
            and (
                not tags_n
                or any(t in {tag.lower() for tag in a.tags} for t in tags_n)
            )
        ]

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "filters": {
                "topic": topic_n,
                "category": category_n,
                "tags": tags_n,
            },
            "count": len(filtered),
            "total": len(all_articles),
            "articles": [a.to_payload() for a in filtered],
        }

    def get(self, article_id: str) -> dict:
        """Fetch a single article by id, or raise :class:`KnowledgeArticleNotFound`."""
        article = self._repo.get_article(article_id)
        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "article": article.to_payload(),
        }

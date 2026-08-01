"""Ranker - Sprint 7 Part 4.

Takes the output of :class:`KnowledgeRetriever` and
returns the top-k articles in deterministic order.

Determinism
-----------

Two-phase sort:

  1. score descending
  2. article_id ascending (tie-breaker)

The ranker's output is a tuple of :class:`RankedArticle`
records with 1-based ranks. Two calls with the same
scored input produce the same output.
"""
from __future__ import annotations

from app.services.knowledge_retrieval.base import (
    RankedArticle,
    ScoredArticle,
)


class Ranker:
    """Deterministic top-k ranker."""

    def __init__(self, *, top_k: int = 3) -> None:
        self._top_k = max(0, int(top_k))

    def rank(
        self,
        scored: tuple[ScoredArticle, ...],
    ) -> tuple[RankedArticle, ...]:
        if not scored or self._top_k == 0:
            return ()
        # Sort by score desc, then article_id asc. The
        # tuple stabilises the sort for free.
        sorted_articles = sorted(
            scored,
            key=lambda s: (-s.score, s.article_id),
        )
        top = sorted_articles[: self._top_k]
        return tuple(
            RankedArticle(
                rank=idx + 1,
                article_id=s.article_id,
                score=s.score,
                matched_tokens=s.matched_tokens,
                matched_tags=s.matched_tags,
            )
            for idx, s in enumerate(top)
        )
"""KnowledgeRetriever - Sprint 7 Part 4.

Scores every article in the local catalog against the
user query. Pure Python, no embeddings, no external
search. Two calls with the same query + same catalog +
same owner-context return the same scored list.

Scoring blend
-------------

For each article we compute:

  base_score     =  sum of (1.0)         for every query
                                            token that
                                            appears in
                                            title + sum
                                            of (1.0) for
                                            every query
                                            token that
                                            appears in
                                            keywords.

  body_score     =  0.25 * count of
                    query tokens in body
                    (capped at 1.0 to keep
                    long bodies from
                    dominating).

  tag_score      =  2.0 * count of
                    query tokens that
                    match an article
                    tag verbatim.

  category_score =  1.5 when the category
                    string contains any
                    query token.

  summary_score  =  0.5 * count of
                    query tokens in the
                    summary.

  boosting       =  2.0 if the article's
                    related_score_keys
                    intersect the
                    owner's low-readiness
                    score keys; 1.5 if
                    related_intelligence_keys
                    intersect the
                    owner's recommendation
                    categories.

Final score = base + body + tag + category + summary
             + boosting.

All tokens are normalised: lowercase, alphanumeric,
length >= 2. Stopwords are filtered (see
``_STOPWORDS``). This keeps the score signal
focused on content-bearing words.
"""
from __future__ import annotations

from typing import Iterable

from app.services.knowledge.base import Article
from app.services.knowledge_retrieval.base import ScoredArticle


# Compact English stopword list. Kept short on purpose:
# domain terms that overlap with stopwords (e.g. "in",
# "to" inside "intro to export") still contribute via
# the tag / category boosts, not the body token match.
_STOPWORDS: frozenset[str] = frozenset({
    "a", "an", "and", "are", "as", "at", "be", "but",
    "by", "do", "for", "from", "has", "have", "he",
    "her", "his", "i", "if", "in", "is", "it", "its",
    "of", "on", "or", "our", "she", "so", "than",
    "that", "the", "their", "they", "this", "to",
    "us", "was", "we", "were", "what", "when", "where",
    "which", "who", "why", "will", "with", "you",
    "your", "yours", "me", "my", "him",
})


def tokenize(text: str) -> tuple[str, ...]:
    """Normalise a free-text string into a tuple of
    lowercased alpha tokens, length >= 2, stopwords removed.

    The tokeniser is deliberately simple: it splits on
    any non-alphanumeric character, lowercases, drops
    short tokens, and drops stopwords. Two inputs that
    differ only in punctuation / case produce the same
    token sequence.
    """
    if not text:
        return ()
    out: list[str] = []
    buf: list[str] = []
    for ch in text:
        if ch.isalnum():
            buf.append(ch)
        else:
            if buf:
                tok = "".join(buf).lower()
                if len(tok) >= 2 and tok not in _STOPWORDS:
                    out.append(tok)
                buf = []
    if buf:
        tok = "".join(buf).lower()
        if len(tok) >= 2 and tok not in _STOPWORDS:
            out.append(tok)
    return tuple(out)


class KnowledgeRetriever:
    """Score every article in the catalog against the query.

    The retriever is **stateless** and **side-effect free**.
    Construct one per request (cheap) or reuse one across
    requests (also fine).
    """

    def __init__(self, articles: Iterable[Article]) -> None:
        # Materialise once so list_articles() is called once
        # per request, not per article per request.
        self._articles: tuple[Article, ...] = tuple(articles)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def score(
        self,
        *,
        query: str,
        owner_context: dict | None = None,
    ) -> tuple[ScoredArticle, ...]:
        """Score every article against ``query``.

        ``owner_context`` is the optional second input that
        produces the per-business boost. It is a plain dict
        with optional keys:

          * ``low_score_keys`` — tuple of score keys the
            owner scores low on (Twin ``health_summary.scores``
            filtered to level="Low").
          * ``recommendation_categories`` — tuple of
            categories the owner's recommendations fall
            into.

        Passing ``None`` (or ``{}``) skips the boost branch.
        Two calls with the same ``query`` and ``owner_context``
        return the same list of :class:`ScoredArticle`.
        """
        q_tokens = tokenize(query)
        if not q_tokens:
            return ()
        q_set = set(q_tokens)
        # Pre-compute the owner's boost keys.
        low_score_keys = set(
            (owner_context or {}).get("low_score_keys") or ()
        )
        rec_categories = set(
            (owner_context or {}).get("recommendation_categories") or ()
        )

        out: list[ScoredArticle] = []
        for article in self._articles:
            score, matched_tokens, matched_tags = self._score_one(
                article, q_tokens, q_set,
                low_score_keys=low_score_keys,
                rec_categories=rec_categories,
            )
            if score > 0.0:
                out.append(ScoredArticle(
                    article_id=article.id,
                    score=score,
                    matched_tokens=matched_tokens,
                    matched_tags=matched_tags,
                ))
        return tuple(out)

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    def _score_one(
        self,
        article: Article,
        q_tokens: tuple[str, ...],
        q_set: set[str],
        *,
        low_score_keys: set[str],
        rec_categories: set[str],
    ) -> tuple[float, tuple[str, ...], tuple[str, ...]]:
        # Match in title + keywords (full weight)
        title_tokens = set(tokenize(article.title))
        keyword_set = {t.lower() for t in article.keywords}
        tag_set = {t.lower() for t in article.tags}
        summary_tokens = set(tokenize(article.summary))
        body_tokens = set(tokenize(article.body))
        category_tokens = set(tokenize(article.category))
        # topic is a single string but could be multi-word
        topic_tokens = set(tokenize(article.topic))

        all_token_pool = title_tokens | keyword_set | summary_tokens | body_tokens | category_tokens | topic_tokens

        # Tokens that matched in content (title/keywords/summary/body)
        matched_content_tokens = tuple(sorted(t for t in q_set if t in all_token_pool))
        if not matched_content_tokens and not any(
            t in tag_set for t in q_set
        ):
            # Zero-token overlap: not a candidate.
            return 0.0, (), ()

        score = 0.0
        # base = title + keywords
        score += 1.0 * sum(
            1 for t in q_tokens if t in title_tokens or t in keyword_set
        )
        # body (capped at 1.0)
        body_matches = sum(1 for t in q_tokens if t in body_tokens)
        score += min(1.0, 0.25 * body_matches)
        # summary
        score += 0.5 * sum(1 for t in q_tokens if t in summary_tokens)
        # category
        score += 1.5 * sum(1 for t in q_tokens if t in category_tokens)
        # tag
        matched_tags = tuple(sorted(t for t in q_set if t in tag_set))
        score += 2.0 * len(matched_tags)

        # Per-business boost. The tuning is intentionally
        # shallow: the assistant is allowed to surface
        # generic articles when the owner-context boost
        # does not pick a winner.
        if low_score_keys and any(
            k.lower() in low_score_keys for k in article.related_score_keys
        ):
            score += 2.0
        if rec_categories and any(
            c.lower() in rec_categories
            for c in article.related_intelligence_keys
        ):
            score += 1.5

        return score, matched_content_tokens, matched_tags
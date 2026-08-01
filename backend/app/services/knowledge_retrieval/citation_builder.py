"""CitationBuilder - Sprint 7 Part 4.

Builds :class:`Citation` records for every article that
the ranker kept. The citation is the UI-facing struct
the chat service stores alongside the assistant's reply
and the message bubble shows under the body.

Mapping rules
-------------

  source_category : Knowledge is the default. The article
                    category / topic may push it to:
                    "Rule", "Recommendation",
                    "GovernmentScheme", or "Glossary".
                    See :meth:`_classify_source` for the
                    exact rules.

  reference       : "topic:<topic> · category:<category>"
                    Stable identifier the UI can use to
                    route to a deeper article page.

  snippet         : A short excerpt (max 120 chars) of the
                    article summary, on the matched tokens
                    if possible. We never embed the whole
                    body in the citation.

  detail          : The human-readable label the UI shows
                    in the message bubble. Falls back to
                    the title when the summary is empty.
"""
from __future__ import annotations

from app.services.knowledge.base import Article
from app.services.knowledge_retrieval.base import Citation, SourceCategory


class CitationBuilder:
    """Build one :class:`Citation` per article."""

    def build(self, article: Article) -> Citation:
        return Citation(
            article_id=article.id,
            title=article.title,
            source_category=_classify_source(article),
            reference=f"topic:{article.topic} · category:{article.category}",
            snippet=_snippet(article.summary or article.body),
            detail=_detail(article),
        )


def _classify_source(article: Article) -> SourceCategory:
    """Decide which source_category the article belongs to.

    The mapping is deliberately coarse — the article body
    never needs to be parsed. The article's category +
    topic is enough to bucket it.
    """
    topic = (article.topic or "").lower()
    category = (article.category or "").lower()
    tags = " ".join(t.lower() for t in article.tags)

    if "government" in topic or "scheme" in category or "scheme" in tags:
        return "GovernmentScheme"
    if "rule" in category or "rule" in tags:
        return "Rule"
    if "recommendation" in category or "recommendation" in tags:
        return "Recommendation"
    if "glossary" in category or topic == "glossary":
        return "Glossary"
    return "Knowledge"


def _snippet(text: str, *, max_chars: int = 120) -> str:
    """Return a short, single-line excerpt of ``text``.

    The snippet is summary-first; the body is the fallback
    when the summary is empty. The output is always
    <= ``max_chars`` characters and never contains a
    newline.
    """
    if not text:
        return ""
    flat = " ".join(text.split())
    if len(flat) <= max_chars:
        return flat
    return flat[: max_chars - 1].rstrip() + "…"


def _detail(article: Article) -> str:
    """Human-readable label the UI can show in the bubble.

    Format: ``"{title} ({topic})"`` when the topic adds
    info, otherwise just the title. Kept short.
    """
    topic = (article.topic or "").strip()
    if not topic or topic.lower() == "general":
        return article.title
    return f"{article.title} ({topic})"
"""Shared types for the Knowledge Layer.

The article model is intentionally narrow: only the fields the
spec actually requires (id, topic, category, tags) plus a few
metadata fields that make the response useful (title, summary,
keywords, body, related keys, source, created_at).

Why narrow:
  * The schema is the contract. Adding fields here that the
    service does not surface is dead weight.
  * Future milestones (RAG) will add embeddings, but they will
    live in a separate column / file, not on this dataclass.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


# Default location of the JSON-backed catalog. Lives next to the
# package so it ships with the source tree and is easy to find
# during code review.
DEFAULT_CATALOG_PATH: Path = Path(__file__).resolve().parents[2] / "data" / "knowledge_catalog.json"


@dataclass(frozen=True)
class Article:
    """A single knowledge article.

    All fields are plain data — no ORM, no LLM, no embeddings.
    ``related_score_keys`` and ``related_intelligence_keys`` are
    the cross-references the future RAG / recommendation layers
    will use to pick articles that match a user's profile.
    """

    id: str
    topic: str
    category: str
    tags: tuple[str, ...]
    title: str
    summary: str
    keywords: tuple[str, ...] = field(default_factory=tuple)
    body: str = ""
    related_score_keys: tuple[str, ...] = field(default_factory=tuple)
    related_intelligence_keys: tuple[str, ...] = field(default_factory=tuple)
    source: str | None = None
    created_at: str = ""

    def to_payload(self) -> dict:
        """JSON-friendly dict for the API response."""
        return {
            "id": self.id,
            "topic": self.topic,
            "category": self.category,
            "tags": list(self.tags),
            "title": self.title,
            "summary": self.summary,
            "keywords": list(self.keywords),
            "body": self.body,
            "related_score_keys": list(self.related_score_keys),
            "related_intelligence_keys": list(self.related_intelligence_keys),
            "source": self.source,
            "created_at": self.created_at,
        }


class KnowledgeArticleNotFound(Exception):
    """Raised by the repository when an article id does not exist.

    The endpoint translates this into a 404. Defined here so the
    service / repository layer does not have to import FastAPI.
    """


class KnowledgeRepositoryBase:
    """Abstract repository interface.

    The service depends on this so a future milestone can swap in
    a SQLite / Postgres / vector-store backend without touching
    the service or the endpoint.
    """

    def list_articles(self) -> list[Article]:
        raise NotImplementedError

    def get_article(self, article_id: str) -> Article:
        raise NotImplementedError


def _coerce_tags(value) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, (list, tuple)):
        return tuple(str(v) for v in value)
    return (str(value),)


def article_from_dict(d: dict) -> Article:
    """Build an :class:`Article` from a JSON-decoded dict.

    Centralised here so the repository can use it regardless of
    the source (file, future DB, future API). Tolerates missing
    optional fields with safe defaults.
    """
    return Article(
        id=str(d["id"]),
        topic=str(d.get("topic", "general")),
        category=str(d.get("category", "general")),
        tags=_coerce_tags(d.get("tags")),
        title=str(d.get("title", d["id"])),
        summary=str(d.get("summary", "")),
        keywords=_coerce_tags(d.get("keywords")),
        body=str(d.get("body", "")),
        related_score_keys=_coerce_tags(d.get("related_score_keys")),
        related_intelligence_keys=_coerce_tags(d.get("related_intelligence_keys")),
        source=d.get("source"),
        # Stamp missing created_at with the file's mtime, or the
        # epoch as a last resort. Articles are static; the stamp
        # is purely for UI display.
        created_at=str(
            d.get("created_at")
            or datetime.utcnow().date().isoformat()
        ),
    )

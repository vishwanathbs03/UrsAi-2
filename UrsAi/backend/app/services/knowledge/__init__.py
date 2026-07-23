"""Knowledge Layer (RAG Preparation).

Sprint 3 — Part 1.

This package stores and retrieves structured business knowledge
articles. The data source is a small JSON catalog at
``backend/app/data/knowledge_catalog.json`` (kept under version
control). The retrieval layer is the seam that the future RAG
milestone will plug embeddings into — for now the service exposes
deterministic in-memory filters by topic, category, and tags.

What the layer is NOT:
  * It is NOT an LLM. No text is generated; the response body is
    the stored article.
  * It is NOT a chat. There is no session, no message history.
  * It is NOT a recommendation engine. The articles are descriptive
    knowledge, not prescriptive actions.

Modules:
  * ``base``       — article dataclass + not-found exception
  * ``repository`` — JSON-backed read-only repository
  * ``service``    — list/get + filter façade
"""

from app.services.knowledge.base import (
    DEFAULT_CATALOG_PATH,
    Article,
    KnowledgeArticleNotFound,
    KnowledgeRepositoryBase,
)
from app.services.knowledge.repository import JsonKnowledgeRepository
from app.services.knowledge.service import KnowledgeService

__all__ = [
    "Article",
    "DEFAULT_CATALOG_PATH",
    "JsonKnowledgeRepository",
    "KnowledgeArticleNotFound",
    "KnowledgeRepositoryBase",
    "KnowledgeService",
]

"""Pydantic schemas for the Knowledge Layer.

The schema is intentionally narrow: it only describes the shape
the API actually returns. The dataclass in
:mod:`app.services.knowledge.base` is the internal type; this
module is the wire format.

Every model has ``extra="forbid"`` so accidental field additions
break loudly at the API boundary.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Article
# --------------------------------------------------------------------------- #


class ArticleOut(BaseModel):
    """One knowledge article, as returned by the API."""

    model_config = ConfigDict(extra="forbid")

    id: str
    topic: str
    category: str
    tags: list[str] = Field(default_factory=list)
    title: str
    summary: str
    keywords: list[str] = Field(default_factory=list)
    body: str = ""
    related_score_keys: list[str] = Field(default_factory=list)
    related_intelligence_keys: list[str] = Field(default_factory=list)
    source: str | None = None
    created_at: str = ""


# --------------------------------------------------------------------------- #
# List response
# --------------------------------------------------------------------------- #


class KnowledgeFiltersOut(BaseModel):
    """Echo of the filters the caller supplied, normalised."""

    model_config = ConfigDict(extra="forbid")

    topic: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)


class KnowledgeListResponse(BaseModel):
    """Returned by ``GET /knowledge``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    filters: KnowledgeFiltersOut
    count: int = Field(ge=0)
    total: int = Field(ge=0)
    articles: list[ArticleOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Detail response
# --------------------------------------------------------------------------- #


class KnowledgeArticleResponse(BaseModel):
    """Returned by ``GET /knowledge/{id}``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    article: ArticleOut

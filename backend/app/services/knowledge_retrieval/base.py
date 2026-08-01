"""Shared types for the Knowledge Retrieval layer (Sprint 7 Part 4).

This module is *narrow*:

  * :class:`ScoredArticle`  — what the retriever produces.
  * :class:`RankedArticle`  — what the ranker hands the
    citation builder.
  * :class:`Citation`       — what the chat service shows
    to the user.
  * :class:`KnowledgeContext` — the envelope the chat
    service adds to the prompt.

Everything is a frozen dataclass so the layer is safe to
share across threads without a lock. Output ordering is
preserved by the ranker, not by ordering dataclass fields.

The :class:`Citation` schema also has a typed
``source_category`` field. The values are the same
discriminator the chat service uses for its
``ChatSource.topic`` payload, so the wire shape is
consistent end-to-end.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# --------------------------------------------------------------------------- #
# Source category — the kind of knowledge source a citation points to.
# --------------------------------------------------------------------------- #


SourceCategory = Literal[
    "Knowledge",
    "Rule",
    "Recommendation",
    "GovernmentScheme",
    "Glossary",
]


# --------------------------------------------------------------------------- #
# Scoring primitives
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ScoredArticle:
    """An article plus its retrieval score.

    ``score`` is the raw sum of the token-overlap + tag +
    keyword + context boost. The ranker decides what to do
    with it.
    """

    article_id: str
    score: float
    matched_tokens: tuple[str, ...] = field(default_factory=tuple)
    matched_tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class RankedArticle:
    """An article that survived the ranker's top-k cut.

    ``rank`` is 1-based. Two articles with the same score
    are tie-broken by article id (stable, deterministic).
    """

    rank: int
    article_id: str
    score: float
    matched_tokens: tuple[str, ...] = field(default_factory=tuple)
    matched_tags: tuple[str, ...] = field(default_factory=tuple)


# --------------------------------------------------------------------------- #
# Citation
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Citation:
    """A pointer to the exact article that grounds a claim.

    ``snippet`` is a short excerpt <<120 chars>> that the
    UI can show without leaking the whole body. ``detail``
    is the human-readable label the UI uses in the message
    bubble ("Knowledge: Export readiness checklist").
    """

    article_id: str
    title: str
    source_category: SourceCategory
    reference: str  # e.g. "topic:export · category:readiness"
    snippet: str
    detail: str


# --------------------------------------------------------------------------- #
# Envelope
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class KnowledgeContext:
    """The assembled retrieval result for one prompt.

    The chat service translates this into (a) prompt
    fragments the assistant provider sees, (b) sources
    the response-message row stores, and (c) citations
    the UI renders next to the assistant's reply.
    """

    query: str
    ranked: tuple[RankedArticle, ...]
    citations: tuple[Citation, ...]
    articles: tuple[dict, ...]  # the full article payloads (top-k)
    total_candidates: int
    generated_at: str

    @property
    def is_empty(self) -> bool:
        return len(self.ranked) == 0
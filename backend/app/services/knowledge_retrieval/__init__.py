"""Knowledge Retrieval layer - Sprint 7 Part 4.

A lightweight, dependency-free retrieval pipeline that sits
in front of the Sprint 7 Part 2 assistant provider:

    Question
       |
       v
  KnowledgeRetriever   <-- token-overlap + tag + keyword scoring
       |
       v
  Ranker              <-- deterministic top-k
       |
       v
  CitationBuilder     <-- structured citations for the UI
       |
       v
  KnowledgeContextBuilder
       |
       v
    prompt + sources
       |
       v
  AssistantProviderService (Sprint 7 Part 2)

Design notes
------------

* No embeddings. No vector store. No external search. The
  retriever is a token-overlap scorer plus tag/keyword
  boosting plus a per-business-context boost (articles
  whose ``related_score_keys`` or
  ``related_intelligence_keys`` match the owner's
  Twin state outrank generic ones).

* No duplicate indexing. The retriever reads the existing
  :class:`app.services.knowledge.service.KnowledgeService`
  directly. It does not load the JSON catalog into a
  separate cache.

* Determinism. Two calls with the same query and the same
  catalog return the same top-k sequence, the same scores,
  and the same citations. The scoring is a pure function
  of (query, articles, owner-context).

* No LLM dependencies. The retrieval layer is purely
  Python; it does not import any provider or model.

The layer is consumed by :class:`app.services.chat.
conversation_service.ConversationService`, which calls
:meth:`KnowledgeRetrievalService.retrieve` for every user
prompt and tucks the resulting
:class:`KnowledgeContext` into the prompt the assistant
provider sees.
"""

from app.services.knowledge_retrieval.base import (
    Citation,
    KnowledgeContext,
    RankedArticle,
    ScoredArticle,
)
from app.services.knowledge_retrieval.citation_builder import CitationBuilder
from app.services.knowledge_retrieval.context_builder import (
    KnowledgeContextBuilder,
)
from app.services.knowledge_retrieval.ranker import Ranker
from app.services.knowledge_retrieval.retriever import KnowledgeRetriever
from app.services.knowledge_retrieval.service import KnowledgeRetrievalService

__all__ = [
    "Citation",
    "KnowledgeContext",
    "RankedArticle",
    "ScoredArticle",
    "CitationBuilder",
    "KnowledgeContextBuilder",
    "Ranker",
    "KnowledgeRetriever",
    "KnowledgeRetrievalService",
]
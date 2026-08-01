"""Knowledge Layer endpoints.

  * GET /knowledge           — list articles, optionally filtered
                                by ``?topic=``, ``?category=``,
                                ``?tag=`` (repeatable)
  * GET /knowledge/{id}      — fetch a single article

Both endpoints require authentication (matching the rest of the
read-side API — auth, business, intelligence, scoring, dna,
rules). The service is a pure function of the JSON catalog;
identical requests produce identical responses minus
``generated_at``.

The endpoint does NOT:
  * call out to an LLM
  * maintain chat state
  * generate recommendations
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.schemas.knowledge import (
    KnowledgeArticleResponse,
    KnowledgeListResponse,
)
from app.services.knowledge import (
    JsonKnowledgeRepository,
    KnowledgeArticleNotFound,
    KnowledgeService,
)
from app.utils.database import get_db


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


# The repository is a process-level singleton (the JSON catalog
# is static). We build it lazily so tests can monkey-patch the
# service if they want to.
_REPO_SINGLETON: JsonKnowledgeRepository | None = None


def _get_repository() -> JsonKnowledgeRepository:
    global _REPO_SINGLETON
    if _REPO_SINGLETON is None:
        _REPO_SINGLETON = JsonKnowledgeRepository()
    return _REPO_SINGLETON


def _service(_: Session = Depends(get_db)) -> KnowledgeService:
    return KnowledgeService(_get_repository())


@router.get(
    "",
    response_model=KnowledgeListResponse,
    summary="List knowledge articles (filterable by topic, category, tag)",
)
def list_knowledge(
    topic: str | None = Query(default=None, description="Exact-match topic"),
    category: str | None = Query(default=None, description="Exact-match category"),
    tag: list[str] | None = Query(
        default=None,
        description="Repeat to OR over multiple tags",
    ),
    current_user: User = Depends(get_current_user),
    service: KnowledgeService = Depends(_service),
) -> KnowledgeListResponse:
    payload = service.list(topic=topic, category=category, tags=tag or [])
    return KnowledgeListResponse.model_validate(payload)


@router.get(
    "/{article_id}",
    response_model=KnowledgeArticleResponse,
    summary="Fetch a single knowledge article by id",
)
def get_knowledge(
    article_id: str,
    current_user: User = Depends(get_current_user),
    service: KnowledgeService = Depends(_service),
) -> KnowledgeArticleResponse:
    try:
        payload = service.get(article_id)
    except KnowledgeArticleNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return KnowledgeArticleResponse.model_validate(payload)

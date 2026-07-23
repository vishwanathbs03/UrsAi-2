"""Business Score endpoints.

  * GET /business/scores  — run the deterministic Business
    Score Engine against the authenticated user's profile and
    return a structured report.

The endpoint is intentionally read-only and cache-friendly. The
underlying engine is deterministic; identical input produces
identical output. The endpoint stamps ``generated_at`` so the
client can display a freshness label.

Authentication: required. Owner is resolved from the JWT, never
the request.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.scoring import BusinessScoresResponse
from app.services.scoring import BusinessScoreService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-scores"])


def _service(db: Session = Depends(get_db)) -> BusinessScoreService:
    return BusinessScoreService(BusinessRepository(db))


@router.get(
    "/scores",
    response_model=BusinessScoresResponse,
    summary="Run the deterministic Business Score Engine on the user's profile",
)
def get_business_scores(
    current_user: User = Depends(get_current_user),
    service: BusinessScoreService = Depends(_service),
) -> BusinessScoresResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return BusinessScoresResponse.model_validate(payload)

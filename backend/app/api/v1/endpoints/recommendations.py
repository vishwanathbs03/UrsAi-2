"""Recommendation Intelligence Engine endpoint.

  * GET /business/recommendations  — produce a structured,
    ranked, deterministic list of recommendations for the
    authenticated user's business profile.

The endpoint is a thin wrapper around
:class:`~app.services.recommendations.RecommendationService`.
The service is responsible for every derivation rule; the
endpoint does:

  1. Authenticate the request (JWT / cookie).
  2. Construct the service with the request-scoped
     BusinessRepository.
  3. Call ``service.compute(owner_id)``.
  4. Translate the service's exceptions into HTTP status
     codes:
       * ``BusinessNotFound`` → 404
       * anything else        → 500 (the spec is silent
         on additional error cases)
  5. Validate the resulting dict against the response schema
     so an unhandled code path fails loudly at the API
     boundary, not silently in the UI.

Authentication: required. The owner is resolved from the
JWT subject; clients cannot pick an owner_id.
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
from app.schemas.recommendation import RecommendationResponse
from app.services.recommendation_service import RecommendationService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-recommendations"])


def _service(db: Session = Depends(get_db)) -> RecommendationService:
    return RecommendationService(BusinessRepository(db))


@router.get(
    "/recommendations",
    response_model=RecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate deterministic recommendations from Business DNA, SWOT, Readiness, Opps, and KPIs",
)
def get_business_recommendations(
    current_user: User = Depends(get_current_user),
    service: RecommendationService = Depends(_service),
) -> RecommendationResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return RecommendationResponse.model_validate(payload)

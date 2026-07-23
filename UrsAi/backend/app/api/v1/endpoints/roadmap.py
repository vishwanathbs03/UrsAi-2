"""Recommendation Execution & Business Roadmap Engine endpoint.

  * GET /api/v1/business/roadmap  — produce a deterministic,
    dependency-respecting execution plan from the user's
    existing recommendations.

The endpoint is a thin wrapper around
:class:`~app.services.roadmap.RoadmapService`. The
service is responsible for every derivation rule; the
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
  5. Validate the resulting dict against the response
     schema so an unhandled code path fails loudly at the
     API boundary, not silently in the UI.

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
from app.schemas.roadmap import BusinessRoadmapResponse
from app.services.roadmap import RoadmapService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-roadmap"])


def _service(db: Session = Depends(get_db)) -> RoadmapService:
    return RoadmapService(BusinessRepository(db))


@router.get(
    "/roadmap",
    response_model=BusinessRoadmapResponse,
    summary="Generate a deterministic execution roadmap from the user's recommendations",
)
def get_business_roadmap(
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(_service),
) -> BusinessRoadmapResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return BusinessRoadmapResponse.model_validate(payload)

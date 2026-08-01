"""Business Readiness API Endpoint — Sprint 11.3.

  * GET /api/v1/business/readiness — compute deterministic readiness
    scores across Digital, Operations, Finance, Market, Compliance, and Growth
    for the authenticated user's business profile.
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
from app.schemas.readiness import ReadinessResponse
from app.services.readiness_service import ReadinessService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-readiness"])


def _service(db: Session = Depends(get_db)) -> ReadinessService:
    return ReadinessService(BusinessRepository(db))


@router.get(
    "/readiness",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic Business Readiness scores across 6 dimensions",
)
def get_business_readiness(
    current_user: User = Depends(get_current_user),
    service: ReadinessService = Depends(_service),
) -> ReadinessResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

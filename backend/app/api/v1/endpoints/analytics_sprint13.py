"""Business Analytics API Endpoint — Sprint 13 Part 1.

Endpoint:
  * GET /api/v1/business/analytics
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
from app.schemas.analytics_sprint13 import BusinessAnalyticsResponse
from app.services.analytics_sprint13_service import BusinessAnalyticsService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-analytics"])


@router.get(
    "/analytics",
    response_model=BusinessAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute business analytics including profile completion, health score, distribution, and trends",
)
def get_business_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessAnalyticsResponse:
    service = BusinessAnalyticsService(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

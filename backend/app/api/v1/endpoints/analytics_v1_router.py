"""Analytics API router for /api/v1/analytics endpoint."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.analytics_v1 import AnalyticsOverviewResponse
from app.services.analytics_v1_service import AnalyticsV1Service
from app.utils.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics-overview"])


@router.get(
    "",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch overall business analytics, growth score, trends, and employee insights",
)
def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsOverviewResponse:
    logger.info("Computing analytics overview for user_id=%s", current_user.id)
    service = AnalyticsV1Service(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        logger.warning("Business profile not found for user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

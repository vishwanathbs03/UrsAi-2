"""Business Insights API Endpoint — Sprint 16."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.schemas.insights import BusinessInsightsResponse
from app.services.insights_service import InsightsService
from app.utils.database import get_db

router = APIRouter(prefix="", tags=["insights"])


@router.get(
    "/insights",
    response_model=BusinessInsightsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive business insights, findings, risks, and industry benchmarks",
)
def get_business_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessInsightsResponse:
    service = InsightsService(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

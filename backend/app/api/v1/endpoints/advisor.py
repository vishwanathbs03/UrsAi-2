"""Aggregate Advisor API Endpoint — Sprint 12.7.

  * GET /api/v1/business/advisor — aggregated intelligence endpoint returning:
      - recommendations
      - risks
      - growth
      - funding
      - compliance
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
from app.schemas.advisor_aggregate import AdvisorAggregateResponse
from app.services.advisor_aggregate_service import AdvisorAggregateService
from app.utils.database import get_db

router = APIRouter(prefix="", tags=["business-advisor"])


def _service(db: Session = Depends(get_db)) -> AdvisorAggregateService:
    return AdvisorAggregateService(BusinessRepository(db))


@router.get(
    "/business/advisor",
    response_model=AdvisorAggregateResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute aggregated business advisor report",
)
@router.get(
    "/advisor",
    response_model=AdvisorAggregateResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute aggregated business advisor report (alias)",
)
def get_business_advisor(
    current_user: User = Depends(get_current_user),
    service: AdvisorAggregateService = Depends(_service),
) -> AdvisorAggregateResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

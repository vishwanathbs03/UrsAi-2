"""Funding Advisor API Endpoint — Sprint 12.5.

  * GET /api/v1/business/funding — compute deterministic funding readiness report
    including loan score, investor score, grant score, MSME schemes, and checklist.
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
from app.schemas.funding import FundingResponse
from app.services.funding_service import FundingService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-funding"])


def _service(db: Session = Depends(get_db)) -> FundingService:
    return FundingService(BusinessRepository(db))


@router.get(
    "/funding",
    response_model=FundingResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic Funding Advisor report",
)
def get_business_funding(
    current_user: User = Depends(get_current_user),
    service: FundingService = Depends(_service),
) -> FundingResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

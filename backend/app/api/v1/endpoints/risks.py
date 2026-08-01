"""Risk Detection Engine API Endpoint — Sprint 12.3.

  * GET /api/v1/business/risks — compute deterministic risk detection report
    across Financial, Operational, Compliance, Digital, and Growth categories.
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
from app.schemas.risk import RiskResponse
from app.services.risk_service import RiskService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-risks"])


def _service(db: Session = Depends(get_db)) -> RiskService:
    return RiskService(BusinessRepository(db))


@router.get(
    "/risks",
    response_model=RiskResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic risk detection report for the user's business profile",
)
def get_business_risks(
    current_user: User = Depends(get_current_user),
    service: RiskService = Depends(_service),
) -> RiskResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

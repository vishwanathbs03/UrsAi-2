"""Growth Advisor API Endpoint — Sprint 12.4.

  * GET /api/v1/business/growth — compute deterministic growth advice across
    Sales, Marketing, Operations, Digital, Hiring, and Products.
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
from app.schemas.growth import GrowthAdvisorResponse
from app.services.growth_service import GrowthService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-growth"])


def _service(db: Session = Depends(get_db)) -> GrowthService:
    return GrowthService(BusinessRepository(db))


@router.get(
    "/growth",
    response_model=GrowthAdvisorResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic Growth Advisor report across 6 core categories",
)
def get_business_growth(
    current_user: User = Depends(get_current_user),
    service: GrowthService = Depends(_service),
) -> GrowthAdvisorResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

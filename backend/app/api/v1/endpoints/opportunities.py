"""Opportunity Detector API Endpoint — Sprint 11.4.

  * GET /api/v1/business/opportunities — compute deterministic growth opportunities
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
from app.schemas.opportunity import OpportunityResponse
from app.services.opportunity_service import OpportunityService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-opportunities"])


def _service(db: Session = Depends(get_db)) -> OpportunityService:
    return OpportunityService(BusinessRepository(db))


@router.get(
    "/opportunities",
    response_model=OpportunityResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect deterministic business opportunities for the user's profile",
)
def get_business_opportunities(
    current_user: User = Depends(get_current_user),
    service: OpportunityService = Depends(_service),
) -> OpportunityResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

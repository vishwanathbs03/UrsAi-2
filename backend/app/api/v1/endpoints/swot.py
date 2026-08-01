"""SWOT Engine API Endpoint — Sprint 11.2.

  * GET /api/v1/business/swot — compute deterministic SWOT report
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
from app.schemas.swot import SWOTResponse
from app.services.swot_service import SwotService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-swot"])


def _service(db: Session = Depends(get_db)) -> SwotService:
    return SwotService(BusinessRepository(db))


@router.get(
    "/swot",
    response_model=SWOTResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic SWOT analysis for the authenticated user's business",
)
def get_business_swot(
    current_user: User = Depends(get_current_user),
    service: SwotService = Depends(_service),
) -> SWOTResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

"""Government Schemes API Endpoint — Sprint 16 Part 1.

Endpoint:
  * GET /api/v1/business/schemes
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
from app.schemas.schemes_sprint16 import BusinessSchemesResponse
from app.services.schemes_sprint16_service import SchemeRecommendationEngine
from app.utils.database import get_db

router = APIRouter(prefix="", tags=["business-schemes"])


@router.get(
    "/business/schemes",
    response_model=BusinessSchemesResponse,
    status_code=status.HTTP_200_OK,
    summary="Recommend government schemes tailored to industry, turnover, employees, location, and age",
)
@router.get(
    "/schemes",
    response_model=BusinessSchemesResponse,
    status_code=status.HTTP_200_OK,
    summary="Recommend government schemes (alias)",
)
def get_business_schemes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessSchemesResponse:
    engine = SchemeRecommendationEngine(BusinessRepository(db))
    try:
        return engine.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

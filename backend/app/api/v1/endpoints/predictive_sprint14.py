"""Predictive Analytics API Endpoints — Sprint 14.

Endpoints:
  * GET /api/v1/business/predictions/revenue
  * GET /api/v1/business/predictions/growth
  * GET /api/v1/business/predictions/risk
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
from app.schemas.predictive_sprint14 import (
    FutureRiskPredictionResponse,
    GrowthPredictionResponse,
    RevenuePredictionResponse,
)
from app.services.predictive_sprint14_service import (
    FutureRiskPredictionService,
    GrowthPredictionService,
    RevenuePredictionService,
)
from app.utils.database import get_db

router = APIRouter(prefix="/business/predictions", tags=["business-predictions"])


@router.get(
    "/revenue",
    response_model=RevenuePredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute 3m, 6m, 12m deterministic revenue forecast",
)
def get_revenue_prediction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RevenuePredictionResponse:
    service = RevenuePredictionService(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.get(
    "/growth",
    response_model=GrowthPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute 12m predicted employees, products, and expansion readiness",
)
def get_growth_prediction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GrowthPredictionResponse:
    service = GrowthPredictionService(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.get(
    "/risk",
    response_model=FutureRiskPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect predicted future risks across Financial, Operational, and Market categories",
)
def get_future_risk_prediction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FutureRiskPredictionResponse:
    service = FutureRiskPredictionService(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

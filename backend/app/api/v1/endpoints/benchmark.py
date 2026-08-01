"""Industry Benchmark API Endpoint — Sprint 11.5.

  * GET /api/v1/business/benchmark — compute deterministic benchmark metrics
    comparing user business profile against industry baseline averages.
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
from app.schemas.benchmark import BenchmarkResponse
from app.services.benchmark_service import BenchmarkService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-benchmark"])


def _service(db: Session = Depends(get_db)) -> BenchmarkService:
    return BenchmarkService(BusinessRepository(db))


@router.get(
    "/benchmark",
    response_model=BenchmarkResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic industry benchmark scores for the user's business",
)
def get_business_benchmark(
    current_user: User = Depends(get_current_user),
    service: BenchmarkService = Depends(_service),
) -> BenchmarkResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

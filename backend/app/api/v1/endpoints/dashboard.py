"""Dashboard API endpoint — Sprint 10 Task 10.1.

  * GET /api/v1/dashboard — fetch the dashboard overview for the
    authenticated user's business profile.
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
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import DashboardService
from app.utils.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _service(db: Session = Depends(get_db)) -> DashboardService:
    return DashboardService(BusinessRepository(db))


@router.get(
    "",
    response_model=DashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch the authenticated user's dashboard overview",
)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(_service),
) -> DashboardResponse:
    try:
        return service.get_dashboard(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

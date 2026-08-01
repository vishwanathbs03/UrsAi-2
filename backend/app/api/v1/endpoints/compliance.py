"""Compliance Advisor API Endpoint — Sprint 12.6 / 12.7.

  * GET /api/v1/business/compliance — compute deterministic compliance report.
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
from app.schemas.compliance import ComplianceResponse
from app.services.compliance_service import ComplianceService
from app.utils.database import get_db

router = APIRouter(prefix="/business", tags=["business-compliance"])


def _service(db: Session = Depends(get_db)) -> ComplianceService:
    return ComplianceService(BusinessRepository(db))


@router.get(
    "/compliance",
    response_model=ComplianceResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic Compliance Advisor report",
)
def get_business_compliance(
    current_user: User = Depends(get_current_user),
    service: ComplianceService = Depends(_service),
) -> ComplianceResponse:
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

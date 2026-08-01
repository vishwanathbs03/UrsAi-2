"""Financial ROI & Business Value endpoint.

  * GET /api/v1/business/financial-impact  —
    read-only deterministic projection for the
    authenticated user's business profile.

The endpoint is a thin wrapper around the
:class:`FinanceService` façade. The 4xx
error contract matches the rest of Atlas
AI:

  * 401 — no auth
  * 404 — no business profile
  * 200 — happy path
  * 500 — internal error (validation
    failures from Pydantic's
    ``extra="forbid`` are intentionally
    surfaced as 500 because they indicate
    a refactor leak, not a user error)

The endpoint never modifies the database.
The Finance engine is a read-only
aggregator; the response is a financial
projection, not a financial record.
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
from app.schemas.finance import FinancialImpactResponse
from app.services.finance import FinanceService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-finance"])


def _service(db: Session = Depends(get_db)) -> FinanceService:
    return FinanceService(BusinessRepository(db))


@router.get(
    "/financial-impact",
    response_model=FinancialImpactResponse,
    summary=(
        "Compute the financial ROI & business value "
        "projection for the user's business profile. "
        "Read-only; never modifies the business profile "
        "or any upstream service."
    ),
    status_code=status.HTTP_200_OK,
)
def get_financial_impact(
    current_user: User = Depends(get_current_user),
    service: FinanceService = Depends(_service),
) -> FinancialImpactResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business profile for this user yet.",
        ) from exc

    return FinancialImpactResponse.model_validate(payload)

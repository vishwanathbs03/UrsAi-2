"""Business DNA endpoints.

  * GET /business/dna  — compute the deterministic Business
    DNA for the authenticated user's profile and return a
    fully explainable, reproducible response.

The endpoint is intentionally read-only. The DNA engine is a
pure function of the intelligence + score payloads; identical
inputs produce identical outputs. The endpoint stamps
``generated_at`` so the client can display a freshness label.

Authentication: required. Owner is resolved from the JWT, never
the request.
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
from app.schemas.dna import BusinessDNAResponse
from app.services.business_dna_service import BusinessDNAService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-dna"])


def _service(db: Session = Depends(get_db)) -> BusinessDNAService:
    return BusinessDNAService(BusinessRepository(db))


@router.get(
    "/dna",
    response_model=BusinessDNAResponse,
    summary="Compute the deterministic Business DNA for the user's profile",
)
def get_business_dna(
    current_user: User = Depends(get_current_user),
    service: BusinessDNAService = Depends(_service),
) -> BusinessDNAResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return BusinessDNAResponse.model_validate(payload)

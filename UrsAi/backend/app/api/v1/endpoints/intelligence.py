"""Business Intelligence endpoints.

  * GET /business/intelligence  — analyze the authenticated
    user's business profile and return a structured report.

The endpoint is intentionally read-only and cache-friendly. The
underlying engine is deterministic; identical input produces
identical output. The endpoint stamps ``generated_at`` so the
client can display a freshness label.

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
from app.schemas.intelligence import BusinessIntelligenceResponse
from app.services.intelligence import IntelligenceService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-intelligence"])


def _service(db: Session = Depends(get_db)) -> IntelligenceService:
    return IntelligenceService(BusinessRepository(db))


@router.get(
    "/intelligence",
    response_model=BusinessIntelligenceResponse,
    summary="Run the rule-based business intelligence engine on the user's profile",
)
def get_business_intelligence(
    current_user: User = Depends(get_current_user),
    service: IntelligenceService = Depends(_service),
) -> BusinessIntelligenceResponse:
    try:
        payload = service.analyze(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return BusinessIntelligenceResponse.model_validate(payload)

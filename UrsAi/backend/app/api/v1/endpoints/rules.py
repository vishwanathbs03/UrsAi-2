"""Rule Engine endpoints.

  * GET /business/rules  — run the deterministic Rule Engine
    against the authenticated user's profile and return a
    reproducible, fully explainable list of rule firings.

The endpoint is read-only. The engine is a pure function of
the intelligence + score + DNA payloads; identical inputs
produce identical outputs. The endpoint stamps
``generated_at`` so the client can display a freshness label.

Authentication: required. Owner is resolved from the JWT,
never the request.
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
from app.schemas.rules import BusinessRulesResponse
from app.services.rules import RuleEngineService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-rules"])


def _service(db: Session = Depends(get_db)) -> RuleEngineService:
    return RuleEngineService(BusinessRepository(db))


@router.get(
    "/rules",
    response_model=BusinessRulesResponse,
    summary="Run the deterministic Rule Engine on the user's profile",
)
def get_business_rules(
    current_user: User = Depends(get_current_user),
    service: RuleEngineService = Depends(_service),
) -> BusinessRulesResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return BusinessRulesResponse.model_validate(payload)

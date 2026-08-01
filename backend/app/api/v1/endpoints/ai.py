"""AI Decision Engine endpoint.

  * GET /business/decision  — run the (currently mocked) AI
    Decision Engine against the authenticated user's profile
    and return a structured response.

The endpoint is read-only. The engine is a pure composition of
the existing deterministic services + a deterministic mock LLM
provider; identical inputs produce identical decisions.

Authentication: required. Owner is resolved from the JWT, never
the request.

The endpoint does NOT:
  * call out to OpenAI, Claude, Gemini, Ollama, or any LLM
  * maintain chat state
  * generate prescriptive recommendations
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
from app.schemas.ai import AIDecisionResponse
from app.services.ai import AIDecisionService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-ai"])


def _service(db: Session = Depends(get_db)) -> AIDecisionService:
    return AIDecisionService(BusinessRepository(db))


@router.get(
    "/decision",
    response_model=AIDecisionResponse,
    summary="Generate the (mocked) AI Decision for the user's profile",
)
def get_business_decision(
    current_user: User = Depends(get_current_user),
    service: AIDecisionService = Depends(_service),
) -> AIDecisionResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return AIDecisionResponse.model_validate(payload)

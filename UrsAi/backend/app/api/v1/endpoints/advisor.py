"""Autonomous Business Advisor endpoint — Sprint 7 Part 5.

  * GET /api/v1/advisor  — return the advisor's read-only
    advice for the authenticated user's business.

The endpoint is a thin wrapper around
:class:`~app.services.advisor.AdvisorService`. The service
is responsible for every derivation rule; the endpoint
does:

  1. Authenticate the request (JWT / cookie).
  2. Construct the service with the request-scoped
     :class:`BusinessRepository`.
  3. Call ``service.advise(owner_id=...)``.
  4. Translate the service's exceptions into HTTP status
     codes:
       * :class:`BusinessNotFound` → 404
  5. Validate the resulting dict against the response
     schema so an unhandled code path fails loudly at the
     API boundary, not silently in the UI.

Authentication: required. The owner is resolved from the
JWT subject; clients cannot pick an owner_id.

Database writes: never. The Advisor does not mutate the
business profile or any upstream service.

What the endpoint does NOT do
-----------------------------

  * call out to OpenAI, Claude, Gemini, Ollama, or any LLM
  * send emails, push notifications, or schedule jobs
  * call external APIs
  * mutate any business field
  * store conversational state
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
from app.schemas.advisor import AdvisorResponseOut
from app.services.advisor import AdvisorService
from app.utils.database import get_db


router = APIRouter(prefix="/advisor", tags=["advisor"])


def _service(db: Session = Depends(get_db)) -> AdvisorService:
    """Build an AdvisorService bound to the request's session."""
    return AdvisorService(BusinessRepository(db))


@router.get(
    "",
    response_model=AdvisorResponseOut,
    status_code=status.HTTP_200_OK,
    summary=(
        "Read the Autonomous Business Advisor's deterministic "
        "advice. The advisor is a read-only aggregator over the "
        "existing engines (Twin, Rules, Recommendations, Roadmap, "
        "AI Decision / Insights). It does NOT call an LLM, does "
        "NOT mutate state, and does NOT execute actions."
    ),
)
def get_advisor(
    current_user: User = Depends(get_current_user),
    service: AdvisorService = Depends(_service),
) -> AdvisorResponseOut:
    try:
        result = service.advise(owner_id=current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No business profile for this user yet. "
                "Create a business profile before reading the "
                "Advisor."
            ),
        ) from exc

    # Validate against the schema so an unhandled code path
    # fails loudly here, not at the client. Pydantic's
    # extra="forbid" surfaces any leaked field.
    return AdvisorResponseOut.model_validate(result)

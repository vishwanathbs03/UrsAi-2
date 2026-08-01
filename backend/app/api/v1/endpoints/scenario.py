"""Business Scenario Simulator endpoint.

  * POST /api/v1/business/scenario  — produce a
    deterministic in-memory projection of the
    authenticated user's business under a list of
    hypothetical changes.

The endpoint is a thin wrapper around
:class:`~app.services.scenario.ScenarioService`. The
service is responsible for:

  * cloning the user's Business row into an isolated
    in-memory session;
  * applying the hypothetical changes;
  * re-running the existing engines against the clone;
  * returning the current-vs-projected delta + impact.

The endpoint does:

  1. Authenticate the request (JWT / cookie).
  2. Construct the service with the request-scoped
     BusinessRepository.
  3. Call ``service.simulate(owner_id, request)``.
  4. Translate the service's exceptions into HTTP
     status codes:
       * ``BusinessNotFound`` → 404
       * ``ValueError``        → 422 (the engine
         surfaces validation errors through that type)
  5. Validate the resulting dict against the response
     schema so an unhandled code path fails loudly at
     the API boundary, not silently in the UI.

Authentication: required. The owner is resolved from
the JWT subject; clients cannot pick an owner_id.

Database writes: never. The endpoint does not call
``commit()`` and the in-memory session is torn down
inside the service.
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
from app.schemas.scenario import ScenarioRequest, ScenarioResponse
from app.services.scenario import ScenarioService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-scenario"])


def _service(db: Session = Depends(get_db)) -> ScenarioService:
    return ScenarioService(BusinessRepository(db))


@router.post(
    "/scenario",
    response_model=ScenarioResponse,
    summary="Simulate hypothetical business changes without modifying the database",
)
def post_business_scenario(
    body: ScenarioRequest,
    current_user: User = Depends(get_current_user),
    service: ScenarioService = Depends(_service),
) -> ScenarioResponse:
    try:
        payload = service.simulate(current_user.id, body)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    return ScenarioResponse.model_validate(payload)

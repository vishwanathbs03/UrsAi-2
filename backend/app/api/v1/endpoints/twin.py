"""Business Digital Twin endpoint.

  * GET /api/v1/business/twin  — produce the
    deterministic, computed Digital Twin for the
    authenticated user's business profile.

The endpoint is a thin wrapper around
:class:`~app.services.twin.TwinService`. The service
is responsible for:

  * reading every upstream engine's payload
    (BusinessService, Intelligence, Scores, DNA,
    Rules, Recommendations, Roadmap);
  * building the snapshot / timeline / risk /
    opportunity / health blocks;
  * returning the dict the Pydantic schema will
    validate.

The endpoint does:

  1. Authenticate the request (JWT / cookie).
  2. Construct the service with the request-scoped
     BusinessRepository.
  3. Call ``service.compute(owner_id)``.
  4. Translate the service's exceptions into HTTP
     status codes:
       * ``BusinessNotFound`` → 404
  5. Validate the resulting dict against the
     response schema so an unhandled code path fails
     loudly at the API boundary, not silently in the
     UI.

Authentication: required. The owner is resolved
from the JWT subject; clients cannot pick an
owner_id.

Database writes: never. The endpoint does not call
``commit()`` and the Twin engine does not mutate
any persistent state.
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
from app.schemas.twin import BusinessDigitalTwinResponse
from app.services.twin import TwinService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-twin"])


def _service(db: Session = Depends(get_db)) -> TwinService:
    return TwinService(BusinessRepository(db))


@router.get(
    "/twin",
    response_model=BusinessDigitalTwinResponse,
    summary="Generate the Business Digital Twin for the authenticated user's business profile",
)
def get_business_twin(
    current_user: User = Depends(get_current_user),
    service: TwinService = Depends(_service),
) -> BusinessDigitalTwinResponse:
    try:
        payload = service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return BusinessDigitalTwinResponse.model_validate(payload)

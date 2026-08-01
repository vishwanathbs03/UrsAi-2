"""Business Digital Twin endpoints.

Routes
------

    POST   /business        create the authenticated user's business profile
    GET    /business        fetch it (with profile-completeness sidecar)
    PUT    /business        partial update — any subset of sections
    DELETE /business        remove the profile + every nested row
    GET    /business/me     alias of GET /business (intuitive)

Authentication
--------------

Every route requires a valid session (JWT cookie or
``Authorization: Bearer ***``). The owner is resolved from the JWT
subject; clients cannot pick an owner_id.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import (
    BusinessAlreadyExists,
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.business import (
    BusinessCreate,
    BusinessUpdate,
    BusinessWithCompleteness,
    DeleteResponse,
)
from app.services.business_service import BusinessService
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business"])


def _service(db: Session = Depends(get_db)) -> BusinessService:
    return BusinessService(BusinessRepository(db))


# --------------------------------------------------------------------------- #
# CRUD
# --------------------------------------------------------------------------- #


@router.post(
    "",
    response_model=BusinessWithCompleteness,
    status_code=status.HTTP_201_CREATED,
    summary="Create the authenticated user's business profile",
)
def create_business(
    payload: BusinessCreate,
    current_user: User = Depends(get_current_user),
    service: BusinessService = Depends(_service),
) -> BusinessWithCompleteness:
    try:
        return service.create(current_user.id, payload)
    except BusinessAlreadyExists as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc


@router.get(
    "",
    response_model=BusinessWithCompleteness,
    summary="Fetch the authenticated user's business profile",
)
def get_business(
    current_user: User = Depends(get_current_user),
    service: BusinessService = Depends(_service),
) -> BusinessWithCompleteness:
    try:
        return service.get_for_owner(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


# Alias for clearer wording — same handler.
@router.get(
    "/me",
    response_model=BusinessWithCompleteness,
    summary="Alias of GET /business",
    include_in_schema=False,
)
def get_business_me(
    current_user: User = Depends(get_current_user),
    service: BusinessService = Depends(_service),
) -> BusinessWithCompleteness:
    return get_business(current_user=current_user, service=service)


@router.put(
    "",
    response_model=BusinessWithCompleteness,
    summary="Update the authenticated user's business profile (partial)",
)
def update_business(
    payload: BusinessUpdate,
    current_user: User = Depends(get_current_user),
    service: BusinessService = Depends(_service),
) -> BusinessWithCompleteness:
    try:
        return service.update(current_user.id, payload)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.delete(
    "",
    response_model=DeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete the authenticated user's business profile",
)
def delete_business(
    current_user: User = Depends(get_current_user),
    service: BusinessService = Depends(_service),
) -> DeleteResponse:
    try:
        deleted_id = service.delete(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return DeleteResponse(id=deleted_id)

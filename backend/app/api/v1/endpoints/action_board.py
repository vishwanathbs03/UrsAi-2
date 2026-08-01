"""Action Board API Router — Sprint 16."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.action_item_repository import ActionItemRepository
from app.schemas.action_board import (
    ActionBoardResponse,
    ActionItemCreate,
    ActionItemOut,
    ActionItemUpdate,
)
from app.services.action_board_service import ActionBoardService
from app.utils.database import get_db

router = APIRouter(prefix="/action-board", tags=["action-board"])


@router.get(
    "",
    response_model=ActionBoardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Action Board items and summary metrics",
)
def get_action_board(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActionBoardResponse:
    service = ActionBoardService(ActionItemRepository(db))
    return service.get_board(current_user.id)


@router.post(
    "",
    response_model=ActionItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Action Board task",
)
def create_action_task(
    payload: ActionItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActionItemOut:
    service = ActionBoardService(ActionItemRepository(db))
    return service.create_task(current_user.id, payload)


@router.patch(
    "/{item_id}",
    response_model=ActionItemOut,
    status_code=status.HTTP_200_OK,
    summary="Update an existing Action Board task",
)
def update_action_task(
    item_id: int,
    payload: ActionItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActionItemOut:
    service = ActionBoardService(ActionItemRepository(db))
    updated = service.update_task(current_user.id, item_id, payload)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found",
        )
    return updated


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an Action Board task",
)
def delete_action_task(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = ActionBoardService(ActionItemRepository(db))
    success = service.delete_task(current_user.id, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

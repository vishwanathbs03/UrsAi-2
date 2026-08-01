"""Notifications API Endpoint — Sprint 16."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notifications import (
    NotificationItemCreate,
    NotificationItemOut,
    NotificationsResponse,
)
from app.services.notification_service import NotificationService
from app.utils.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get(
    "",
    response_model=NotificationsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user notifications and unread count",
)
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationsResponse:
    service = NotificationService(NotificationRepository(db))
    return service.get_user_notifications(current_user.id)


@router.post(
    "",
    response_model=NotificationItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new notification item",
)
def create_notification(
    payload: NotificationItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationItemOut:
    service = NotificationService(NotificationRepository(db))
    return service.create_notification(current_user.id, payload)


@router.patch(
    "/{item_id}/read",
    response_model=NotificationItemOut,
    status_code=status.HTTP_200_OK,
    summary="Mark a specific notification as read",
)
def mark_notification_read(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationItemOut:
    service = NotificationService(NotificationRepository(db))
    updated = service.mark_read(current_user.id, item_id)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification item not found",
        )
    return updated


@router.post(
    "/mark-all-read",
    status_code=status.HTTP_200_OK,
    summary="Mark all user notifications as read",
)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    service = NotificationService(NotificationRepository(db))
    count = service.mark_all_read(current_user.id)
    return {"marked_count": count}


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notification item",
)
def delete_notification(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = NotificationService(NotificationRepository(db))
    success = service.delete_notification(current_user.id, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification item not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

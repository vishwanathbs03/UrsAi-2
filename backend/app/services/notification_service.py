"""Notification Service layer."""

from __future__ import annotations

from datetime import datetime, timezone
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notifications import (
    NotificationItemCreate,
    NotificationItemOut,
    NotificationsResponse,
)


class NotificationService:
    """Service layer managing user notification persistence."""

    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    def get_user_notifications(self, owner_id: int) -> NotificationsResponse:
        items = self._repo.list_by_owner(owner_id)

        # Seed default notifications if user has none
        if not items:
            self._repo.create(
                owner_id=owner_id,
                title="Business Profile Review Required",
                message="Complete your digital twin profile to unlock maximum scheme recommendations.",
                category="reminder",
            )
            self._repo.create(
                owner_id=owner_id,
                title="New Advisor Strategy Available",
                message="Your monthly risk assessment and growth quick-wins have been updated.",
                category="advisor",
            )
            self._repo.create(
                owner_id=owner_id,
                title="Revenue Forecast Milestone",
                message="Predictive analytics projected +12% growth over the next 6 months.",
                category="analytics",
            )
            items = self._repo.list_by_owner(owner_id)

        total = len(items)
        unread = sum(1 for i in items if not i.is_read)

        out_items = [
            NotificationItemOut(
                id=i.id,
                owner_id=i.owner_id,
                title=i.title,
                message=i.message,
                category=i.category,
                is_read=i.is_read,
                created_at=i.created_at.isoformat() if i.created_at else datetime.now(tz=timezone.utc).isoformat(),
            )
            for i in items
        ]

        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return NotificationsResponse(
            generated_at=now_iso,
            unread_count=unread,
            total_count=total,
            notifications=out_items,
        )

    def create_notification(self, owner_id: int, payload: NotificationItemCreate) -> NotificationItemOut:
        item = self._repo.create(
            owner_id=owner_id,
            title=payload.title,
            message=payload.message,
            category=payload.category,
        )
        return NotificationItemOut(
            id=item.id,
            owner_id=item.owner_id,
            title=item.title,
            message=item.message,
            category=item.category,
            is_read=item.is_read,
            created_at=item.created_at.isoformat() if item.created_at else datetime.now(tz=timezone.utc).isoformat(),
        )

    def mark_read(self, owner_id: int, item_id: int) -> NotificationItemOut | None:
        item = self._repo.get_by_id(owner_id, item_id)
        if item is None:
            return None
        updated = self._repo.mark_read(item)
        return NotificationItemOut(
            id=updated.id,
            owner_id=updated.owner_id,
            title=updated.title,
            message=updated.message,
            category=updated.category,
            is_read=updated.is_read,
            created_at=updated.created_at.isoformat() if updated.created_at else datetime.now(tz=timezone.utc).isoformat(),
        )

    def mark_all_read(self, owner_id: int) -> int:
        return self._repo.mark_all_read(owner_id)

    def delete_notification(self, owner_id: int, item_id: int) -> bool:
        item = self._repo.get_by_id(owner_id, item_id)
        if item is None:
            return False
        self._repo.delete(item)
        return True

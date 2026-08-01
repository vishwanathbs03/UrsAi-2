"""Notification Repository layer."""

from __future__ import annotations

from sqlalchemy.orm import Session
from app.models.notification_item import NotificationItem


class NotificationRepository:
    """SQLAlchemy repository for NotificationItem."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def list_by_owner(self, owner_id: int) -> list[NotificationItem]:
        return (
            self._db.query(NotificationItem)
            .filter(NotificationItem.owner_id == owner_id)
            .order_by(NotificationItem.id.desc())
            .all()
        )

    def get_by_id(self, owner_id: int, item_id: int) -> NotificationItem | None:
        return (
            self._db.query(NotificationItem)
            .filter(NotificationItem.owner_id == owner_id, NotificationItem.id == item_id)
            .first()
        )

    def create(
        self,
        owner_id: int,
        title: str,
        message: str,
        category: str = "general",
    ) -> NotificationItem:
        item = NotificationItem(
            owner_id=owner_id,
            title=title,
            message=message,
            category=category,
            is_read=False,
        )
        self._db.add(item)
        self._db.commit()
        self._db.refresh(item)
        return item

    def mark_read(self, item: NotificationItem) -> NotificationItem:
        item.is_read = True
        self._db.commit()
        self._db.refresh(item)
        return item

    def mark_all_read(self, owner_id: int) -> int:
        count = (
            self._db.query(NotificationItem)
            .filter(NotificationItem.owner_id == owner_id, NotificationItem.is_read == False)
            .update({NotificationItem.is_read: True}, synchronize_session=False)
        )
        self._db.commit()
        return count

    def delete(self, item: NotificationItem) -> None:
        self._db.delete(item)
        self._db.commit()

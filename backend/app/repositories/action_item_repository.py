"""Repository layer for ActionItem CRUD operations."""

from __future__ import annotations

from sqlalchemy.orm import Session
from app.models.action_item import ActionItem


class ActionItemRepository:
    """SQLAlchemy repository for ActionItem."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def list_by_owner(self, owner_id: int) -> list[ActionItem]:
        return (
            self._db.query(ActionItem)
            .filter(ActionItem.owner_id == owner_id)
            .order_by(ActionItem.id.desc())
            .all()
        )

    def get_by_id(self, owner_id: int, item_id: int) -> ActionItem | None:
        return (
            self._db.query(ActionItem)
            .filter(ActionItem.owner_id == owner_id, ActionItem.id == item_id)
            .first()
        )

    def create(
        self,
        owner_id: int,
        title: str,
        description: str | None = None,
        category: str = "To Do",
        priority: str = "Medium",
        due_date: str | None = None,
    ) -> ActionItem:
        item = ActionItem(
            owner_id=owner_id,
            title=title,
            description=description,
            category=category,
            priority=priority,
            due_date=due_date,
            is_completed=(category == "Completed"),
        )
        self._db.add(item)
        self._db.commit()
        self._db.refresh(item)
        return item

    def update(
        self,
        item: ActionItem,
        title: str | None = None,
        description: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        due_date: str | None = None,
        is_completed: bool | None = None,
    ) -> ActionItem:
        if title is not None:
            item.title = title
        if description is not None:
            item.description = description
        if category is not None:
            item.category = category
            if category == "Completed":
                item.is_completed = True
        if priority is not None:
            item.priority = priority
        if due_date is not None:
            item.due_date = due_date
        if is_completed is not None:
            item.is_completed = is_completed
            if is_completed and item.category != "Completed":
                item.category = "Completed"

        self._db.commit()
        self._db.refresh(item)
        return item

    def delete(self, item: ActionItem) -> None:
        self._db.delete(item)
        self._db.commit()

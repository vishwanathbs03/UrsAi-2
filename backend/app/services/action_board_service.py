"""Action Board Service layer."""

from __future__ import annotations

from datetime import datetime, timezone
from app.repositories.action_item_repository import ActionItemRepository
from app.schemas.action_board import (
    ActionBoardResponse,
    ActionBoardSummary,
    ActionItemCreate,
    ActionItemOut,
    ActionItemUpdate,
)


class ActionBoardService:
    """Service layer managing Action Board CRUD and summary calculations."""

    def __init__(self, repo: ActionItemRepository) -> None:
        self._repo = repo

    def get_board(self, owner_id: int) -> ActionBoardResponse:
        items = self._repo.list_by_owner(owner_id)
        total = len(items)
        completed = sum(1 for i in items if i.is_completed or i.category == "Completed")
        pending = total - completed
        progress = round((completed / total * 100)) if total > 0 else 0

        summary = ActionBoardSummary(
            total_tasks=total,
            pending_tasks=pending,
            completed_tasks=completed,
            progress_pct=progress,
        )

        out_items = [
            ActionItemOut(
                id=i.id,
                owner_id=i.owner_id,
                title=i.title,
                description=i.description,
                category=i.category,
                priority=i.priority,
                due_date=i.due_date,
                is_completed=i.is_completed,
            )
            for i in items
        ]

        now_iso = datetime.now(tz=timezone.utc).isoformat()
        return ActionBoardResponse(
            generated_at=now_iso,
            summary=summary,
            items=out_items,
        )

    def create_task(self, owner_id: int, payload: ActionItemCreate) -> ActionItemOut:
        item = self._repo.create(
            owner_id=owner_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            priority=payload.priority,
            due_date=payload.due_date,
        )
        return ActionItemOut(
            id=item.id,
            owner_id=item.owner_id,
            title=item.title,
            description=item.description,
            category=item.category,
            priority=item.priority,
            due_date=item.due_date,
            is_completed=item.is_completed,
        )

    def update_task(
        self, owner_id: int, item_id: int, payload: ActionItemUpdate
    ) -> ActionItemOut | None:
        item = self._repo.get_by_id(owner_id, item_id)
        if item is None:
            return None

        updated = self._repo.update(
            item,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            priority=payload.priority,
            due_date=payload.due_date,
            is_completed=payload.is_completed,
        )

        return ActionItemOut(
            id=updated.id,
            owner_id=updated.owner_id,
            title=updated.title,
            description=updated.description,
            category=updated.category,
            priority=updated.priority,
            due_date=updated.due_date,
            is_completed=updated.is_completed,
        )

    def delete_task(self, owner_id: int, item_id: int) -> bool:
        item = self._repo.get_by_id(owner_id, item_id)
        if item is None:
            return False
        self._repo.delete(item)
        return True

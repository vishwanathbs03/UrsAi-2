"""Pydantic schemas for Action Board CRUD API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ActionItemCreate(BaseModel):
    """Action item creation request."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    category: str = Field(default="To Do", description="To Do, In Progress, Completed")
    priority: str = Field(default="Medium", description="Critical, High, Medium, Low")
    due_date: str | None = None


class ActionItemUpdate(BaseModel):
    """Action item update request."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    due_date: str | None = None
    is_completed: bool | None = None


class ActionItemOut(BaseModel):
    """Action item output schema."""

    model_config = ConfigDict(extra="forbid")

    id: int
    owner_id: int
    title: str
    description: str | None = None
    category: str
    priority: str
    due_date: str | None = None
    is_completed: bool


class ActionBoardSummary(BaseModel):
    """Summary metrics for action board."""

    model_config = ConfigDict(extra="forbid")

    total_tasks: int
    pending_tasks: int
    completed_tasks: int
    progress_pct: int


class ActionBoardResponse(BaseModel):
    """Action board list + summary response envelope."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    summary: ActionBoardSummary
    items: list[ActionItemOut]

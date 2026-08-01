"""Pydantic schemas for Notifications API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class NotificationItemCreate(BaseModel):
    """Create notification payload."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    category: str = Field(default="general", description="general, reminder, advisor, analytics")


class NotificationItemOut(BaseModel):
    """Notification output schema."""

    model_config = ConfigDict(extra="forbid")

    id: int
    owner_id: int
    title: str
    message: str
    category: str
    is_read: bool
    created_at: str


class NotificationsResponse(BaseModel):
    """Response envelope for GET /api/v1/notifications."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    unread_count: int
    total_count: int
    notifications: list[NotificationItemOut]

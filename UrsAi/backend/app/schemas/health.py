"""Health-check response schemas."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Response payload for the /health endpoint."""

    status: str = Field(default="ok", description="Service health status.")

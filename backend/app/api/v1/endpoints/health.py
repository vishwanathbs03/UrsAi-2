"""Health check endpoints."""

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def healthcheck() -> HealthResponse:
    """Liveness probe. Returns {"status": "ok"} when the service is up."""
    return HealthResponse(status="ok")

"""FastAPI application factory.

Creates and configures the Atlas AI backend application. Keeps startup
side-effects isolated so the app is easy to test.
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.v1 import api_router
from app.config.logging import configure_logging, get_logger
from app.config.settings import get_settings
from app.middleware.cors import install_cors

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler."""
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info("Starting %s v%s (env=%s)", settings.app_name, settings.app_version, settings.app_env)
    yield
    logger.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    """Build and return a configured FastAPI app instance."""
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.app_debug,
        lifespan=lifespan,
    )

    install_cors(app)
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/v1/health",
        }

    return app


app = create_app()

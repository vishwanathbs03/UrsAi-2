"""Application configuration loader.

Centralizes environment-driven settings using pydantic-settings.
Loaded once at startup and shared across the app via get_settings().
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Atlas AI"
    app_env: str = "development"
    app_debug: bool = True
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Logging
    log_level: str = "INFO"

    # Database
    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/atlas_ai"
    )
    database_echo: bool = False

    # AI (placeholder, not used in this milestone)
    ai_provider: str = "placeholder"
    ai_api_key: str = ""

    # Authentication (Sprint 1 Part 3)
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _normalize_cors(cls, value):
        """Accept either a string or an already-parsed list."""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return ",".join(value)
        return value

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins as a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"

    @property
    def cookie_name(self) -> str:
        """Standard name for the auth cookie."""
        return "atlas_access_token"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()

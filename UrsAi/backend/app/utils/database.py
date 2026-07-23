"""SQLAlchemy engine, session factory, and declarative base.

This milestone adds the first business table (``users``) and the
session dependency used by every protected route.
"""

from collections.abc import Generator
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config.settings import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _build_engine(url: str, echo: bool) -> Engine:
    """Build an engine with sensible per-driver settings."""
    parsed = urlparse(url)
    connect_args: dict = {}
    is_sqlite = parsed.scheme.startswith("sqlite")

    if is_sqlite:
        # SQLite ignores pool settings but allows check_same_thread=False
        # so FastAPI's threadpool can reuse a single connection.
        connect_args = {"check_same_thread": False}

    return create_engine(
        url,
        echo=echo,
        connect_args=connect_args,
        future=True,
    )


_settings = get_settings()
engine: Engine = _build_engine(_settings.database_url, _settings.database_echo)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

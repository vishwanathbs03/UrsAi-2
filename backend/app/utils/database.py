"""SQLAlchemy engine, session factory, and declarative base.

Sprint 8 Part 4 — the engine now honours the settings-driven
``db_pool_size`` / ``db_pool_max_overflow`` / ``db_pool_pre_ping``
knobs. SQLite ignores the pool settings but the others apply
cleanly; for the Postgres path the operator sizes the pool to
match the gunicorn worker count.

Sprint 9 Part 2 — adds ``bootstrap_schema()`` so a fresh database
is created from SQLAlchemy metadata at the first connect. The
function is idempotent and safe to call from every worker
(lifespan runs once per worker under gunicorn).
"""

from collections.abc import Generator
import threading
from urllib.parse import urlparse

from sqlalchemy import create_engine, inspect as sqla_inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config.settings import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

# Sprint 9 Part 2 — eagerly import the models package so every
# SQLAlchemy declarative class is registered with ``Base.metadata``
# before the first ``bootstrap_schema()`` call. Without this the
# metadata only contains the models that have been imported
# lazily by request handlers, and a fresh database would end up
# with a partial schema. Imported here (after ``Base`` is
# defined) to avoid the circular import between ``app.utils.database``
# and ``app.models.business`` (the latter imports ``Base``).
from app import models as _models  # noqa: E402,F401  (registration side-effect)


def _build_engine(url: str, echo: bool) -> Engine:
    """Build an engine with sensible per-driver settings."""
    settings = get_settings()
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

    # Production path (Postgres, MySQL, etc.). The pool size and
    # overflow are settings-driven so a horizontally-scaled deploy
    # can right-size the pool per environment. ``pool_pre_ping``
    # is on by default — it costs one SELECT 1 per borrowed
    # connection but kills the silent-fail mode where a load
    # balancer has dropped a backend.
    return create_engine(
        url,
        echo=echo,
        connect_args=connect_args,
        future=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_pool_max_overflow,
        pool_pre_ping=settings.db_pool_pre_ping,
        pool_recycle=settings.db_pool_recycle_seconds,
        pool_timeout=settings.db_pool_timeout_seconds,
    )


_settings = get_settings()
engine: Engine = _build_engine(_settings.database_url, _settings.db_echo)

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


# -- Sprint 9 Part 2: automatic schema bootstrap ----------------------
# A process-local set of DB URLs that have already been bootstrapped,
# guarded by a module-level threading lock so multiple workers can
# call bootstrap_schema() concurrently without racing on DDL.
_bootstrap_lock = threading.Lock()
_bootstrap_done: set[str] = set()


def bootstrap_schema(engine: Engine | None = None) -> bool:
    """Create every table that ``Base.metadata`` knows about on
    ``engine`` (defaults to the module-level engine). Idempotent and
    thread-safe:

      * Safe to call from every gunicorn worker. The threading
        lock plus the per-URL done-set mean the work happens
        exactly once per process.
      * For SQLite (the default) ``CREATE TABLE IF NOT EXISTS``
        makes concurrent workers a no-op.
      * For Postgres the probe (existence of the ``users`` table)
        prevents duplicate-DDL conflicts when multiple workers
        boot concurrently.

    Returns ``True`` if tables were created, ``False`` if the
    schema was already present.
    """
    eng = engine or globals()["engine"]
    key = str(eng.url)
    with _bootstrap_lock:
        if key in _bootstrap_done:
            return False
        insp = sqla_inspect(eng)
        # Probe a known table. ``users`` is created in the very
        # first migration so its presence is a reliable signal
        # that the schema is in place.
        if "users" in insp.get_table_names():
            _bootstrap_done.add(key)
            return False
        Base.metadata.create_all(eng)
        _bootstrap_done.add(key)
        return True

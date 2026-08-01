"""Shared types + session helper for the Business Scenario Simulator.

The Scenario Engine is a *build-on-top* layer. The pattern
is:

  1. Read the real Business row from the request session.
  2. Deep-clone the row + every nested collection into a
     fresh in-memory SQLite session.
  3. Apply hypothetical changes to the clone.
  4. Re-instantiate the existing engines (Intelligence,
     Scores, DNA, Rules, Recommendations, Roadmap) with
     a BusinessRepository wrapping the in-memory session.
  5. Call ``.compute(owner_id)`` on each — they read the
     clone, produce the projected payload, and never
     touch the request session or the real database.
  6. Diff the projected payload against the current
     payload and return the analysis.

The in-memory session is created by
:func:`build_isolated_session` and torn down by the
caller (``session.close()`` + ``engine.dispose()``).
SQLAlchemy's session lifecycle is the engine's contract.

Architecture
------------

The engine does NOT:

  * call an LLM or any external model
  * write to the request database
  * mutate any user state
  * introduce a new ORM model
  * modify the existing engines

Determinism contract
--------------------

Two calls with the same request body and the same
database state must produce byte-identical responses
(sans the response envelope's ``generated_at`` and the
upstream ``*_generated_at`` sidecar timestamps, when
present).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.utils.database import Base


# --------------------------------------------------------------------------- #
# In-memory session helper
# --------------------------------------------------------------------------- #


def build_isolated_session() -> tuple[Session, Engine]:
    """Create a fresh in-memory SQLite session with the
    Atlas AI schema.

    The function returns the session *and* the engine
    that owns it. The engine must be disposed by the
    caller (via :meth:`sqlalchemy.engine.Engine.dispose`)
    when the simulation is complete; otherwise the
    in-memory database will leak.

    Why a new engine: the request's engine is bound to
    the production database (Postgres in production,
    SQLite in dev). The existing engines' SQL queries
    are written for a specific dialect — running them
    against a fresh in-memory SQLite session of the
    same schema means the projection is exact, not
    approximate. Both dev and the verifier run against
    SQLite, so the dialect match is automatic.

    Why :func:`Base.metadata.create_all` and not
    Alembic: the in-memory database is throwaway and
    only needs the schema shape, not the migrations.
    ``create_all`` mirrors whatever the live schema
    happens to be at module-load time, which is what
    the existing services' queries assume.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        future=True,
    )
    # Mirror the live schema. Idempotent.
    Base.metadata.create_all(engine)
    factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=Session,
    )
    return factory(), engine


# --------------------------------------------------------------------------- #
# Internal dataclasses
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ScenarioSnapshots:
    """The current and projected snapshots, with the
    intermediate payload dicts the engine can diff
    against (for the recommendation / roadmap impact
    analysis).

    The dataclass is internal — the API surface uses
    :class:`~app.schemas.scenario.ScenarioResponse`."""

    current_snapshot: dict[str, Any]
    projected_snapshot: dict[str, Any]
    current_recommendations: list[str]
    projected_recommendations: list[str]
    current_roadmap_unlocks: dict[str, list[str]]
    projected_roadmap_unlocks: dict[str, list[str]]

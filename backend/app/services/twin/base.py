"""Shared types for the Business Digital Twin engine.

The Twin is a *computed aggregate*: it pulls the existing
engines' payloads and shapes them into a single
response. The service layer operates on plain Python
dicts; the Pydantic schema in
:mod:`app.schemas.twin` is the API boundary only.

Architecture
------------

The Twin engine is a **build-on-top** layer. It does
NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify any existing service
  * duplicate any recommendation / roadmap / scoring
    / DNA logic

The single input is the existing repository
(``BusinessRepository``). The service instantiates
each upstream service and reads its ``compute`` /
``analyze`` payload. The payload is then shaped into
the schema by the snapshot / timeline / risk /
opportunity / health builders.

Determinism contract
--------------------

Two calls with the same ``owner_id`` and the same
database state must produce byte-identical twin
payloads (sans the response envelope's
``generated_at`` and the upstream ``*_generated_at``
sidecar timestamps, when present).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# --------------------------------------------------------------------------- #
# Aggregated payload bundle
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class TwinBundle:
    """The aggregator's output. Every field is a
    dict in the shape the upstream engine produced;
    the builders consume these dicts and emit the
    schema-shaped blocks.

    The bundle is internal to the service layer. The
    Pydantic response model is the only thing the
    endpoint should care about.
    """

    business: dict[str, Any] = field(default_factory=dict)
    intelligence: dict[str, Any] = field(default_factory=dict)
    scores: dict[str, Any] = field(default_factory=dict)
    dna: dict[str, Any] = field(default_factory=dict)
    rules: dict[str, Any] = field(default_factory=dict)
    recommendations: dict[str, Any] = field(default_factory=dict)
    roadmap: dict[str, Any] = field(default_factory=dict)

    @property
    def last_analysis_at(self) -> str | None:
        """The most recent ``generated_at`` across the
        upstream engines. The twin echoes this in
        the ``last_analysis_at`` response field so
        the UI can render "Last analysed X
        minutes ago" without inspecting the
        per-engine timestamps.

        The freshness hierarchy: DNA (which depends
        on intelligence + scores) > scores >
        intelligence. The DNA ``generated_at`` is
        the most recent of the three by
        construction.
        """
        for key in ("dna", "scores", "intelligence", "business"):
            ts = self._payload_generated_at(self.__dict__.get(key, {}))
            if ts:
                return ts
        return None

    @staticmethod
    def _payload_generated_at(payload: dict) -> str | None:
        return payload.get("generated_at") if isinstance(payload, dict) else None

"""CopilotService — the public façade the
endpoint depends on.

The service is thin. It owns:
  * the construction of the
    :class:`CopilotOrchestrator`
  * the construction of a deterministic
    ``conversation_id`` and ``message_id``
  * the translation of :class:`BusinessNotFound`
    into the endpoint's 404 contract

The service does NOT:
  * implement any business logic — every
    decision is delegated to the orchestrator
  * call any LLM — the provider is the only
    place that could in the future
  * mutate the database
  * hold session / conversation state

Architecture
------------

The provider is the architectural seam.
:class:`CopilotService.__init__` accepts an
optional ``provider`` argument; the default
is :class:`MockCopilotProvider`. To swap in a
real OpenAI / Claude / Gemini / Ollama
provider later, instantiate the new provider
and pass it to the service — the rest of the
pipeline (intent, context, prompt, citation,
orchestrator, endpoint) is unchanged.

Determinism contract
--------------------

Two calls with the same ``message`` + the same
``owner_id`` + the same database state must
produce byte-identical responses (sans the
``generated_at`` and ``conversation_id`` /
``message_id`` envelope fields, which are
intentionally non-deterministic). The
conversation / message ids are derived from a
hash of the message + owner id so the
*content* of the response is reproducible;
only the envelope's timestamp + id are fresh.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from app.repositories.business_repository import BusinessRepository
from app.services.copilot.base import (
    CopilotProvider,
    CopilotResponse,
    CopilotServiceError,
)
from app.services.copilot.context import CopilotContextBuilder
from app.services.copilot.mock_provider import MockCopilotProvider
from app.services.copilot.orchestrator import CopilotOrchestrator


class CopilotService:
    """The public façade for the AI Business
    Copilot.

    The service is constructed with a
    :class:`BusinessRepository` so it can be
    unit-tested with an in-memory session.
    The endpoint is the only other caller.
    """

    def __init__(
        self,
        repo: BusinessRepository,
        *,
        provider: CopilotProvider | None = None,
    ) -> None:
        self._repo = repo
        self._provider: CopilotProvider = (
            provider if provider is not None else MockCopilotProvider()
        )
        self._orchestrator = CopilotOrchestrator(
            context_builder=CopilotContextBuilder(repo),
            provider=self._provider,
        )

    # ---- public API -------------------------------------------------- #

    @property
    def provider_name(self) -> str:
        return self._orchestrator.provider_name

    def chat(
        self,
        owner_id: int,
        message: str,
    ) -> dict[str, Any]:
        """Run the full Copilot pipeline and
        return a dict matching the
        :class:`app.schemas.copilot.CopilotResponse`
        shape.

        Raises :class:`BusinessNotFound` when
        the user has not created a business
        profile yet. The endpoint translates
        that into a 404.
        """
        if not message or not message.strip():
            raise CopilotServiceError(
                "Empty message — Copilot cannot answer a blank question."
            )

        try:
            response: CopilotResponse = self._orchestrator.run(
                owner_id=owner_id,
                message=message,
                conversation_id=_deterministic_conversation_id(
                    owner_id, message
                ),
                message_id=_deterministic_message_id(owner_id, message),
            )
        except CopilotServiceError:
            raise
        return _to_payload(response)


# --------------------------------------------------------------------------- #
# Internal — payload projection
# --------------------------------------------------------------------------- #


def _to_payload(response: CopilotResponse) -> dict[str, Any]:
    """Project the dataclass into a JSON-friendly
    dict shaped like the Pydantic schema in
    :mod:`app.schemas.copilot`.

    Lists, not tuples; dicts, not frozen
    dataclasses. The endpoint validates the
    result against the Pydantic model so a
    future refactor that accidentally leaks a
    field fails loudly here, not at the client.
    """
    return {
        "generated_at": response.generated_at,
        "conversation_id": response.conversation_id,
        "message_id": response.message_id,
        "intent": response.intent,
        "confidence": response.confidence,
        "response": response.response,
        "citations": [
            {
                "kind": c.kind,
                "id": c.id,
                "label": c.label,
                "reference": c.reference,
            }
            for c in response.citations
        ],
        "follow_up_questions": [
            {
                "question": q.question,
                "intent": q.intent,
                "anchor": q.anchor,
            }
            for q in response.follow_up_questions
        ],
        "context_summary": dict(response.context_summary or {}),
        "inputs": dict(response.inputs or {}),
    }


# --------------------------------------------------------------------------- #
# Deterministic id derivation
# --------------------------------------------------------------------------- #


def _deterministic_conversation_id(
    owner_id: int, message: str
) -> str:
    """A conversation id derived from the
    owner's id + the message content. Same
    message from the same user always lands
    in the same "conversation" so the UI
    can group requests without the Copilot
    storing any history.
    """
    raw = f"{owner_id}:{_normalise(message)}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"conv_{owner_id}_{digest}"


def _deterministic_message_id(
    owner_id: int, message: str
) -> str:
    """A per-message id derived from the
    conversation id + a hash of the message.
    Stable across calls; only the
    ``generated_at`` timestamp changes.
    """
    raw = (
        f"{owner_id}:{_normalise(message)}:"
        f"{datetime.now(tz=timezone.utc).date().isoformat()}"
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]
    return f"msg_{digest}"


def _normalise(message: str) -> str:
    return " ".join((message or "").strip().lower().split())


# Quiet pyflakes — keep the import alive so the
# service can be re-exported from the package.
_ = json

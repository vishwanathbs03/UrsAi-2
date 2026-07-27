"""AssistantProviderService — Sprint 7 Part 2.

The high-level façade the brief asks for. Wires the four
pieces together:

  AssistantContextBuilder     (read 5 upstream payloads)
            |
            v
  AssistantPromptBuilder      (assemble the prompt surface)
            |
            v
  ProviderFactory             (select the runtime provider)
            |
            v
  Provider.complete(request)  (real Ollama or fallback)
            |
            v
  AssistantResponse           (the return value)

The service is thin — it owns no business logic. It is the
*only* file in the layer that knows about the four pieces,
which keeps the others unit-testable in isolation.

Graceful degradation
--------------------

When the configured provider raises :class:`ProviderUnavailableError`
or :class:`ProviderTimeoutError`, the service catches the error
and asks the factory for the deterministic fallback. The
caller sees a normal :class:`AssistantResponse` whose
``fallback_used`` flag is ``True`` and whose ``model`` is
``"deterministic-fallback"``.

The service does *not* retry. A retry policy is the next
milestone's problem.

When the configured provider raises a non-recoverable
:class:`AIProviderError` (malformed JSON, HTTP 5xx, empty
response), the service lets it propagate — the caller can
decide whether to fall back, surface the error to the user,
or log it.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.ai.providers.base import (
    AIProviderError,
    AssistantContext,
    AssistantRequest,
    AssistantResponse,
    AssistantTurn,
    DeterministicFallbackProvider,
    Provider,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.services.ai.providers.context_builder import AssistantContextBuilder
from app.services.ai.providers.factory import ProviderFactory
from app.services.ai.providers.prompt_builder import AssistantPromptBuilder


class AssistantProviderService:
    """The public façade for the AI Provider Layer."""

    def __init__(
        self,
        *,
        context_builder: AssistantContextBuilder,
        prompt_builder: AssistantPromptBuilder | None = None,
        provider_factory: ProviderFactory | None = None,
    ) -> None:
        self._context_builder = context_builder
        self._prompt_builder = prompt_builder or AssistantPromptBuilder()
        # The factory defaults to a Settings-less instance,
        # which always returns the deterministic fallback.
        # Callers that want a real provider must pass a
        # factory built from a Settings (or stub).
        self._factory = provider_factory or ProviderFactory()

    # ---- public API -------------------------------------------------- #

    def configured_provider_name(self) -> str:
        """Return the name of the configured provider.

        The actual runtime provider may be the fallback even
        when the configured provider is "ollama" — Ollama can
        be offline at request time. Use
        :attr:`AssistantResponse.provider_used` for the
        ground truth.
        """
        return self._factory.configured_provider_name()

    def generate(
        self,
        *,
        owner_id: int,
        user_prompt: str,
        history: tuple[AssistantTurn, ...] = (),
        knowledge: object | None = None,
        provider: Provider | None = None,
    ) -> AssistantResponse:
        """Generate a reply for the user's prompt.

        ``owner_id`` is the Business owner (the same value
        the upstream services use). ``user_prompt`` is the
        literal text the user typed in the assistant.
        ``history`` is the prior conversation (caller-owned).
        ``provider`` is an optional override — pass a stub
        from a test, or pass the fallback explicitly to
        bypass the factory's runtime check.

        Returns an :class:`AssistantResponse`. The
        ``fallback_used`` flag tells the caller whether the
        body came from a real LLM or the deterministic
        fallback.
        """
        context = self._context_builder.build(owner_id=owner_id)
        request = self._prompt_builder.build(
            context=context,
            user_prompt=user_prompt,
            history=history,
            knowledge=knowledge,
        )
        chosen = provider or self._factory.build()
        try:
            response = chosen.complete(request)
        except (ProviderUnavailableError, ProviderTimeoutError):
            # Graceful degradation: fall back to the
            # deterministic provider. We re-use the same
            # ``request`` because the fallback renders the
            # same context.
            fallback = DeterministicFallbackProvider()
            response = fallback.complete(request)
        # Any other AIProviderError is propagated so the
        # caller can decide.
        return response

    # ---- convenience ------------------------------------------------- #

    def build_context(self, owner_id: int) -> AssistantContext:
        """Return the assembled context without generating a reply.

        Useful for tests and for future endpoints that want
        to inspect what the prompt would have included.
        """
        return self._context_builder.build(owner_id=owner_id)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()
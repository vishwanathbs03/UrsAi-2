"""ProviderFactory — Sprint 7 Part 2.

Selects the concrete provider at runtime from
``Settings.ai_provider``. Always returns a usable provider —
when the configured provider is unavailable, the factory
returns the deterministic fallback rather than raising.

Selection rules
---------------

  * ``ai_provider == "ollama"``   -> construct :class:`OllamaProvider`
                                       and ping it. If the ping fails,
                                       return the deterministic
                                       fallback instead.
  * anything else (including ``"placeholder"``, ``"disabled"``,
    ``""``, ``None``)              -> return the deterministic
                                       fallback directly.

The factory is the *only* place in the layer that decides
which provider to use. The :class:`AssistantProviderService`
takes the factory's output and treats it as an opaque
:class:`Provider` — it never asks which concrete class it got.
That separation is what keeps the verifier simple: it asks
the factory for "the ollama-or-fallback provider", looks at
``provider_used`` on the response, and the rest is opaque.
"""
from __future__ import annotations

from typing import Any

from app.services.ai.providers.base import (
    AIProviderError,
    AssistantContext,
    AssistantRequest,
    AssistantResponse,
    DeterministicFallbackProvider,
    Provider,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.services.ai.providers.ollama import OllamaProvider


class ProviderFactory:
    """Construct a :class:`Provider` from a Settings-like object.

    The factory accepts any object with the four attributes
    (``ai_provider``, ``ollama_base_url``, ``ollama_model``,
    ``ai_request_timeout_seconds``) — this is the same shape
    :class:`app.config.settings.Settings` exposes. Tests can
    pass a tiny stub.
    """

    def __init__(self, settings: Any | None = None) -> None:
        self._settings = settings

    # ---- public API -------------------------------------------------- #

    def build(self) -> Provider:
        """Build the configured provider, falling back on failure."""
        provider_name = self._provider_name()
        if provider_name == "ollama":
            return self._build_ollama_or_fallback()
        # Any other value: deterministic fallback only.
        return DeterministicFallbackProvider()

    def fallback(self) -> Provider:
        """Return the deterministic fallback unconditionally."""
        return DeterministicFallbackProvider()

    # ---- internal ---------------------------------------------------- #

    def _provider_name(self) -> str:
        if self._settings is None:
            return ""
        return str(getattr(self._settings, "ai_provider", "") or "").strip().lower()

    def _build_ollama_or_fallback(self) -> Provider:
        base_url = str(
            getattr(self._settings, "ollama_base_url", "") or ""
        ).strip()
        model = str(
            getattr(self._settings, "ollama_model", "") or "llama3.1"
        ).strip()
        timeout = float(
            getattr(self._settings, "ai_request_timeout_seconds", 60.0) or 60.0
        )
        provider = OllamaProvider(
            base_url=base_url,
            model=model,
            timeout=timeout,
        )
        # A successful ping means Ollama is reachable; the
        # factory hands the real provider to the service. A
        # failed ping is *not* an error — we just fall back.
        if provider.ping():
            return provider
        # Make sure the unused client is closed so the test
        # runner doesn't leak sockets.
        provider.close()
        return DeterministicFallbackProvider()

    # ---- convenience for callers that want to inspect the name ------- #

    def configured_provider_name(self) -> str:
        """Return the configured provider name (lower-cased).

        Useful for logging and for the verifier. The actual
        runtime provider may be the fallback — check
        ``AssistantResponse.provider_used`` for that.
        """
        return self._provider_name()
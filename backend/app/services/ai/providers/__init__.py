"""AI Provider Layer — Sprint 7 — Part 2.

The layer is the pluggable seam between the existing Atlas AI engines
(Twin, Recommendations, Roadmap, Rules, Insights) and a real LLM. The
intent: when the user types a prompt into the AI Business Assistant
(Sprint 7 Part 1, frontend), the *backend* can route the assembled
context through a real model — Ollama today, OpenAI / Claude /
Gemini / Azure later — without touching the assistant UI or the
deterministic builders.

Public surface
--------------

  AssistantProviderService
      The high-level façade. Composes ContextBuilder,
      PromptBuilder, and a Provider. Has a single method
      ``generate(prompt, *, conversation_history=())`` that returns
      an :class:`AssistantResponse`.

  ProviderFactory
      Selects the concrete provider at runtime from
      ``Settings.ai_provider``. Always returns a usable provider —
      when the configured provider is unavailable, the factory
      returns the deterministic fallback rather than raising.

  OllamaProvider
      Real provider that calls the local Ollama HTTP server at
      ``Settings.ollama_base_url`` with the model in
      ``Settings.ollama_model``. Has a hard timeout
      (``Settings.ai_request_timeout_seconds``).

What this layer is NOT
----------------------

  * It does NOT change the assistant UI. Sprint 7 Part 1 is
    untouched; the frontend builder in
    ``frontend/features/assistant/builder.ts`` is the source of
    truth for the deterministic path.
  * It does NOT change the existing AI Decision engine
    (``app/services/ai/{base,context_builder,prompt_builder,mock_provider,response_parser,service}.py``)
    or the AI Business Copilot
    (``app/services/copilot/**``). This layer is a sibling.
  * It does NOT re-compute any business logic. The five
    upstream payloads are read once and projected into the
    :class:`AssistantContext`; the builder never re-derives
    a score, a recommendation, or a rule.
  * It does NOT stream. ``complete()`` returns a single
    :class:`AssistantResponse`. The brief says "Streaming" is
    out of scope.
  * It does NOT persist conversation history. The
    :class:`AssistantRequest` carries the conversation only as
    a prompt-input parameter (a tuple of past turns); nothing
    in the layer writes to disk.

Determinism contract
--------------------

When Ollama is unreachable, the factory returns a deterministic
fallback that mirrors the frontend's builder. Two calls with the
same inputs produce byte-identical responses (sans the
``generated_at`` envelope field, which is intentionally fresh).
The two-call byte-equality check is the verifier's determinism
gate.
"""
from app.services.ai.providers.base import (
    AIProviderError,
    AssistantContext,
    AssistantContextScore,
    AssistantContextDna,
    AssistantContextRecommendation,
    AssistantContextRoadmap,
    AssistantContextRule,
    AssistantContextInsight,
    AssistantRequest,
    AssistantResponse,
    AssistantTurn,
    DeterministicFallbackProvider,
    Provider,
    ProviderUnavailableError,
    ProviderTimeoutError,
)
from app.services.ai.providers.context_builder import AssistantContextBuilder
from app.services.ai.providers.factory import ProviderFactory
from app.services.ai.providers.ollama import OllamaProvider
from app.services.ai.providers.prompt_builder import AssistantPromptBuilder
from app.services.ai.providers.service import AssistantProviderService

__all__ = [
    "AIProviderError",
    "AssistantContext",
    "AssistantContextBuilder",
    "AssistantContextDna",
    "AssistantContextInsight",
    "AssistantContextRecommendation",
    "AssistantContextRoadmap",
    "AssistantContextRule",
    "AssistantContextScore",
    "AssistantPromptBuilder",
    "AssistantProviderService",
    "AssistantRequest",
    "AssistantResponse",
    "AssistantTurn",
    "DeterministicFallbackProvider",
    "OllamaProvider",
    "Provider",
    "ProviderFactory",
    "ProviderTimeoutError",
    "ProviderUnavailableError",
]
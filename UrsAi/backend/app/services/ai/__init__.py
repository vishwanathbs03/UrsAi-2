"""AI Decision Engine.

Sprint 3 — Part 2.

This package is the seam between the deterministic Atlas AI
pipeline (intelligence → scores → DNA → rules) and a future
LLM-backed explanation layer. The spec for this milestone says
"do NOT call a real LLM" — so the implementation is:

  * A :class:`LLMProvider` protocol that any future OpenAI / Claude
    / Gemini / Ollama / in-house model can satisfy.
  * A :class:`MockLLMProvider` that produces a deterministic,
    template-based response. The output is shaped exactly like a
    future LLM response, so swapping in a real provider later is a
    one-line change in :class:`AIDecisionService`.
  * A :class:`PromptBuilder` that turns the structured context
    into the prompt the LLM would receive. Pure function.
  * A :class:`ContextBuilder` that gathers the four upstream
    payloads (intelligence, scores, DNA, rules) and retrieves the
    matching knowledge articles. Pure function over the existing
    services.
  * A :class:`ResponseParser` that turns the LLM response text
    into the structured :class:`AIDecisionResponse` schema. Pure
    function with a deterministic fallback.
  * A :class:`AIDecisionService` façade that wires the four
    pieces together, stamps ``generated_at``, and handles the
    BusinessNotFound 404 path.

What the engine is NOT:
  * It does NOT call any LLM. The mock provider is the only
    implementation shipped this milestone.
  * It does NOT mutate any persistent state.
  * It does NOT generate recommendations or chat. The
    ``insights`` it returns are descriptive explanations of the
    upstream rule firings, not prescriptive actions.
"""

from app.services.ai.base import (
    AIProviderError,
    AIDecision,
    AIInsight,
    AIKnowledgeRef,
    AIRuleRef,
    AIContext,
    AIInputs,
    AIScoreSnapshot,
    LLMPrompt,
    LLMProvider,
    LLMResponse,
)
from app.services.ai.context_builder import ContextBuilder
from app.services.ai.mock_provider import MockLLMProvider
from app.services.ai.prompt_builder import PromptBuilder
from app.services.ai.response_parser import ResponseParser
from app.services.ai.service import AIDecisionService

__all__ = [
    "AIContext",
    "AIDecision",
    "AIDecisionService",
    "AIInsight",
    "AIInputs",
    "AIKnowledgeRef",
    "AIProviderError",
    "AIRuleRef",
    "AIScoreSnapshot",
    "ContextBuilder",
    "LLMPrompt",
    "LLMProvider",
    "LLMResponse",
    "MockLLMProvider",
    "PromptBuilder",
    "ResponseParser",
]

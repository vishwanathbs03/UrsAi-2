"""AI Business Copilot — Sprint 6 — Part 1.

A conversational business consultant that
orchestrates the existing Atlas AI engines. The
Copilot is **not** a chatbot that calls an LLM:
it is a *deterministic, rule-based* orchestrator
that reads from the existing services (intelligence,
scoring, DNA, rules, recommendations, roadmap,
knowledge, finance, twin) and composes a structured
business answer from the same data the rest of the
API already exposes.

The Copilot is a **build-on-top** layer. It does
NOT:

  * call an LLM, OpenAI, Claude, Gemini, Ollama,
    or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify any existing service
  * duplicate any recommendation / scoring /
    DNA / rules / roadmap logic
  * store conversation history
  * use embeddings, a vector DB, or a chat
    memory
  * stream responses

The provider abstraction (LLMProvider Protocol)
is the architectural seam: a real OpenAI /
Claude / Gemini / Ollama provider can be plugged
in later by passing a different ``provider`` to
:class:`CopilotService`; the rest of the pipeline
is unchanged.

The Copilot responds in a fixed shape:

  * ``intent``              — which business
    question the user asked
  * ``confidence``          — how certain the
    intent detector is (0..100)
  * ``response``            — the deterministic
    text body the mock provider generated
  * ``citations``           — every source the
    response leaned on (rule ids, recommendation
    ids, article ids, score keys, roadmap ids)
  * ``follow_up_questions`` — 3 deterministic
    follow-up questions to keep the user in
    flow
  * ``context_summary``     — small metadata
    describing which engines the copilot read
  * ``inputs``              — sidecar of upstream
    ``generated_at`` timestamps (every
    ``*_generated_at`` echoed, matching the
    convention every other Atlas AI engine
    uses)

Determinism contract
--------------------

Two calls with the same ``message`` and the same
database state must produce byte-identical Copilot
responses (sans the response envelope's
``generated_at``). The intent detector is
rule-based; the provider is a pure template; the
follow-up generator is a pure function of the
intent. No randomness, no time, no I/O.
"""

from app.services.copilot.base import (
    CITATION_KINDS,
    Citation,
    CopilotContext,
    CopilotInputs,
    CopilotPrompt,
    CopilotProvider,
    CopilotProviderOutput,
    CopilotResponse,
    CopilotServiceError,
    FollowUpQuestion,
    INTENTS,
    INTENT_KEYWORDS,
    INTENT_PRIMARY_SPECIFICITY,
    INTENT_PRIMARY_STEMS,
    IntentCategory,
    IntentResult,
)
from app.services.copilot.citation import CitationBuilder
from app.services.copilot.context import CopilotContextBuilder
from app.services.copilot.intent import IntentEngine
from app.services.copilot.mock_provider import MockCopilotProvider
from app.services.copilot.orchestrator import CopilotOrchestrator
from app.services.copilot.prompt_builder import CopilotPromptBuilder
from app.services.copilot.service import CopilotService

__all__ = [
    "CITATION_KINDS",
    "Citation",
    "CopilotContext",
    "CopilotInputs",
    "CopilotPrompt",
    "CopilotProvider",
    "CopilotProviderOutput",
    "CopilotResponse",
    "CopilotServiceError",
    "FollowUpQuestion",
    "INTENTS",
    "INTENT_KEYWORDS",
    "INTENT_PRIMARY_SPECIFICITY",
    "INTENT_PRIMARY_STEMS",
    "IntentCategory",
    "IntentResult",
    "CitationBuilder",
    "CopilotContextBuilder",
    "IntentEngine",
    "MockCopilotProvider",
    "CopilotOrchestrator",
    "CopilotPromptBuilder",
    "CopilotService",
]

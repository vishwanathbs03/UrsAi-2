"""Shared types for the AI Decision Engine.

The dataclasses here are the contract between the four moving
parts (ContextBuilder, PromptBuilder, LLMProvider, ResponseParser)
and the service façade. Keeping them as plain dataclasses — not
Pydantic — lets the service compose them cheaply and keeps the
LLM provider agnostic to the API schema.

The wire-format schema lives in
:mod:`app.schemas.ai`; the service translates between the two.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


# --------------------------------------------------------------------------- #
# Domain types — what the LLM sees
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AIScoreSnapshot:
    """Compact view of one business score for the LLM context."""

    key: str
    title: str
    score: int
    level: str


@dataclass(frozen=True)
class AIRuleRef:
    """Compact view of one rule firing the LLM should reference."""

    id: str
    title: str
    category: str
    priority: str
    estimated_impact: int
    reason: str


@dataclass(frozen=True)
class AIKnowledgeRef:
    """Compact view of one retrieved knowledge article."""

    id: str
    title: str
    summary: str
    topic: str
    category: str
    relevance: int  # 0..100, set by the retriever


@dataclass(frozen=True)
class AIContext:
    """Everything the LLM needs to write a decision.

    Built by :class:`~app.services.ai.context_builder.ContextBuilder`
    from the four upstream payloads. Kept narrow on purpose — the
    LLM does not need the full business profile, only the slices
    that explain the rules.
    """

    business_id: int
    archetype_key: str
    archetype_title: str
    archetype_match_score: int
    intelligence_overall: int
    scores: tuple[AIScoreSnapshot, ...]
    rules: tuple[AIRuleRef, ...]
    knowledge: tuple[AIKnowledgeRef, ...]


# --------------------------------------------------------------------------- #
# Provider protocol + response types
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AIInputs:
    """Sidecar echoed in the API response so the UI can show
    'Decision generated at X, intelligence at Y, ...'."""

    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None
    rules_generated_at: str | None = None
    model: str = "mock-llm-1"


@dataclass(frozen=True)
class AIInsight:
    """One structured insight inside the decision response.

    ``explanation`` is what the LLM 'says' about the rule
    firing. ``supporting_rule_ids`` and ``supporting_article_ids``
    trace every claim back to its source — the response is
    auditable, not a black box.
    """

    id: str
    title: str
    explanation: str
    category: str
    priority: str
    confidence: int  # 0..100
    supporting_rule_ids: tuple[str, ...] = field(default_factory=tuple)
    supporting_article_ids: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class AIDecision:
    """The LLM's structured decision, before envelope wrapping."""

    summary: str
    archetype_label: str
    overall_health: str
    top_strengths: tuple[str, ...] = field(default_factory=tuple)
    top_risks: tuple[str, ...] = field(default_factory=tuple)
    insights: tuple[AIInsight, ...] = field(default_factory=tuple)


# --------------------------------------------------------------------------- #
# Prompt + LLM response envelopes
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class LLMPrompt:
    """The text + metadata a real LLM call would send."""

    system: str
    user: str
    context: AIContext


@dataclass(frozen=True)
class LLMResponse:
    """The structured response a real LLM call would return.

    Real providers (OpenAI, Claude, ...) will be coaxed into
    returning JSON that matches this shape. The mock provider
    already produces it.
    """

    decision: AIDecision
    raw_text: str = ""


# --------------------------------------------------------------------------- #
# Provider interface
# --------------------------------------------------------------------------- #


class LLMProvider(Protocol):
    """Protocol every concrete LLM backend must satisfy.

    The mock provider and any future real provider share this
    surface. AIDecisionService depends on the protocol, not the
    implementation, so swapping providers is a one-line change.
    """

    name: str

    def complete(self, prompt: LLMPrompt) -> LLMResponse:
        """Generate a structured decision for ``prompt``."""
        raise NotImplementedError


class AIProviderError(RuntimeError):
    """Raised by an :class:`LLMProvider` when it cannot answer.

    The endpoint surfaces this as a 502 Bad Gateway — the AI
    subsystem is reachable, but the upstream LLM failed.
    """

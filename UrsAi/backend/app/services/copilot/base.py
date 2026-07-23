"""Shared types for the AI Business Copilot.

The Copilot's pipeline is a 5-stage deterministic
orchestration:

  IntentEngine        — rule-based intent detection
                        over the user's free-text
                        ``message``
        |
        v
  CopilotContextBuilder — gather *only* the
                          upstream services the
                          intent needs
        |
        v
  CopilotPromptBuilder  — turn the context into
                           a :class:`CopilotPrompt`
                           ready for any provider
        |
        v
  CopilotProvider       — mock today, swappable
                          for OpenAI / Claude /
                          Gemini / Ollama
        |
        v
  CitationBuilder       — collect every source id
                          the response leaned on

The dataclasses here are the contract between the
five moving parts. They are plain Python — not
Pydantic — so the provider stays free of FastAPI
coupling. The wire-format schema lives in
:mod:`app.schemas.copilot`; the service façade
translates between the two.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


# --------------------------------------------------------------------------- #
# Intent taxonomy — the 14 spec'd categories
# --------------------------------------------------------------------------- #


IntentCategory = str

# Order matters for tie-breaking: more specific
# categories are declared first, GENERAL_BUSINESS
# near the end, and UNKNOWN last. When two
# intents have the same score, the one declared
# earlier wins. This ensures "What is my
# business DNA?" lands on DNA (specific term)
# rather than GENERAL_BUSINESS (the catch-all).
INTENTS: tuple[IntentCategory, ...] = (
    "GREETING",
    "BUSINESS_SCORE",
    "EXPORT",
    "DIGITAL",
    "COMPLIANCE",
    "DNA",
    "ROADMAP",
    "RECOMMENDATIONS",
    "RULES",
    "SCENARIO",
    "OCR",
    "FINANCE",
    "GENERAL_BUSINESS",
    "UNKNOWN",
)


# Per-intent PRIMARY stem specificity — a
# hand-tuned weight per primary stem that
# captures how *specific* the stem is to its
# intent. Higher = more specific. The
# weights are tuned so:
#   * "digital" (7 chars) outranks
#     "my business" (11 chars) on the
#     primary_chars axis, because "my
#     business" is a generic phrase that
#     appears in every business question.
#   * "export" outranks "my company"
#     because "export" is the domain term.
#   * The sum of all specificity weights
#     in any one intent's primary list is
#     the tie-breaker when two intents
#     have the same primary_hits.
INTENT_PRIMARY_SPECIFICITY: dict[str, int] = {
    # GREETING — pure greetings; specificity
    # is roughly even.
    "hello": 5, "hi": 5, "hey": 5, "namaste": 8,
    "howdy": 8, "hola": 8,
    # BUSINESS_SCORE — high-specificity terms.
    "score": 10, "scores": 10, "scoring": 10, "rating": 9,
    "business score": 15, "business health": 14,
    "health score": 12, "readiness score": 12,
    # EXPORT — high-specificity terms.
    "export": 12, "exports": 12, "exporting": 12,
    "international": 11, "iec": 14, "global": 9,
    "overseas": 11,
    "export readiness": 18, "export ready": 16,
    # DIGITAL — high-specificity terms.
    "digital": 14, "digitization": 14, "digitisation": 14,
    "ecommerce": 12, "e-commerce": 12, "automation": 11,
    "saas": 12, "digital transformation": 18,
    "digital presence": 16, "digital readiness": 16,
    # COMPLIANCE — high-specificity terms.
    "compliance": 12, "compliant": 12, "regulation": 11,
    "regulatory": 11, "licensing": 12, "certification": 12,
    "gst": 14, "gstin": 16, "pan": 13, "udyam": 14,
    "msme": 13, "fssai": 14, "iso": 12, "trademark": 12,
    # DNA — high-specificity terms.
    "dna": 16, "archetype": 14, "personality": 10,
    "traits": 10, "business dna": 18,
    "business identity": 14, "business personality": 14,
    # ROADMAP — high-specificity terms.
    "roadmap": 12, "timeline": 10, "scheduling": 10,
    "first step": 14, "next step": 12, "first task": 14,
    "where to start": 14, "where should i start": 14,
    "where do i start": 14, "how to start": 12,
    "getting started": 12, "execution plan": 14,
    "sequence of actions": 12,
    # RECOMMENDATIONS — high-specificity terms.
    "recommend": 12, "recommendation": 12,
    "recommendations": 12, "recommended": 12,
    "suggestion": 10, "suggestions": 10,
    "action items": 12, "next actions": 12,
    # RULES — high-specificity terms.
    "rule": 10, "rules": 10, "issue": 9, "issues": 9,
    "gap": 11, "gaps": 11, "violation": 13, "violations": 13,
    "finding": 11, "findings": 11, "alert": 10, "alerts": 10,
    "warning": 9, "warnings": 9,
    # SCENARIO — high-specificity terms.
    "scenario": 14, "scenarios": 14, "what if": 14,
    "what-if": 14, "simulate": 14, "simulation": 14,
    "hypothetical": 12, "projection": 12, "projections": 12,
    "forecast": 12, "best case": 12, "worst case": 12,
    # OCR — high-specificity terms.
    "ocr": 16, "scan": 10, "scanning": 10, "upload": 8,
    "uploaded": 8, "upload document": 12,
    "upload documents": 12, "certificate": 8,
    "gst certificate": 14, "pan card": 14,
    "iec certificate": 14, "extract": 10, "extraction": 10,
    # FINANCE — high-specificity terms.
    "finance": 12, "financial": 12, "revenue": 12,
    "profit": 12, "valuation": 12, "loan": 10, "loans": 10,
    "funding": 12, "investment": 11, "investor": 11,
    "credit": 10, "cash flow": 13, "pricing": 10,
    "payback": 12,
    # GENERAL_BUSINESS — low-specificity catch-alls.
    "small business": 4, "my business": 2, "my profile": 2,
    "company profile": 3, "business profile": 3,
    "company overview": 3, "business overview": 3,
}


# Per-intent PRIMARY stems — a small set of
# high-specificity keywords. When a primary
# stem matches, the intent receives a
# specificity boost (see :class:`IntentEngine`)
# so it can win against a competing catch-all
# intent like GENERAL_BUSINESS. This is what
# makes "What is my business DNA?" land on DNA
# (the word "dna" is a primary stem) rather
# than GENERAL_BUSINESS (the word "business"
# is a generic term that appears in every
# business question).
INTENT_PRIMARY_STEMS: dict[IntentCategory, tuple[str, ...]] = {
    "GREETING":         (
        "hello", "hi", "hey", "namaste", "howdy", "hola",
    ),
    "BUSINESS_SCORE":   (
        "score", "scores", "scoring", "rating",
        "business score", "business health",
        "health score", "readiness score",
    ),
    "EXPORT":           (
        "export", "exports", "exporting", "international",
        "iec", "global", "overseas",
        "export readiness", "export ready",
    ),
    "DIGITAL":          (
        "digital", "digitization", "digitisation",
        "ecommerce", "e-commerce", "automation",
        "saas", "digital transformation",
        "digital presence", "digital readiness",
    ),
    "COMPLIANCE":       (
        "compliance", "compliant", "regulation",
        "regulatory", "licensing", "certification",
        "gst", "gstin", "pan", "udyam", "msme",
        "fssai", "iso", "trademark",
    ),
    "DNA":              (
        "dna", "archetype", "personality", "traits",
        "business dna", "business identity",
        "business personality",
    ),
    "ROADMAP":          (
        "roadmap", "timeline", "scheduling",
        "first step", "next step", "where to start",
        "where should i start", "where do i start",
        "how to start", "getting started",
        "execution plan", "sequence of actions",
    ),
    "RECOMMENDATIONS":  (
        "recommend", "recommendation",
        "recommendations", "recommended",
        "suggestion", "suggestions",
        "action items", "next actions",
    ),
    "RULES":            (
        "rule", "rules", "issue", "issues", "gap",
        "gaps", "violation", "violations", "finding",
        "findings", "alert", "alerts",
        "warning", "warnings",
    ),
    "SCENARIO":         (
        "scenario", "scenarios", "what if", "what-if",
        "simulate", "simulation", "hypothetical",
        "projection", "projections", "forecast",
        "best case", "worst case",
    ),
    "OCR":              (
        "ocr", "scan", "scanning", "upload",
        "uploaded", "upload document",
        "upload documents", "certificate",
        "gst certificate", "pan card",
        "iec certificate", "extract", "extraction",
    ),
    "FINANCE":          (
        "finance", "financial", "revenue", "profit",
        "valuation", "loan", "loans", "funding",
        "investment", "investor", "credit",
        "cash flow", "pricing", "payback",
    ),
    "GENERAL_BUSINESS": (
        "small business", "my business", "business profile",
        "company overview", "business overview",
    ),
}


# Intent -> lower-cased keyword stems. The
# :class:`IntentEngine` scans the user's message
# for any of these stems. Order is not significant
# — the engine picks the *highest*-scoring intent,
# with ties broken by (a) longer match, then (b)
# order of declaration.
INTENT_KEYWORDS: dict[IntentCategory, tuple[str, ...]] = {
    "GREETING": (
        "hello", "hi", "hey", "good morning",
        "good afternoon", "good evening", "greetings",
        "namaste", "how are you", "howdy", "hola",
    ),
    "BUSINESS_SCORE": (
        "score", "scores", "scoring", "rating",
        "business score", "business health",
        "overall health", "health score",
        "business index", "readiness score",
        "readiness",
    ),
    "EXPORT": (
        "export", "exports", "exporting", "international",
        "overseas", "foreign", "iec", "iec code",
        "global", "shipping", "ship abroad",
        "export readiness", "export ready",
    ),
    "DIGITAL": (
        "digital", "digitization", "digitisation",
        "online", "website", "ecommerce", "e-commerce",
        "automation", "software", "saas", "tech",
        "technology", "internet", "social media",
        "digital transformation", "digital presence",
    ),
    "COMPLIANCE": (
        "compliance", "compliant", "regulation",
        "regulations", "regulatory", "license", "licence",
        "licensing", "certification", "certifications",
        "gst", "gstin", "pan", "udyam", "msme",
        "registration", "fssai", "iso", "trademark",
    ),
    "DNA": (
        "dna", "archetype", "personality", "identity",
        "business personality", "business identity",
        "character", "nature", "traits",
    ),
    "ROADMAP": (
        "roadmap", "plan", "planning", "timeline",
        "schedule", "scheduling", "order", "sequence",
        "first step", "next step", "first task",
        "where to start", "where should i start",
        "where do i start", "how to start",
        "getting started", "begin", "begin with",
        "execution plan", "phasing", "phases",
        "sequence of actions", "what to do first",
        "what should i do first",
    ),
    "RECOMMENDATIONS": (
        "recommend", "recommendation", "recommendations",
        "recommended", "suggestion", "suggestions",
        "what should i", "what to do", "advice",
        "actions", "action items", "next actions",
    ),
    "RULES": (
        "rule", "rules", "issue", "issues", "problem",
        "problems", "gap", "gaps", "violation",
        "violations", "finding", "findings", "alert",
        "alerts", "risk", "risks", "warning", "warnings",
    ),
    "SCENARIO": (
        "scenario", "scenarios", "what if", "what-if",
        "simulate", "simulation", "hypothetical",
        "project", "projection", "projections", "forecast",
        "forecast", "predict", "predicted", "best case",
        "worst case", "undo", "preview",
    ),
    "OCR": (
        "ocr", "scan", "scanning", "document", "documents",
        "upload", "uploaded", "upload document",
        "upload documents", "certificate", "udyam",
        "gst certificate", "pan card", "iec certificate",
        "extract", "extraction",
    ),
    "FINANCE": (
        "finance", "financial", "money", "revenue",
        "profit", "cost", "costs", "roi", "valuation",
        "loan", "loans", "funding", "investment",
        "investor", "credit", "cash flow", "pricing",
        "pricing", "payout", "payback",
    ),
    "GENERAL_BUSINESS": (
        "my company", "my firm", "my smb", "my msme",
        "my sme", "my startup", "my start-up", "my enterprise",
        "small business", "my business", "my profile",
        "company profile", "business profile",
        "tell me about", "summary of",
    ),
}


# --------------------------------------------------------------------------- #
# Citation kinds
# --------------------------------------------------------------------------- #


# All distinct kinds the CitationBuilder may
# emit. The spec example lists:
#   * Recommendation IDs
#   * Rule IDs
#   * Knowledge Article IDs
#   * Roadmap IDs
#   * Business Score Keys
# We add a sixth for completeness:
#   * DNA keys (archetype / trait identifiers)
#   * Intelligence keys (analyzer keys the
#     response touched on)
CITATION_KINDS: tuple[str, ...] = (
    "recommendation",
    "rule",
    "article",
    "roadmap",
    "score",
    "dna",
    "intelligence",
)


# --------------------------------------------------------------------------- #
# Domain types
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Citation:
    """A single source the Copilot response leaned on.

    The kind is the *kind* of source (rule /
    recommendation / article / roadmap item /
    score key / DNA key / intelligence key). The
    id is the stable id within that kind. The
    label is a human-readable title so the UI can
    render a one-line chip without a follow-up
    fetch. The reference field is a one-sentence
    reason this citation was included — the UI
    can show it as a tooltip.
    """

    kind: str
    id: str
    label: str
    reference: str = ""


@dataclass(frozen=True)
class FollowUpQuestion:
    """A single follow-up question.

    The ``anchor`` is the id of the citation the
    question is anchored to, so the UI can show
    "Question about recommendation R-001" instead
    of just "What certification should I obtain
    first?". When the question is generic (e.g.
    "What is my business DNA?"), the anchor is
    empty.
    """

    question: str
    intent: IntentCategory
    anchor: str = ""


# --------------------------------------------------------------------------- #
# Intent detection
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class IntentResult:
    """The output of the rule-based :class:`IntentEngine`.

    ``category`` is one of :data:`INTENTS`.
    ``confidence`` is a 0..100 integer; the engine
    produces a deterministic score from (a) the
    number of distinct keyword matches, and (b)
    the longest matched stem length. The score is
    clamped to ``[0, 100]`` and the
    ``UNKNOWN`` intent always reports 0.

    ``matched_keywords`` is a debug aid — the
    list of (intent, stem) tuples that fired.
    Empty for the ``UNKNOWN`` intent.
    """

    category: IntentCategory
    confidence: int
    matched_keywords: tuple[tuple[IntentCategory, str], ...] = ()


# --------------------------------------------------------------------------- #
# Context
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CopilotContext:
    """Everything a provider needs to answer the
    user's question.

    The dataclass is *narrow* on purpose: the
    provider should not see the full Business
    row, only the slices the intent needs. The
    :class:`CopilotContextBuilder` is responsible
    for picking the right slice per intent —
    nothing else is allowed to read upstream
    services.

    ``services_used`` is the set of service
    names the context builder actually called.
    The endpoint echoes this in the
    ``context_summary`` block so the UI can show
    "Used scores, rules, knowledge".
    """

    business_id: int
    intent: IntentCategory
    intent_confidence: int
    services_used: tuple[str, ...]

    # Optional upstream payloads — only the ones
    # the context builder actually pulled. The
    # provider's template must tolerate ``None``
    # on every field.
    scores: dict | None = None
    rules: dict | None = None
    recommendations: dict | None = None
    roadmap: dict | None = None
    dna: dict | None = None
    knowledge: dict | None = None
    finance: dict | None = None
    twin: dict | None = None
    business: dict | None = None

    # Aggregated counters — derived from the
    # payloads above by the context builder.
    # Pre-computed here so the provider does not
    # have to re-iterate.
    recommendations_count: int = 0
    rules_count: int = 0
    roadmap_count: int = 0
    knowledge_count: int = 0
    score_keys: tuple[str, ...] = ()


# --------------------------------------------------------------------------- #
# Prompt envelope
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CopilotPrompt:
    """The structured prompt a real LLM would consume.

    A real provider (OpenAI / Claude / Gemini /
    Ollama) will receive ``system`` and ``user``
    as the model call's messages, plus a
    ``context`` payload it can choose to ignore.
    The mock provider ignores them and returns
    the deterministic template response. The
    future real-provider swap is a one-line
    change in :class:`CopilotService.__init__`.
    """

    system: str
    user: str
    context: CopilotContext


# --------------------------------------------------------------------------- #
# Provider envelope
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CopilotProviderOutput:
    """The structured output a provider returns.

    ``text`` is the response body. ``highlights``
    is a list of inline tags (e.g. ``"score"``,
    ``"rule:rule.no_iec"``) the citation builder
    can use to find supporting sources. The mock
    provider emits empty highlights; a real
    provider may emit more.
    """

    text: str
    highlights: tuple[str, ...] = ()


# --------------------------------------------------------------------------- #
# Inputs sidecar
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CopilotInputs:
    """Echoes every upstream service's
    ``generated_at`` timestamp so the UI can show
    "Copilot answer is current as of X (scores Y,
    rules Z, recommendations W, ...)".

    The convention matches the AI Decision
    Engine, Recommendation Engine, Roadmap
    Engine, and Finance Engine: every upstream
    service the Copilot actually called is
    represented; unused services are absent.
    """

    model: str = "mock-copilot-1"
    # Upstream timestamps (None when not called).
    business_generated_at: str | None = None
    scores_generated_at: str | None = None
    rules_generated_at: str | None = None
    recommendations_generated_at: str | None = None
    roadmap_generated_at: str | None = None
    dna_generated_at: str | None = None
    knowledge_generated_at: str | None = None
    finance_generated_at: str | None = None
    twin_generated_at: str | None = None


# Replace the local assignment in the field
# default with the module-level constant for
# clarity. Mypy / IDEs may complain about the
# forward reference inside the dataclass; the
# trick below is the standard pattern.


# --------------------------------------------------------------------------- #
# Response envelope (dataclass — the wire-format
# mirror lives in app.schemas.copilot)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CopilotResponse:
    """The Copilot's full response envelope.

    ``conversation_id`` and ``message_id`` are
    deterministic ids derived from the request
    (see :class:`CopilotService`). The spec
    calls for both, so the UI can group requests
    into a session even though the Copilot does
    NOT persist any session state.
    """

    generated_at: str
    conversation_id: str
    message_id: str
    intent: IntentCategory
    confidence: int
    response: str
    citations: tuple[Citation, ...] = ()
    follow_up_questions: tuple[FollowUpQuestion, ...] = ()
    context_summary: dict = field(default_factory=dict)
    inputs: dict = field(default_factory=dict)


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class CopilotServiceError(RuntimeError):
    """Raised by the Copilot when something goes
    wrong inside the pipeline.

    The endpoint surfaces this as a 500 — the
    Copilot subsystem is reachable, but the
    provider / builder failed.
    """


# --------------------------------------------------------------------------- #
# Provider protocol
# --------------------------------------------------------------------------- #


class CopilotProvider(Protocol):
    """Protocol every concrete provider must satisfy.

    The mock provider and any future real
    provider (OpenAI / Claude / Gemini / Ollama
    / in-house model) share this surface.
    :class:`CopilotService` depends on the
    protocol, not the implementation, so swapping
    providers is a one-line change.
    """

    name: str

    def complete(self, prompt: CopilotPrompt) -> CopilotProviderOutput:
        """Generate a structured response for ``prompt``."""
        raise NotImplementedError


# A tiny type-alias for the services_used set the
# context_summary echoes. Kept here to avoid a
# forward import in the context module.
ServicesUsed = tuple[str, ...]


# A type hint for the "any dict" payloads we
# accept from the upstream services. The
# Copilot is shape-tolerant — every helper does
# ``.get(key, default)`` so an upstream field
# can disappear without crashing the engine.
Payload = dict[str, Any]

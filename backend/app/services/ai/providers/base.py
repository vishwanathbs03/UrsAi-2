"""Shared types for the AI Provider Layer — Sprint 7 Part 2.

The package is the seam between the assistant UI (Sprint 7 Part 1)
and a real LLM. The seam is the ``Provider`` Protocol — every
concrete provider (Ollama today, OpenAI / Claude / Gemini / Azure
later) implements ``complete(prompt) -> AssistantResponse``.

The dataclasses below are the contract between the four moving
parts:

  AssistantContextBuilder     -> AssistantContext
  AssistantPromptBuilder      -> AssistantRequest (prompt)
  Provider.complete(...)      -> AssistantResponse
  AssistantProviderService    -> orchestrates the three above

The wire-format envelopes (Pydantic) live in :mod:`app.schemas.*`
when a future milestone wires an HTTP endpoint to this layer. For
this milestone the layer is consumed by other backend services and
by the verifier — there is no public HTTP surface yet.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class AIProviderError(RuntimeError):
    """Raised by a :class:`Provider` when the call cannot complete.

    Subclasses distinguish recoverable from non-recoverable failure.
    The factory and service catch :class:`ProviderUnavailableError`
    and :class:`ProviderTimeoutError` to drop down to the
    deterministic fallback; other errors propagate so the caller
    can decide.
    """


class ProviderUnavailableError(AIProviderError):
    """The configured provider cannot be reached at all.

    Raised on connection refused, DNS failure, or any
    ``httpx.ConnectError``-shaped failure. The factory treats this
    as a soft failure and returns the deterministic fallback so
    the API stays up when the model server is offline.
    """


class ProviderTimeoutError(AIProviderError):
    """The configured provider accepted the request but did not
    respond within :attr:`Settings.ai_request_timeout_seconds`.

    The factory treats this as a soft failure and returns the
    deterministic fallback. A small Ollama model can take 30+ s
    for the first call on a cold start; the timeout is a guard,
    not a feature.
    """


# --------------------------------------------------------------------------- #
# Context — the slice of business state the provider sees
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AssistantContextScore:
    """One readiness lens score, projected from the Digital Twin."""

    key: str
    title: str
    score: int  # 0..100
    level: str


@dataclass(frozen=True)
class AssistantContextDna:
    """Business DNA archetype, projected from the Digital Twin."""

    archetype_key: str
    archetype_title: str
    match_score: int  # 0..100


@dataclass(frozen=True)
class AssistantContextRecommendation:
    """One recommendation the Recommendations engine produced."""

    id: str
    title: str
    category: str
    priority: str
    estimated_score_gain: int
    estimated_roi: float
    estimated_timeline: str


@dataclass(frozen=True)
class AssistantContextRoadmap:
    """One sequenced roadmap item."""

    id: str
    title: str
    phase: str
    priority: str
    estimated_start_order: int
    completion_percentage: int
    expected_score_improvement: int


@dataclass(frozen=True)
class AssistantContextRule:
    """One active rule firing."""

    id: str
    title: str
    category: str
    priority: str
    estimated_impact: int
    reason: str


@dataclass(frozen=True)
class AssistantContextInsight:
    """One AI Decision insight, projected from the Insights engine."""

    id: str
    title: str
    priority: str
    confidence: int  # 0..100


@dataclass(frozen=True)
class AssistantContext:
    """The slice of business state the provider is allowed to see.

    Built by :class:`AssistantContextBuilder` from the five
    upstream payloads (Twin, Recommendations, Roadmap, Rules,
    Insights). The builder is a pure projection — it never
    re-derives a score, a recommendation, a rule, or a DNA
    archetype. The ``generated_at`` sidecar is echoed from the
    upstream payloads so the verifier can strip it from the
    two-call determinism diff.
    """

    business_id: int
    overall_business_score: int
    band: str
    dna: AssistantContextDna
    scores: tuple[AssistantContextScore, ...]
    recommendations: tuple[AssistantContextRecommendation, ...]
    roadmap: tuple[AssistantContextRoadmap, ...]
    rules: tuple[AssistantContextRule, ...]
    insights: tuple[AssistantContextInsight, ...]
    # Sidecar — upstream generated_at fields, echoed.
    twin_generated_at: str | None = None
    recommendations_generated_at: str | None = None
    roadmap_generated_at: str | None = None
    rules_generated_at: str | None = None
    insights_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Conversation — the prompt surface the provider receives
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AssistantTurn:
    """One conversational turn (a user prompt or an assistant reply).

    The conversation is *only* an input the provider may use to
    keep tone consistent. The layer does NOT persist it; the
    caller (or a future endpoint) owns the storage.
    """

    role: str  # "user" | "assistant"
    content: str


@dataclass(frozen=True)
class AssistantRequest:
    """The full prompt surface a real LLM call would receive.

    ``context`` is the structured grounding the layer has
    assembled from the upstream services. ``user_prompt`` is the
    literal text the user typed in the assistant. ``history`` is
    the prior conversation turns (cap-bounded by the caller).

    ``knowledge`` (Sprint 7 Part 4) is the optional
    :class:`KnowledgeRetrievalContext` payload the retriever
    produced for this prompt. The deterministic fallback
    ignores it; a real LLM provider sees it rendered as a
    ``=== KNOWLEDGE SOURCES ===`` block at the bottom of the
    user message. The field is None when the retrieval layer
    found no candidates.
    """

    user_prompt: str
    context: AssistantContext
    history: tuple[AssistantTurn, ...] = field(default_factory=tuple)
    knowledge: object | None = None


# --------------------------------------------------------------------------- #
# Response — what every provider must return
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AssistantResponse:
    """A provider's reply to an :class:`AssistantRequest`.

    ``body`` is the LLM-generated text. ``model`` is the
    concrete provider name (``"ollama:llama3.1"``,
    ``"deterministic-fallback"``, ``"mock-llm-1"``, ...). The
    factory stamps ``fallback_used`` so the verifier can prove
    the graceful-degradation contract.

    ``provider_used`` is the name of the provider that
    produced the response. When ``fallback_used`` is True, this
    is the deterministic fallback's name; otherwise it equals
    ``model``.
    """

    body: str
    model: str
    fallback_used: bool
    provider_used: str
    generated_at: str
    # Sidecar — context timestamps echoed so the response is
    # self-describing in logs / debugging.
    twin_generated_at: str | None = None
    recommendations_generated_at: str | None = None
    roadmap_generated_at: str | None = None
    rules_generated_at: str | None = None
    insights_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Provider protocol
# --------------------------------------------------------------------------- #


class Provider(Protocol):
    """Protocol every concrete LLM backend must satisfy.

    Implementations:

      * :class:`OllamaProvider` — real Ollama HTTP provider.
      * :class:`DeterministicFallbackProvider` — always-available
        local fallback used when the configured provider is
        unreachable or the user has not enabled a real one.

    The protocol exposes two attributes:

      * ``name`` — a stable identifier for the provider
        (``"ollama"``, ``"deterministic-fallback"``). The
        factory picks on this.
      * ``is_available`` — ``True`` if the provider can answer
        a call right now. ``OllamaProvider`` pings the host on
        construction; the deterministic fallback is always
        available.
    """

    name: str

    @property
    def is_available(self) -> bool:
        """Return True if the provider can serve a call right now.

        The factory uses this to decide whether to return the
        real provider or drop down to the fallback. An
        :class:`OllamaProvider` whose ``is_available`` is False
        must still be safe to construct (the ping failure must
        not raise), so the fallback story is symmetric.
        """
        ...

    def complete(self, request: AssistantRequest) -> AssistantResponse:
        """Generate a reply for ``request``.

        Implementations must:

          * Raise :class:`ProviderUnavailableError` when the
            underlying transport cannot be reached.
          * Raise :class:`ProviderTimeoutError` when the call
            exceeds the configured timeout.
          * Raise :class:`AIProviderError` for any other
            transport-level failure.
        """
        ...


# --------------------------------------------------------------------------- #
# Deterministic fallback — the always-available provider
# --------------------------------------------------------------------------- #


class DeterministicFallbackProvider:
    """Always-available provider that mirrors the Sprint 7 Part 1
    frontend builder.

    Used when:

      * ``Settings.ai_provider`` is anything other than
        ``"ollama"`` (the default ``"placeholder"`` falls through
        here).
      * The configured Ollama host is unreachable
        (:class:`ProviderUnavailableError`).
      * The configured Ollama host is reachable but exceeds the
        timeout (:class:`ProviderTimeoutError`).

    The fallback is a thin wrapper around a pure template
    function. The output is identical in spirit to the frontend
    builder — same rules (sort by priority, take the top 3,
    mention the DNA archetype and roadmap first item) — so the
    backend fallback matches the frontend behaviour when the
    user has not enabled a real provider.

    Note: the fallback is NOT a copy of the frontend code. The
    frontend and backend builders are intentionally two
    independent implementations of the same spec; if the
    frontend builder ever drifts, the fallback stays consistent
    with the brief's "no duplicate logic" rule by sourcing its
    data from the same five upstream payloads the frontend
    reads via the existing API endpoints.
    """

    name = "deterministic-fallback"

    @property
    def is_available(self) -> bool:
        return True

    def complete(self, request: AssistantRequest) -> AssistantResponse:
        body = _fallback_body(request)
        return AssistantResponse(
            body=body,
            model=self.name,
            fallback_used=True,
            provider_used=self.name,
            generated_at=_now_iso(),
            twin_generated_at=request.context.twin_generated_at,
            recommendations_generated_at=request.context.recommendations_generated_at,
            roadmap_generated_at=request.context.roadmap_generated_at,
            rules_generated_at=request.context.rules_generated_at,
            insights_generated_at=request.context.insights_generated_at,
        )


# --------------------------------------------------------------------------- #
# Fallback renderer — pure function over the context
# --------------------------------------------------------------------------- #


def _fallback_body(request: AssistantRequest) -> str:
    """Render the deterministic fallback body.

    The shape is stable: a 3-section reply covering the user's
    question (with the top recommendations), the DNA archetype,
    and the roadmap's first item. The output is a function of
    ``request.context`` and ``request.user_prompt`` only — no
    clock, no random, no I/O.
    """
    ctx = request.context
    prompt = (request.user_prompt or "").strip() or "Tell me about my business."

    lines: list[str] = []
    lines.append(
        f"You asked: \"{prompt}\""
    )
    lines.append(
        f"Overall business score: {ctx.overall_business_score}/100 ({ctx.band})."
    )
    if ctx.dna.archetype_title:
        lines.append(
            f"Business DNA: {ctx.dna.archetype_title} "
            f"(match {ctx.dna.match_score}%)."
        )
    if ctx.recommendations:
        top = sorted(
            ctx.recommendations,
            key=lambda r: (
                _priority_rank(r.priority),
                -r.estimated_score_gain,
            ),
        )[:3]
        lines.append("Top recommendations:")
        for i, r in enumerate(top, start=1):
            lines.append(
                f"  {i}. {r.title} "
                f"[{r.priority}, +{r.estimated_score_gain} score, "
                f"~{r.estimated_timeline}, ROI {_fmt_money(r.estimated_roi)}]"
            )
    if ctx.roadmap:
        first = sorted(
            ctx.roadmap,
            key=lambda it: it.estimated_start_order,
        )[0]
        lines.append(
            f"Roadmap starts with: \"{first.title}\" "
            f"(phase {first.phase}, +{first.expected_score_improvement} score, "
            f"{first.completion_percentage}% complete)."
        )
    if ctx.rules:
        critical = [r for r in ctx.rules if r.priority == "Critical"]
        if critical:
            lines.append(
                f"Active critical rules: {len(critical)} "
                f"(highest impact: \"{critical[0].title}\", "
                f"impact {critical[0].estimated_impact})."
            )
        else:
            lines.append(f"Active rules: {len(ctx.rules)}.")
    if ctx.insights:
        lines.append(
            f"Insights surfaced: {len(ctx.insights)}."
        )
    # Sprint 7 Part 4: knowledge sources. Render a small
    # block when the retriever found anything. We render the
    # titles only — the body is hidden to keep the fallback
    # short.
    knowledge = getattr(request, "knowledge", None)
    citations = getattr(knowledge, "citations", None) if knowledge else None
    if citations:
        lines.append("")
        lines.append("Knowledge sources:")
        for i, c in enumerate(citations, start=1):
            lines.append(
                f"  [{i}] {c.title} (article {c.article_id})"
            )
        lines.append(
            "Article snippets are always available via the "
            "citations in the chat message."
        )

    lines.append(
        "This answer was produced by the deterministic fallback — "
        "no LLM was called. Set AI_PROVIDER=ollama with a reachable "
        "Ollama server to enable the LLM path."
    )
    return "\n".join(lines)


def _priority_rank(priority: str) -> int:
    if priority == "Critical":
        return 0
    if priority == "High":
        return 1
    if priority == "Medium":
        return 2
    if priority == "Low":
        return 3
    return 99


def _fmt_money(value: float) -> str:
    if value is None:
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "—"
    if abs(v) >= 1_000_000:
        return f"${v / 1_000_000:.1f}M"
    if abs(v) >= 1_000:
        return f"${v / 1_000:.1f}k"
    return f"${v:.0f}"


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(tz=timezone.utc).isoformat()
"""CopilotOrchestrator — wires the 5 stages of
the Copilot pipeline into a single function.

Pipeline
--------

  IntentEngine.detect(message)             → IntentResult
  CopilotContextBuilder.build(...)         → CopilotContext
  CopilotPromptBuilder.build(context)      → CopilotPrompt
  provider.complete(prompt)                → CopilotProviderOutput
  CitationBuilder.build(context, high.)    → tuple[Citation, ...]
  (follow-up generator)                    → tuple[FollowUpQuestion, ...]
  (context-summary builder)                → dict
  (inputs sidecar builder)                 → dict

The orchestrator owns *no* business logic. It
is the conductor; each helper is a private
implementation detail. The orchestrator is the
only piece the service façade calls.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.services.copilot.base import (
    Citation,
    CopilotContext,
    CopilotInputs,
    CopilotPrompt,
    CopilotProvider,
    CopilotProviderOutput,
    CopilotResponse,
    FollowUpQuestion,
    IntentCategory,
    IntentResult,
)
from app.services.copilot.citation import CitationBuilder
from app.services.copilot.context import CopilotContextBuilder
from app.services.copilot.intent import IntentEngine
from app.services.copilot.prompt_builder import CopilotPromptBuilder


# Spec says "Generate 3 follow-up questions" —
# we always emit exactly 3. When the context
# is too thin to make 3 good questions, we pad
# with the canonical "show me my top
# recommendations" fallbacks so the UI always
# has a tappable question.
_FOLLOWUP_COUNT = 3


class CopilotOrchestrator:
    """Top-level Copilot pipeline.

    The orchestrator depends on the four
    sub-components and a provider. Swapping the
    provider is a one-line change at
    construction time.
    """

    def __init__(
        self,
        *,
        context_builder: CopilotContextBuilder,
        intent_engine: IntentEngine | None = None,
        prompt_builder: CopilotPromptBuilder | None = None,
        citation_builder: CitationBuilder | None = None,
        provider: CopilotProvider,
    ) -> None:
        self._context_builder = context_builder
        self._intent_engine = intent_engine or IntentEngine()
        self._prompt_builder = prompt_builder or CopilotPromptBuilder()
        self._citation_builder = citation_builder or CitationBuilder()
        self._provider = provider

    @property
    def provider_name(self) -> str:
        return self._provider.name

    # ---- public API -------------------------------------------------- #

    def run(
        self,
        *,
        owner_id: int,
        message: str,
        conversation_id: str,
        message_id: str,
    ) -> CopilotResponse:
        """Run the full pipeline and return a
        :class:`CopilotResponse`.

        Raises :class:`BusinessNotFound` from the
        context builder when the user has no
        business profile.
        """
        # 1. Intent detection.
        intent: IntentResult = self._intent_engine.detect(message)

        # 2. Context — only the services the
        #    intent needs.
        context: CopilotContext = self._context_builder.build(
            owner_id=owner_id, intent=intent,
        )

        # 3. Prompt — pure function over the
        #    context.
        prompt: CopilotPrompt = self._prompt_builder.build(context)

        # 4. Provider — mock today, real LLM
        #    tomorrow.
        provider_output: CopilotProviderOutput = self._provider.complete(
            prompt
        )

        # 5. Citations.
        citations: tuple[Citation, ...] = self._citation_builder.build(
            context, provider_output.highlights
        )

        # 6. Follow-up questions.
        follow_ups: tuple[FollowUpQuestion, ...] = _build_follow_ups(
            context=context,
            citations=citations,
        )

        # 7. Context summary.
        context_summary = _build_context_summary(context)

        # 8. Inputs sidecar.
        inputs = _build_inputs(context, self._provider.name)

        return CopilotResponse(
            generated_at=_now_iso(),
            conversation_id=conversation_id,
            message_id=message_id,
            intent=intent.category,
            confidence=intent.confidence,
            response=provider_output.text,
            citations=citations,
            follow_up_questions=follow_ups,
            context_summary=context_summary,
            inputs=inputs,
        )


# --------------------------------------------------------------------------- #
# Follow-up question generator
# --------------------------------------------------------------------------- #


def _build_follow_ups(
    *,
    context: CopilotContext,
    citations: tuple[Citation, ...],
) -> tuple[FollowUpQuestion, ...]:
    """Return exactly 3 follow-up questions.

    The questions are deterministic functions
    of the detected intent and the top
    citations. When the context is thin, we
    fall back to the canonical "show me my X"
    forms.
    """
    intent: IntentCategory = context.intent
    candidates: list[FollowUpQuestion] = []

    # Strategy 1 — questions anchored to the
    # top citation per kind. Produces natural
    # "What about rule X?" questions.
    for c in citations:
        if c.kind == "rule":
            candidates.append(FollowUpQuestion(
                question=(
                    f"What is the impact of {c.label}?"
                ),
                intent="RULES",
                anchor=c.id,
            ))
        elif c.kind == "recommendation":
            candidates.append(FollowUpQuestion(
                question=(
                    f"How do I start "
                    f"{c.label}?"
                ),
                intent="RECOMMENDATIONS",
                anchor=c.id,
            ))
        elif c.kind == "article":
            candidates.append(FollowUpQuestion(
                question=(
                    f"Tell me more about {c.label}."
                ),
                intent="GENERAL_BUSINESS",
                anchor=c.id,
            ))
        elif c.kind == "roadmap":
            candidates.append(FollowUpQuestion(
                question=(
                    f"Which roadmap task should I start first?"
                ),
                intent="ROADMAP",
                anchor=c.id,
            ))
        elif c.kind == "score":
            candidates.append(FollowUpQuestion(
                question=(
                    f"How can I improve my {c.label} score?"
                ),
                intent="BUSINESS_SCORE",
                anchor=c.id,
            ))
        elif c.kind == "dna":
            candidates.append(FollowUpQuestion(
                question=(
                    f"What does my {c.label} archetype imply?"
                ),
                intent="DNA",
                anchor=c.id,
            ))
        if len(candidates) >= _FOLLOWUP_COUNT:
            break

    # Strategy 2 — intent-anchored
    # fallbacks. These guarantee the user
    # always has a tappable question.
    intent_fallbacks: tuple[FollowUpQuestion, ...] = {
        "EXPORT": (
            FollowUpQuestion(
                question="What certification should I obtain first?",
                intent="COMPLIANCE",
            ),
            FollowUpQuestion(
                question="How much will this improve my export score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Which roadmap task should I start?",
                intent="ROADMAP",
            ),
        ),
        "DIGITAL": (
            FollowUpQuestion(
                question="Which digital tool should I adopt first?",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="How does this improve my digital score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="What does my business DNA say about digital?",
                intent="DNA",
            ),
        ),
        "COMPLIANCE": (
            FollowUpQuestion(
                question="What certification should I obtain first?",
                intent="COMPLIANCE",
            ),
            FollowUpQuestion(
                question="How does this affect my roadmap?",
                intent="ROADMAP",
            ),
            FollowUpQuestion(
                question="Which compliance rule is highest priority?",
                intent="RULES",
            ),
        ),
        "DNA": (
            FollowUpQuestion(
                question="What does my archetype imply for exports?",
                intent="EXPORT",
            ),
            FollowUpQuestion(
                question="Which secondary trait is strongest?",
                intent="DNA",
            ),
            FollowUpQuestion(
                question="How does my DNA shape my roadmap?",
                intent="ROADMAP",
            ),
        ),
        "ROADMAP": (
            FollowUpQuestion(
                question="Which roadmap task should I start?",
                intent="ROADMAP",
            ),
            FollowUpQuestion(
                question="How much will this improve my score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="What is the ROI of the first item?",
                intent="FINANCE",
            ),
        ),
        "RECOMMENDATIONS": (
            FollowUpQuestion(
                question="Which recommendation is highest priority?",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="How much will this improve my score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Add the top recommendation to my roadmap.",
                intent="ROADMAP",
            ),
        ),
        "RULES": (
            FollowUpQuestion(
                question="Which rule has the biggest impact?",
                intent="RULES",
            ),
            FollowUpQuestion(
                question="What is the matching recommendation?",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="How does this shape my compliance?",
                intent="COMPLIANCE",
            ),
        ),
        "BUSINESS_SCORE": (
            FollowUpQuestion(
                question="Which score should I improve first?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Show me the top recommendations.",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="What is my projected score after the roadmap?",
                intent="ROADMAP",
            ),
        ),
        "SCENARIO": (
            FollowUpQuestion(
                question="What if I complete the first roadmap item?",
                intent="SCENARIO",
            ),
            FollowUpQuestion(
                question="What is the projected business score?",
                intent="ROADMAP",
            ),
            FollowUpQuestion(
                question="What is the expected ROI?",
                intent="FINANCE",
            ),
        ),
        "OCR": (
            FollowUpQuestion(
                question="Which documents should I upload first?",
                intent="OCR",
            ),
            FollowUpQuestion(
                question="What does the OCR review look like?",
                intent="OCR",
            ),
            FollowUpQuestion(
                question="What is my business profile completeness?",
                intent="BUSINESS_SCORE",
            ),
        ),
        "FINANCE": (
            FollowUpQuestion(
                question="What is the ROI of the top recommendation?",
                intent="FINANCE",
            ),
            FollowUpQuestion(
                question="How much will this improve my score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="What is my projected valuation?",
                intent="FINANCE",
            ),
        ),
        "GENERAL_BUSINESS": (
            FollowUpQuestion(
                question="What is my business score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Show me the top recommendations.",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="What is my business DNA?",
                intent="DNA",
            ),
        ),
        "GREETING": (
            FollowUpQuestion(
                question="What is my business score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Show me the top recommendations.",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="What is my business DNA?",
                intent="DNA",
            ),
        ),
        "UNKNOWN": (
            FollowUpQuestion(
                question="What is my business score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Show me the top recommendations.",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="How can I improve my export readiness?",
                intent="EXPORT",
            ),
        ),
    }.get(
        intent,
        (
            FollowUpQuestion(
                question="What is my business score?",
                intent="BUSINESS_SCORE",
            ),
            FollowUpQuestion(
                question="Show me the top recommendations.",
                intent="RECOMMENDATIONS",
            ),
            FollowUpQuestion(
                question="What is my business DNA?",
                intent="DNA",
            ),
        ),
    )

    # Combine: prefer citation-anchored
    # questions, then pad with intent
    # fallbacks, deduped by question text.
    seen: set[str] = set()
    final: list[FollowUpQuestion] = []
    for q in list(candidates) + list(intent_fallbacks):
        if q.question in seen:
            continue
        seen.add(q.question)
        final.append(q)
        if len(final) >= _FOLLOWUP_COUNT:
            break
    return tuple(final)


# --------------------------------------------------------------------------- #
# Context summary
# --------------------------------------------------------------------------- #


def _build_context_summary(context: CopilotContext) -> dict:
    return {
        "services_used": list(context.services_used),
        "recommendations_used": context.recommendations_count,
        "rules_used": context.rules_count,
        "roadmap_items_used": context.roadmap_count,
        "knowledge_used": context.knowledge_count,
        "score_keys_used": list(context.score_keys),
    }


# --------------------------------------------------------------------------- #
# Inputs sidecar
# --------------------------------------------------------------------------- #


def _build_inputs(context: CopilotContext, model: str) -> dict:
    """Echo the upstream ``generated_at``
    timestamps the Copilot actually used.

    Unused services produce ``None``; the
    schema in :mod:`app.schemas.copilot` allows
    ``None`` on every field. The model name is
    the provider's ``name`` attribute so the
    UI can show "Generated by mock-copilot-1"
    (or a real model name in a future
    milestone).
    """
    inputs = CopilotInputs(model=model)
    if context.business is not None:
        meta = (context.business or {}).get("meta") or {}
        lu = meta.get("last_updated")
        if lu is not None and not isinstance(lu, str):
            lu = lu.isoformat()
        inputs = CopilotInputs(
            model=model,
            business_generated_at=lu,
        )
    if context.scores is not None:
        inputs = CopilotInputs(
            model=model,
            scores_generated_at=context.scores.get("generated_at"),
        )
    if context.rules is not None:
        inputs = CopilotInputs(
            model=model,
            rules_generated_at=context.rules.get("generated_at"),
        )
    if context.recommendations is not None:
        inputs = CopilotInputs(
            model=model,
            recommendations_generated_at=(
                context.recommendations.get("generated_at")
            ),
        )
    if context.roadmap is not None:
        inputs = CopilotInputs(
            model=model,
            roadmap_generated_at=context.roadmap.get("generated_at"),
        )
    if context.dna is not None:
        inputs = CopilotInputs(
            model=model,
            dna_generated_at=context.dna.get("generated_at"),
        )
    if context.knowledge is not None:
        inputs = CopilotInputs(
            model=model,
            knowledge_generated_at=context.knowledge.get("generated_at"),
        )
    return {
        "model": inputs.model,
        "business_generated_at": inputs.business_generated_at,
        "scores_generated_at": inputs.scores_generated_at,
        "rules_generated_at": inputs.rules_generated_at,
        "recommendations_generated_at": (
            inputs.recommendations_generated_at
        ),
        "roadmap_generated_at": inputs.roadmap_generated_at,
        "dna_generated_at": inputs.dna_generated_at,
        "knowledge_generated_at": inputs.knowledge_generated_at,
        "finance_generated_at": inputs.finance_generated_at,
        "twin_generated_at": inputs.twin_generated_at,
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _now_iso() -> str:
    return (
        datetime.now(tz=timezone.utc)
        .isoformat(timespec="microseconds")
    )

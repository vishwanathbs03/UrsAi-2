"""AssistantPromptBuilder — Sprint 7 Part 2.

Pure projection from an :class:`AssistantContext` plus the
user's prompt (and optional conversation history) into the
:class:`AssistantRequest` envelope a real LLM call would
send.

The builder is a pure function over its inputs. It does not
call any LLM. The output is shaped exactly like a real-provider
call (system message + user message + structured context) so a
future OpenAI / Claude / Gemini / Azure provider can swap in
without changing the prompt format.

Determinism
-----------

The user message is rendered in a stable, sorted order:

  * overall business score and band — line 1
  * DNA archetype + match — line 2
  * scores in declared (key) order
  * recommendations sorted by (priority_rank, -score_gain, id)
  * roadmap sorted by estimated_start_order ascending
  * rules in category-then-impact order, capped at _MAX_RULES
  * insights in declared order, capped at _MAX_INSIGHTS
  * conversation history in declared order (caller-bounded)

Two calls with the same context produce byte-identical
:class:`AssistantRequest` instances.
"""
from __future__ import annotations

from app.services.ai.providers.base import (
    AssistantContext,
    AssistantRequest,
    AssistantTurn,
)


# System message — every provider call uses the same one.
# The contract is fixed: "describe, don't prescribe" and
# "ground every claim in a context item".
_SYSTEM = (
    "You are Atlas AI Assistant, a business analyst for an "
    "Indian SMB. You receive a structured snapshot of the "
    "user's business: overall score, Business DNA, the active "
    "recommendations, the sequenced roadmap, the rule firings, "
    "and the AI Decision insights. Use the snapshot to explain "
    "the situation in plain language. Never invent a metric, "
    "rule id, recommendation id, or roadmap item id — only "
    "reference items present in the snapshot. Never give "
    "prescriptive actions ('email supplier X by Friday') — "
    "descriptive explanations only. Keep the response under "
    "250 words. If the snapshot is empty, say so honestly "
    "and recommend the user set up their business profile."
)


class AssistantPromptBuilder:
    """Build an :class:`AssistantRequest` from a context + user prompt."""

    def build(
        self,
        *,
        context: AssistantContext,
        user_prompt: str,
        history: tuple[AssistantTurn, ...] = (),
        knowledge: object | None = None,
    ) -> AssistantRequest:
        return AssistantRequest(
            user_prompt=user_prompt,
            context=context,
            history=history,
            knowledge=knowledge,
            # System + user strings are rendered lazily by the
            # provider's ``_to_messages()`` helper because some
            # providers (Ollama) put the system into a separate
            # payload field, while OpenAI / Claude / Gemini use
            # the messages[] convention. The contract lives
            # here regardless.
        )

    @staticmethod
    def system_message() -> str:
        """The system message every provider call shares."""
        return _SYSTEM

    @staticmethod
    def render_user_message(request: AssistantRequest) -> str:
        """Render the user-side text for the model call."""
        ctx = request.context
        parts: list[str] = []
        parts.append("=== BUSINESS SNAPSHOT ===")
        parts.append(
            f"business_id: {ctx.business_id}"
        )
        parts.append(
            f"overall_business_score: {ctx.overall_business_score} "
            f"({ctx.band})"
        )
        if ctx.dna.archetype_title:
            parts.append(
                f"dna_archetype: {ctx.dna.archetype_key} "
                f"({ctx.dna.archetype_title}, match={ctx.dna.match_score})"
            )

        if ctx.scores:
            parts.append("")
            parts.append("SCORES")
            for s in sorted(ctx.scores, key=lambda x: x.key):
                parts.append(f"- {s.key}: {s.score} ({s.level}) {s.title}")

        if ctx.recommendations:
            parts.append("")
            parts.append("RECOMMENDATIONS")
            for r in sorted(
                ctx.recommendations,
                key=lambda r: (_priority_rank(r.priority),
                               -r.estimated_score_gain,
                               r.id),
            ):
                parts.append(
                    f"- {r.id} [{r.priority} +{r.estimated_score_gain}] "
                    f"({r.category}) {r.title} :: "
                    f"timeline {r.estimated_timeline}, "
                    f"ROI {r.estimated_roi:.0f}"
                )

        if ctx.roadmap:
            parts.append("")
            parts.append("ROADMAP")
            for it in sorted(
                ctx.roadmap,
                key=lambda x: x.estimated_start_order,
            ):
                parts.append(
                    f"- {it.id} [order={it.estimated_start_order} "
                    f"{it.priority} +{it.expected_score_improvement}] "
                    f"({it.phase}) {it.title} :: "
                    f"completion {it.completion_percentage}%"
                )

        if ctx.rules:
            parts.append("")
            parts.append("ACTIVE RULES")
            for r in ctx.rules:
                parts.append(
                    f"- {r.id} [{r.priority} impact={r.estimated_impact}] "
                    f"({r.category}) {r.title} :: {r.reason}"
                )

        if ctx.insights:
            parts.append("")
            parts.append("INSIGHTS")
            for ins in ctx.insights:
                parts.append(
                    f"- {ins.id} [{ins.priority} conf={ins.confidence}] "
                    f"{ins.title}"
                )

        if request.history:
            parts.append("")
            parts.append("CONVERSATION HISTORY")
            for turn in request.history:
                tag = "USER" if turn.role == "user" else "ASSISTANT"
                parts.append(f"{tag}: {turn.content}")

        # Sprint 7 Part 4: retrieved knowledge articles. Only
        # rendered when the retriever found at least one
        # citation. Field is opaque to the prompt builder — the
        # caller decides the shape.
        knowledge = getattr(request, "knowledge", None)
        if knowledge is not None:
            citations = getattr(knowledge, "citations", None) or ()
            ranked = getattr(knowledge, "ranked", None) or ()
            articles = getattr(knowledge, "articles", None) or ()
            if citations:
                parts.append("")
                parts.append("KNOWLEDGE SOURCES")
                for i, c in enumerate(citations, start=1):
                    parts.append(
                        f"- [{i}] {c.article_id} "
                        f"({c.source_category}) {c.title}"
                    )
                if articles:
                    parts.append("ARTICLE EXCERPTS")
                    for art in articles:
                        if not isinstance(art, dict):
                            continue
                        art_id = art.get("id", "")
                        art_title = art.get("title", "")
                        art_sum = (art.get("summary") or "").strip()
                        if not art_sum:
                            continue
                        parts.append(
                            f"--- {art_id} {art_title} ---"
                        )
                        parts.append(art_sum)
                if ranked:
                    parts.append(
                        f"({len(ranked)} of "
                        f"{getattr(knowledge, 'total_candidates', '?')} "
                        f"candidates matched)"
                    )

        parts.append("")
        parts.append(f"USER PROMPT: {request.user_prompt}")

        return "\n".join(parts)


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
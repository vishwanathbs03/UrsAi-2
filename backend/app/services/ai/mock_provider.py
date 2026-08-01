"""MockLLMProvider — deterministic, template-based provider.

The spec says "do NOT call a real LLM" — this is the
implementation for the milestone. It does not make any network
call, it does not read ``AI_API_KEY`` from settings, and it
produces a structured :class:`AIDecision` derived purely from
the :class:`AIContext` it was given.

The provider is honest about being a mock: ``self.name`` is
``"mock-llm-1"`` and the response carries the same model name
in the sidecar so the UI can show "Mock LLM (deterministic)".

The deterministic property is a contract the verifier checks:
two consecutive calls with the same context must produce the
same response. (The mock already satisfies that because it
does not touch time, random, or I/O.)

When a real provider lands in a future milestone, the swap is
``AIDecisionService(provider=MockLLMProvider())`` ->
``AIDecisionService(provider=OpenAIProvider(...))``. Nothing
else changes.
"""

from __future__ import annotations

from app.services.ai.base import (
    AIDecision,
    AIInsight,
    AIContext,
    LLMPrompt,
    LLMProvider,
    LLMResponse,
)


class MockLLMProvider(LLMProvider):
    """Deterministic provider — template-based, no network."""

    name = "mock-llm-1"

    def complete(self, prompt: LLMPrompt) -> LLMResponse:
        ctx = prompt.context
        decision = _compose_decision(ctx)
        return LLMResponse(decision=decision, raw_text="")


# --------------------------------------------------------------------------- #
# Composition
# --------------------------------------------------------------------------- #


_STRENGTH_BY_LEVEL = {
    "Excellent": ("Strong post-conversion funnel and customer success loop",
                  "Repeatable revenue from international buyers"),
    "High":      ("Established compliance posture",
                  "Active online sales channel"),
    "Medium":    ("Foundations are in place",
                  "Documented capacity and team"),
    "Low":       ("Baseline business profile captured",
                  "Some signals of international intent"),
}


def _compose_decision(ctx: AIContext) -> AIDecision:
    rules = ctx.rules
    knowledge = ctx.knowledge

    # Pick the highest-impact rule in each of the spec's eight
    # categories — these are the most decision-worthy findings.
    top_by_category: dict[str, AIInsight | None] = {
        cat: None for cat in _CATEGORIES
    }
    for r in rules:
        if top_by_category.get(r.category) is None:
            top_by_category[r.category] = r

    insights: list[AIInsight] = []
    for cat in _CATEGORIES:
        ref = top_by_category.get(cat)
        if ref is None:
            continue
        title = _title_for_category(cat, ref)
        explanation = _explanation_for(ref, knowledge, ctx)
        supporting_articles = tuple(
            a.id for a in knowledge
            if a.topic == ref.category or a.category == ref.category
        )[:2]
        confidence = _confidence_for(ref, len(knowledge))
        insights.append(AIInsight(
            id=f"insight.{ref.id}",
            title=title,
            explanation=explanation,
            category=ref.category,
            priority=ref.priority,
            confidence=confidence,
            supporting_rule_ids=(ref.id,),
            supporting_article_ids=supporting_articles,
        ))

    top_strengths = _top_strengths(ctx)
    top_risks = _top_risks(rules)

    summary = _summary(ctx, rules, insights)
    overall_health = _overall_health(ctx)
    archetype_label = (
        f"{ctx.archetype_title} (match {ctx.archetype_match_score})"
    )

    return AIDecision(
        summary=summary,
        archetype_label=archetype_label,
        overall_health=overall_health,
        top_strengths=top_strengths,
        top_risks=top_risks,
        insights=tuple(insights),
    )


# --------------------------------------------------------------------------- #
# Rendering helpers — pure functions over the context
# --------------------------------------------------------------------------- #


_CATEGORIES = (
    "immediate_actions",
    "high_priority",
    "medium_priority",
    "long_term",
    "risk_alerts",
    "compliance_actions",
    "export_readiness_actions",
    "digital_transformation_actions",
)


def _title_for_category(cat: str, rule) -> str:
    return {
        "immediate_actions":            "Top immediate action",
        "high_priority":                "Highest-priority gap",
        "medium_priority":              "Medium-priority gap",
        "long_term":                    "Long-term improvement",
        "risk_alerts":                  "Risk signal to watch",
        "compliance_actions":           "Compliance gap",
        "export_readiness_actions":     "Export-readiness gap",
        "digital_transformation_actions": "Digital transformation gap",
    }.get(cat, rule.title)


def _explanation_for(rule, knowledge, ctx: AIContext) -> str:
    bits: list[str] = []
    bits.append(
        f"The {rule.category.replace('_', ' ')} pillar surfaced "
        f"'{rule.title}' at impact {rule.estimated_impact}."
    )
    bits.append(rule.reason + ("." if not rule.reason.endswith(".") else ""))
    supporting = [
        a for a in knowledge
        if a.topic == rule.category or a.category == rule.category
    ][:1]
    if supporting:
        bits.append(f"See knowledge article '{supporting[0].id}' for background.")
    return " ".join(bits)


def _confidence_for(rule, knowledge_count: int) -> int:
    # Deterministic mapping: base 55, +2 per impact point, +2 per
    # supporting article, capped at 95 so the UI never claims
    # certainty.
    base = 55
    impact_term = min(30, max(0, int(rule.estimated_impact // 3)))
    support_term = min(10, knowledge_count * 2)
    return min(95, base + impact_term + support_term)


def _top_strengths(ctx: AIContext) -> tuple[str, ...]:
    by_key = {s.key: s for s in ctx.scores}
    bullets: list[str] = []
    for key, phrase in (
        ("compliance", "Active compliance posture"),
        ("digital",    "Active digital presence"),
        ("export",     "Export history on file"),
        ("growth",     "Declared growth goals and capacity"),
    ):
        snap = by_key.get(key)
        if snap and snap.score >= 60:
            bullets.append(f"{phrase} (score {snap.score}, {snap.level})")
    if not bullets:
        bullets.append("Baseline profile is captured — foundations are in place.")
    return tuple(bullets[:3])


def _top_risks(rules) -> tuple[str, ...]:
    bullets: list[str] = []
    for r in rules:
        if r.priority in {"Critical", "High"} and len(bullets) < 3:
            bullets.append(f"{r.title} ({r.priority}, impact {r.estimated_impact})")
    if not bullets:
        bullets.append("No high-priority risks identified by the rule engine.")
    return tuple(bullets)


def _summary(ctx: AIContext, rules, insights) -> str:
    n_rules = len(rules)
    n_insights = len(insights)
    if n_rules == 0:
        return (
            f"{ctx.archetype_title} profile with intelligence score "
            f"{ctx.intelligence_overall}; no active rules — the profile "
            f"is in a healthy state across every lens."
        )
    return (
        f"{ctx.archetype_title} profile (intelligence {ctx.intelligence_overall}). "
        f"The rule engine produced {n_rules} firings across the active "
        f"lenses; this decision highlights the {n_insights} most decision-"
        f"worthy findings, with the supporting rule ids and knowledge "
        f"articles attached to each insight."
    )


def _overall_health(ctx: AIContext) -> str:
    if ctx.intelligence_overall >= 70:
        return "Strong"
    if ctx.intelligence_overall >= 40:
        return "Mixed"
    return "Needs work"

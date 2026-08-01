"""AssistantContextBuilder — Sprint 7 Part 2.

Pure projection from the five upstream service payloads (Twin,
Recommendations, Roadmap, Rules, Insights) into the narrow
:class:`AssistantContext` dataclass the provider is allowed to
see.

The builder is a **delegator**, not a re-deriver. It reads the
upstream payloads' *output shapes* once and projects the fields
the prompt actually needs. It never:

  * re-computes a business score
  * re-derives a recommendation priority
  * re-sorts roadmap items by estimated_start_order
  * re-classifies a rule firing's priority

The Sprint 7 Part 1 frontend builder in
``frontend/features/assistant/builder.ts`` is the source of
truth for the deterministic path. This builder exists because
the backend layer needs to feed a real LLM the same shape
locally when one is configured (Ollama). When no real LLM is
configured, the deterministic fallback in ``base.py`` produces
a similar body from the same context.

The builder is stateless. Two calls with the same
``owner_id`` and same database state produce identical
:class:`AssistantContext` instances (sans the response envelope's
``generated_at``).
"""
from __future__ import annotations

from typing import Any

from app.services.ai.providers.base import (
    AssistantContext,
    AssistantContextDna,
    AssistantContextInsight,
    AssistantContextRecommendation,
    AssistantContextRoadmap,
    AssistantContextRule,
    AssistantContextScore,
)


# Cap on how many records the LLM sees per source. Long
# contexts degrade response quality and burn tokens. The
# numbers are conservative; a future RAG layer can tune
# them.
_MAX_SCORES = 11
_MAX_RECOMMENDATIONS = 12
_MAX_ROADMAP = 12
_MAX_RULES = 12
_MAX_INSIGHTS = 8


class AssistantContextBuilder:
    """Build an :class:`AssistantContext` from the upstream payloads.

    The builder takes the *responses* from the five upstream
    service methods:

      * ``twin.compute(owner_id)``
      * ``recommendations.compute(owner_id)``
      * ``roadmap.compute(owner_id)``
      * ``rules.compute(owner_id)``
      * ``insights`` = the AI Decision engine's
        ``decision.insights`` (Sprint 3 Part 2)

    Each input is a plain dict — the builder never reaches into
    a service directly. The constructor accepts five callables
    that produce these dicts so the verifier and any future
    unit test can swap in synthetic fixtures.
    """

    def __init__(
        self,
        *,
        twin_provider,
        recommendations_provider,
        roadmap_provider,
        rules_provider,
        insights_provider,
    ) -> None:
        self._twin = twin_provider
        self._recs = recommendations_provider
        self._roadmap = roadmap_provider
        self._rules = rules_provider
        self._insights = insights_provider

    def build(self, *, owner_id: int) -> AssistantContext:
        twin = self._twin(owner_id)
        recs = self._recs(owner_id)
        roadmap = self._roadmap(owner_id)
        rules = self._rules(owner_id)
        decision = self._insights(owner_id)

        return AssistantContext(
            business_id=int(owner_id),
            overall_business_score=_overall_score(twin),
            band=_band(_overall_score(twin)),
            dna=_project_dna(twin),
            scores=_project_scores(twin),
            recommendations=_project_recommendations(recs),
            roadmap=_project_roadmap(roadmap),
            rules=_project_rules(rules),
            insights=_project_insights(decision),
            twin_generated_at=twin.get("generated_at") if isinstance(twin, dict) else None,
            recommendations_generated_at=recs.get("generated_at") if isinstance(recs, dict) else None,
            roadmap_generated_at=roadmap.get("generated_at") if isinstance(roadmap, dict) else None,
            rules_generated_at=rules.get("generated_at") if isinstance(rules, dict) else None,
            insights_generated_at=(decision.get("generated_at")
                                   if isinstance(decision, dict) else None),
        )


# --------------------------------------------------------------------------- #
# Field projectors — defensive against upstream shape drift
# --------------------------------------------------------------------------- #


def _overall_score(twin: Any) -> int:
    if not isinstance(twin, dict):
        return 0
    ch = twin.get("current_health") or {}
    if isinstance(ch, dict) and "overall_business_score" in ch:
        try:
            return max(0, min(100, int(ch.get("overall_business_score") or 0)))
        except (TypeError, ValueError):
            pass
    # Twin also exposes an overall_twin_health (0..100) and
    # health_summary.overall_health.score. Try them in order.
    overall_health = twin.get("overall_twin_health")
    if isinstance(overall_health, (int, float)):
        return max(0, min(100, int(overall_health)))
    health = twin.get("health_summary") or {}
    if isinstance(health, dict):
        ov = health.get("overall_health")
        if isinstance(ov, dict) and "score" in ov:
            try:
                return max(0, min(100, int(ov.get("score") or 0)))
            except (TypeError, ValueError):
                return 0
    return 0


def _band(score: int) -> str:
    if score >= 75:
        return "Leading"
    if score >= 50:
        return "Established"
    if score >= 25:
        return "Developing"
    return "Foundation"


def _project_dna(twin: Any) -> AssistantContextDna:
    if not isinstance(twin, dict):
        return AssistantContextDna(
            archetype_key="foundation_builder",
            archetype_title="Foundation Builder",
            match_score=0,
        )
    dna_block = twin.get("dna") or {}
    inner = dna_block.get("dna") if isinstance(dna_block, dict) else None
    if not isinstance(inner, dict):
        inner = dna_block if isinstance(dna_block, dict) else {}
    archetype = inner.get("archetype") or {}
    if not isinstance(archetype, dict):
        archetype = {}
    key = str(archetype.get("key", "foundation_builder") or "foundation_builder")
    title = str(
        archetype.get("title")
        or inner.get("archetype_title")
        or "Foundation Builder"
    )
    match_score = _safe_int(
        archetype.get("match_score"),
        inner.get("archetype_match_score"),
    )
    return AssistantContextDna(
        archetype_key=key,
        archetype_title=title,
        match_score=match_score,
    )


def _project_scores(twin: Any) -> tuple[AssistantContextScore, ...]:
    if not isinstance(twin, dict):
        return ()
    health = twin.get("health_summary") or {}
    items = health.get("scores") if isinstance(health, dict) else None
    if not isinstance(items, list):
        # Twin exposes readiness scores under several keys —
        # try the most common one. We never re-derive scores.
        items = twin.get("readiness_scores") or twin.get("scores_block", {}).get("scores") or []
    if not isinstance(items, list):
        return ()
    out: list[AssistantContextScore] = []
    for s in items[:_MAX_SCORES]:
        if not isinstance(s, dict):
            continue
        out.append(AssistantContextScore(
            key=str(s.get("key", "") or ""),
            title=str(s.get("title", s.get("key", "")) or ""),
            score=_safe_int(s.get("score")),
            level=str(s.get("level", "Low") or "Low"),
        ))
    return tuple(out)


def _project_recommendations(recs: Any) -> tuple[AssistantContextRecommendation, ...]:
    if not isinstance(recs, dict):
        return ()
    items = recs.get("recommendations") or []
    if not isinstance(items, list):
        return ()
    out: list[AssistantContextRecommendation] = []
    for r in items[:_MAX_RECOMMENDATIONS]:
        if not isinstance(r, dict):
            continue
        out.append(AssistantContextRecommendation(
            id=str(r.get("id", "") or ""),
            title=str(r.get("title", "") or ""),
            category=str(r.get("category", "") or ""),
            priority=str(r.get("priority", "Medium") or "Medium"),
            estimated_score_gain=_safe_int(r.get("estimated_score_gain")),
            estimated_roi=_safe_float(r.get("estimated_roi")),
            estimated_timeline=str(r.get("estimated_timeline", "") or ""),
        ))
    return tuple(out)


def _project_roadmap(roadmap: Any) -> tuple[AssistantContextRoadmap, ...]:
    if not isinstance(roadmap, dict):
        return ()
    items = roadmap.get("items") or []
    if not isinstance(items, list):
        return ()
    out: list[AssistantContextRoadmap] = []
    for it in items[:_MAX_ROADMAP]:
        if not isinstance(it, dict):
            continue
        out.append(AssistantContextRoadmap(
            id=str(it.get("id", "") or ""),
            title=str(it.get("title", "") or ""),
            phase=str(it.get("phase", "Short-Term") or "Short-Term"),
            priority=str(it.get("priority", "Medium") or "Medium"),
            estimated_start_order=_safe_int(it.get("estimated_start_order")),
            completion_percentage=_safe_int(it.get("completion_percentage")),
            expected_score_improvement=_safe_int(it.get("expected_score_improvement")),
        ))
    return tuple(out)


def _project_rules(rules: Any) -> tuple[AssistantContextRule, ...]:
    if not isinstance(rules, dict):
        return ()
    categories = rules.get("categories") or {}
    if not isinstance(categories, dict):
        return ()
    out: list[AssistantContextRule] = []
    # Iterate categories in the dict's insertion order — the
    # Rules engine emits them in spec order, which is the
    # order the brief expects.
    for cat, block in categories.items():
        if not isinstance(block, dict):
            continue
        firings = block.get("firings") or []
        if not isinstance(firings, list):
            continue
        for f in firings:
            if not isinstance(f, dict):
                continue
            out.append(AssistantContextRule(
                id=str(f.get("id", "") or ""),
                title=str(f.get("title", "") or ""),
                category=str(cat or ""),
                priority=str(f.get("priority", "Low") or "Low"),
                estimated_impact=_safe_int(f.get("estimated_impact")),
                reason=str(f.get("reason", "") or ""),
            ))
            if len(out) >= _MAX_RULES:
                return tuple(out)
    return tuple(out)


def _project_insights(decision: Any) -> tuple[AssistantContextInsight, ...]:
    if not isinstance(decision, dict):
        return ()
    dec = decision.get("decision") or {}
    if not isinstance(dec, dict):
        return ()
    items = dec.get("insights") or []
    if not isinstance(items, list):
        return ()
    out: list[AssistantContextInsight] = []
    for ins in items[:_MAX_INSIGHTS]:
        if not isinstance(ins, dict):
            continue
        out.append(AssistantContextInsight(
            id=str(ins.get("id", "") or ""),
            title=str(ins.get("title", "") or ""),
            priority=str(ins.get("priority", "Medium") or "Medium"),
            confidence=_safe_int(ins.get("confidence")),
        ))
    return tuple(out)


def _safe_int(*candidates: Any) -> int:
    for v in candidates:
        if v is None:
            continue
        try:
            return int(v)
        except (TypeError, ValueError):
            continue
    return 0


def _safe_float(*candidates: Any) -> float:
    for v in candidates:
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return 0.0
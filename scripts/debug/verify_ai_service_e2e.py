"""H8.11 — End-to-end smoke test of the AI service.

Runs every layer of the AI assistant pipeline against a
stubbed context and prints what each layer produced.

Checks:
  1. IntentRouter.classify_intent() for all 6 intents
  2. BusinessReasoningEngine.plan() output
  3. EvidenceRetriever.rank() output
  4. AssistantPromptBuilder.build() rendered message
  5. AssistantProviderService.generate() with deterministic fallback
  6. GroundingValidator on a real response
  7. Multi-tier fallback chain
  8. Hard wall-clock timeout

Exit code 0 = all checks passed.
"""
from __future__ import annotations

import sys
import os
import json
import time
from pathlib import Path

# Ensure ``app`` is importable — pyproject.toml sets
# pythonpath=["backend"] for pytest, but this script runs
# directly.
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

# Force UTF-8 output on Windows (default cp1252).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# --------------------------------------------------------------------------- #
# Stub context builder
# --------------------------------------------------------------------------- #


def _build_test_context():
    """Build a minimal ``AssistantContext`` that exercises every field."""
    from app.services.ai.providers.base import (
        AssistantContext,
        AssistantContextDna,
        AssistantContextRecommendation,
        AssistantContextRoadmap,
        AssistantContextRule,
        AssistantContextInsight,
        AssistantContextScore,
        AssistantContextScheme,
        AssistantContextForecast,
        AnalyticsMetric,
    )
    return AssistantContext(
        business_id=1,
        legal_name="Acme Textiles",
        overall_business_score=68,
        band="Established",
        dna=AssistantContextDna(
            archetype_key="growth_seeker",
            archetype_title="Growth Seeker",
            match_score=82,
        ),
        annual_revenue_inr=18_000_000,
        target_revenue_inr=30_000_000,
        industry="textiles",
        location="Mumbai, MH, India",
        recommendations=tuple(
            AssistantContextRecommendation(
                id=f"rec_{i}",
                title=f"Recommendation {i}",
                category="ops",
                priority="High" if i == 0 else "Medium",
                estimated_score_gain=10,
                estimated_roi=100_000.0,
                estimated_timeline="3 months",
            )
            for i in range(5)
        ),
        roadmap=tuple(
            AssistantContextRoadmap(
                id=f"roadmap_{i}",
                title=f"Roadmap item {i}",
                phase="Q1",
                priority="Medium",
                estimated_start_order=i + 1,
                completion_percentage=0,
                expected_score_improvement=5,
            )
            for i in range(6)
        ),
        rules=tuple(
            AssistantContextRule(
                id=f"rule_{i}",
                title=f"Rule {i}",
                category="ops",
                priority="Critical" if i == 0 else "High",
                estimated_impact=8,
                reason=f"Reason for rule {i}",
            )
            for i in range(3)
        ),
        insights=tuple(
            AssistantContextInsight(
                id=f"insight_{i}",
                title=f"Insight {i}",
                priority="High",
                confidence=80,
            )
            for i in range(3)
        ),
        scores=tuple(
            AssistantContextScore(
                key="finance",
                title="Financial Readiness",
                score=72,
                level="Established",
            )
            for _ in range(5)
        ),
        schemes=tuple(
            AssistantContextScheme(
                scheme_id=f"scheme_{i}",
                title=f"Scheme {i}",
                authority="MSME Ministry",
                profile_match_score=80,
                last_verified_date="2024-01-01",
                application_url="https://example.com",
            )
            for i in range(3)
        ),
        forecasts=tuple(
            AssistantContextForecast(
                scenario_id=f"forecast_{i}",
                horizon_label="12 months",
                revenue_delta=5_000_000.0,
                score_delta=8,
                confidence=75,
                assumption_summary="Baseline scenario",
            )
            for i in range(2)
        ),
        analytics_metrics=tuple(
            AnalyticsMetric(
                metric_id=f"metric_{i}",
                metric_name="Working capital ratio",
                current_value=1.8,
                unit="ratio",
                trend="stable",
            )
            for i in range(2)
        ),
    )


def _check(test_name, condition, detail=""):
    """Print a pass/fail line and return 0/1."""
    if condition:
        print(f"  PASS  {test_name}")
        return 0
    else:
        print(f"  FAIL  {test_name}  {detail}")
        return 1


def main() -> int:
    failures = 0

    print("=" * 78)
    print("Layer 1: IntentRouter.classify_intent()")
    print("=" * 78)
    from app.services.ai.providers.intent_router import (
        QuestionIntent, classify_intent,
    )

    intent_cases = [
        ("How can I reach 3 crore revenue?", QuestionIntent.REACH_REVENUE_TARGET),
        ("What is my biggest weakness?", QuestionIntent.BIGGEST_WEAKNESS),
        ("Which government schemes should I apply for?", QuestionIntent.GOVERNMENT_SCHEMES),
        ("Give me a 12 month roadmap", QuestionIntent.TWELVE_MONTH_ROADMAP),
        ("Should I expand exports?", QuestionIntent.EXPORT_EXPANSION),
        ("Tell me about the weather", QuestionIntent.GENERAL),
        ("", QuestionIntent.GENERAL),
        (None, QuestionIntent.GENERAL),
    ]
    for prompt, expected in intent_cases:
        result = classify_intent(prompt or "")
        label = repr(prompt)[:40]
        failures += _check(
            f"intent({label}) == {expected.value}",
            result == expected,
            f"got {result.value}",
        )

    print()
    print("=" * 78)
    print("Layer 2: BusinessReasoningEngine.plan()")
    print("=" * 78)
    from app.services.ai.reasoning.reasoning_engine import BusinessReasoningEngine
    from app.services.ai.reasoning.pipeline import ReasoningPlan

    ctx = _build_test_context()
    engine = BusinessReasoningEngine()
    plan = engine.plan(user_prompt="How can I reach 3 crore revenue?", context=ctx)
    failures += _check("plan is ReasoningPlan", isinstance(plan, ReasoningPlan))
    failures += _check(
        "plan.intent == reach_revenue_target", plan.intent == "reach_revenue_target",
        f"got {plan.intent}",
    )
    failures += _check(
        "plan.subgraph_node_ids is tuple", isinstance(plan.subgraph_node_ids, tuple),
    )
    failures += _check(
        "plan.confidence in [0,100]", 0.0 <= plan.confidence <= 100.0,
        f"got {plan.confidence}",
    )
    failures += _check(
        "plan.hypotheses is non-empty", len(plan.hypotheses) > 0,
    )

    # None context
    plan_none = engine.plan(user_prompt="How can I reach 3 crore?", context=None)
    failures += _check(
        "plan with None context has intent",
        plan_none.intent == "reach_revenue_target",
    )
    failures += _check(
        "plan with None context has empty subgraph",
        plan_none.subgraph_node_ids == (),
    )

    # Empty prompt
    plan_empty = engine.plan(user_prompt="", context=ctx)
    failures += _check(
        "empty prompt -> general intent", plan_empty.intent == "general",
    )

    print()
    print("=" * 78)
    print("Layer 3: EvidenceRetriever.rank()")
    print("=" * 78)
    from app.services.ai.reasoning.evidence_retriever import (
        EvidenceRetriever, RankedEvidence,
    )
    from app.services.ai.providers.evidence_registry import EvidenceRegistry

    registry = EvidenceRegistry(ctx)
    retriever = EvidenceRetriever(top_n=10)
    ranked = retriever.rank(context=ctx, registry=registry, reasoning_plan=plan)
    failures += _check("ranked is RankedEvidence", isinstance(ranked, RankedEvidence))
    failures += _check(
        "ranked.intent echoes plan.intent",
        ranked.intent == plan.intent,
        f"got {ranked.intent}",
    )
    failures += _check(
        "ranked.total matches registry.count",
        ranked.total == registry.count,
        f"got {ranked.total} vs {registry.count}",
    )
    failures += _check(
        "ranked.entries is tuple",
        isinstance(ranked.entries, tuple),
    )
    failures += _check(
        "ranked.entries len <= top_n",
        len(ranked.entries) <= 10,
        f"got {len(ranked.entries)}",
    )

    # Registry not mutated
    before_ids = list(registry.ids())
    retriever.rank(context=ctx, registry=registry, reasoning_plan=plan)
    failures += _check(
        "registry not mutated",
        list(registry.ids()) == before_ids,
    )

    # top_n override
    ranked_2 = retriever.rank(
        context=ctx, registry=registry, reasoning_plan=plan, top_n=2,
    )
    failures += _check(
        "top_n override honoured",
        len(ranked_2.entries) <= 2,
    )

    print()
    print("=" * 78)
    print("Layer 4: AssistantPromptBuilder.build()")
    print("=" * 78)
    from app.services.ai.providers.prompt_builder import AssistantPromptBuilder

    pb = AssistantPromptBuilder()
    request = pb.build(
        context=ctx,
        user_prompt="How can I reach 3 crore revenue?",
        mode="grounded",
        reasoning_plan=plan,
        ranked_evidence=ranked,
    )
    msg = AssistantPromptBuilder.render_user_message(request)
    failures += _check(
        "grounded message contains REASONING TRACE",
        "=== REASONING TRACE" in msg,
    )
    failures += _check(
        "grounded message contains END REASONING TRACE",
        "=== END REASONING TRACE ===" in msg,
    )
    failures += _check(
        "grounded message contains intent label",
        "intent: reach_revenue_target" in msg,
    )
    failures += _check(
        "grounded message contains EVIDENCE REGISTRY block",
        "=== EVIDENCE REGISTRY" in msg,
    )
    failures += _check(
        "grounded message contains ranked-by-relevance footer",
        "ranked by relevance" in msg,
    )
    failures += _check(
        "grounded message contains TASK FRAMING for flagship",
        "=== TASK FRAMING" in msg,
    )
    failures += _check(
        "grounded message has task framing intent",
        "REACH_REVENUE_TARGET" in msg,
    )

    # Open mode
    request_open = pb.build(
        context=ctx,
        user_prompt="How can I reach 3 crore revenue?",
        mode="open",
        reasoning_plan=plan,
        ranked_evidence=ranked,
    )
    msg_open = AssistantPromptBuilder.render_user_message(request_open)
    # Open mode includes the registry only when a real
    # business profile is bound — Acme Textiles has one, so
    # the registry block MUST be present (along with the
    # reasoning trace).
    failures += _check(
        "open mode has EVIDENCE REGISTRY block when profile exists",
        "=== EVIDENCE REGISTRY" in msg_open,
    )
    failures += _check(
        "open mode still has REASONING TRACE",
        "=== REASONING TRACE" in msg_open,
    )
    # And open mode with an empty profile must NOT emit a
    # registry — that's the "no profile bound" path.
    from app.services.ai.providers.base import (
        AssistantContext as _AC, AssistantContextDna as _ACD,
    )
    empty_ctx = _AC(
        business_id=0,
        legal_name="unknown",
        overall_business_score=0,
        band="unknown",
        dna=_ACD(archetype_key="unknown", archetype_title="unknown", match_score=0),
        annual_revenue_inr=0,
    )
    req_open_empty = pb.build(
        context=empty_ctx, user_prompt="hello", mode="open",
    )
    msg_open_empty = AssistantPromptBuilder.render_user_message(req_open_empty)
    failures += _check(
        "open mode without profile has NO registry",
        "=== EVIDENCE REGISTRY" not in msg_open_empty,
    )

    # Backward compat — no plan, no ranked. A non-flagship
    # prompt (``"hello"``) routes to GENERAL intent so the
    # prompt builder does NOT emit a TASK FRAMING block — it
    # stays the lightweight legacy surface.
    request_legacy = pb.build(
        context=ctx, user_prompt="hello", mode="grounded",
    )
    msg_legacy = AssistantPromptBuilder.render_user_message(request_legacy)
    failures += _check(
        "legacy (no plan) prompt still renders EVIDENCE REGISTRY",
        "=== EVIDENCE REGISTRY" in msg_legacy,
    )
    failures += _check(
        "legacy (no plan) has NO reasoning trace",
        "=== REASONING TRACE" not in msg_legacy,
    )
    failures += _check(
        "legacy non-flagship prompt has NO task framing",
        "=== TASK FRAMING" not in msg_legacy,
    )

    # Backward compat — flagship prompt with no plan: must
    # still emit TASK FRAMING (legacy callers relied on it).
    request_legacy_flagship = pb.build(
        context=ctx,
        user_prompt="How can I reach 3 crore?",
        mode="grounded",
    )
    msg_legacy_flagship = AssistantPromptBuilder.render_user_message(
        request_legacy_flagship
    )
    failures += _check(
        "legacy flagship prompt still emits TASK FRAMING",
        "=== TASK FRAMING" in msg_legacy_flagship,
    )

    print()
    print("=" * 78)
    print("Layer 5: AssistantProviderService.generate() (deterministic fallback)")
    print("=" * 78)
    from app.services.ai.providers.service import AssistantProviderService
    from app.services.ai.providers.base import DeterministicFallbackProvider

    class _StubContextBuilder:
        def build(self, *, owner_id, user_prompt=""):
            return ctx

    svc = AssistantProviderService(context_builder=_StubContextBuilder())
    t0 = time.time()
    resp = svc.generate(
        owner_id=1,
        user_prompt="How can I reach 3 crore revenue?",
        provider=DeterministicFallbackProvider(),
    )
    elapsed = time.time() - t0
    failures += _check(
        "generate returned AssistantResponse",
        resp is not None,
    )
    failures += _check(
        "fallback_used=True for deterministic",
        resp.fallback_used is True,
    )
    failures += _check(
        "model == deterministic-fallback",
        resp.model == "deterministic-fallback",
    )
    failures += _check(
        "body contains intent marker",
        "Intent detected: Reach revenue target" in (resp.body or ""),
    )
    failures += _check(
        "elapsed < 5s",
        elapsed < 5.0,
        f"took {elapsed:.2f}s",
    )

    print()
    print("=" * 78)
    print("Layer 6: GroundingValidator on a stub response")
    print("=" * 78)
    from app.services.ai.providers.grounding_validator import GroundingValidator
    from app.services.ai.providers.response_schema import parse_model_output

    # Build a JSON body that cites real registry IDs.
    # Discover the IDs the registry actually emitted so the
    # stub never references a missing record.
    real_rec_ids = [
        e.id for e in registry.all() if e.kind.value == "recommendation"
    ]
    other_ids = [e.id for e in registry.all() if e.kind.value != "recommendation"]
    if not real_rec_ids:
        failures += _check(
            "registry has recommendation ids",
            False,
            "no RECOMMENDATION entries in fixture — test cannot continue",
        )
        return failures
    rec_id = real_rec_ids[0]
    other_id = other_ids[0] if other_ids else rec_id

    valid_body = json.dumps({
        "executive_summary": "Test summary grounded against the registry.",
        "business_facts": [f"Revenue baseline = {other_id}"],
        "situation_assessment": "Established",
        "reasoning": "Grounded against the registry entries.",
        "root_causes": [],
        "key_findings": [{
            "statement": "Score is in Established band",
            "evidence_refs": [other_id],
        }],
        "recommendations": [{
            "recommendation_id": rec_id,
            "title": "x",
            "rationale": "x",
            "evidence_refs": [rec_id],
        }],
        "priority_matrix": [],
        "roi_estimate": "n/a",
        "risks": [],
        "thirty_day_plan": [],
        "scheme_matches": [],
        "assumptions": ["Test assumption"],
        "limitations": ["Test limitation"],
        "confidence": 80,
        "evidence_references": [
            {"id": other_id, "kind": "score", "label": "Overall"},
        ],
    })
    parsed = parse_model_output(valid_body)
    failures += _check("schema parse OK", parsed.ok)
    failures += _check(
        "parsed.response is not None", parsed.response is not None,
    )

    validator = GroundingValidator(registry, parsed.response, raw_body=valid_body)
    report = validator.validate()
    failures += _check(
        "grounding validator passes",
        report.passed,
        f"score={report.score}, errors={list(report.errors)[:3]}",
    )

    print()
    print("=" * 78)
    print("Layer 7: Multi-tier fallback chain (provider raises)")
    print("=" * 78)
    from app.services.ai.providers.base import (
        ProviderUnavailableError, AssistantResponse,
    )

    class _BrokenProvider:
        name = "broken"
        is_available = True
        model_name = "broken-1"

        def complete(self, request):
            raise ProviderUnavailableError("simulated outage")

        def close(self) -> None:
            pass

    t0 = time.time()
    resp_broken = svc.generate(
        owner_id=1,
        user_prompt="How can I reach 3 crore revenue?",
        provider=_BrokenProvider(),
    )
    elapsed = time.time() - t0
    failures += _check(
        "broken provider -> fallback_used",
        resp_broken.fallback_used is True,
    )
    failures += _check(
        "broken provider -> deterministic model",
        resp_broken.model == "deterministic-fallback",
    )
    failures += _check(
        "broken provider -> reason set",
        resp_broken.fallback_reason in (
            "provider_unavailable", "primary_provider_unavailable",
        ),
        f"got {resp_broken.fallback_reason!r}",
    )
    failures += _check(
        "broken provider fallback < 5s",
        elapsed < 5.0,
        f"took {elapsed:.2f}s",
    )

    print()
    print("=" * 78)
    print("Layer 8: Hard wall-clock timeout (provider hangs)")
    print("=" * 78)
    import threading

    class _HangingProvider:
        name = "hanging"
        is_available = True
        model_name = "hanging-1"

        def complete(self, request):
            # Hang for 30s — service must kill it within 15s.
            time.sleep(30)
            return AssistantResponse(body="", model="x", provider_used="x")

        def close(self) -> None:
            pass

    # Patch HARD_CALL_TIMEOUT_SECONDS to 2s for fast smoke test.
    from app.services.ai.providers import service as svc_module
    saved = svc_module.HARD_CALL_TIMEOUT_SECONDS
    svc_module.HARD_CALL_TIMEOUT_SECONDS = 2.0
    t0 = time.time()
    try:
        resp_hang = svc.generate(
            owner_id=1,
            user_prompt="How can I reach 3 crore revenue?",
            provider=_HangingProvider(),
        )
    finally:
        svc_module.HARD_CALL_TIMEOUT_SECONDS = saved
    elapsed = time.time() - t0
    failures += _check(
        "hanging provider -> fallback_used",
        resp_hang.fallback_used is True,
    )
    failures += _check(
        "hanging provider -> reason timeout",
        resp_hang.fallback_reason == "timeout",
        f"got {resp_hang.fallback_reason!r}",
    )
    failures += _check(
        "hanging provider fallback within 2s + slack",
        elapsed < 4.0,
        f"took {elapsed:.2f}s",
    )

    print()
    print("=" * 78)
    print(f"Total failures: {failures}")
    print("=" * 78)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

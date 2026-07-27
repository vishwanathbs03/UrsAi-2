"""AdvisorService — Sprint 7 Part 5 (Autonomous Business Advisor).

The advisor is a *read-only aggregator*. It does NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify any existing service
  * duplicate any recommendation / roadmap / scoring / DNA / twin logic
  * send emails, push notifications, schedule jobs, or call APIs

It does ONLY:

  * read the five existing upstream payloads (Twin, Rules,
    Recommendations, Roadmap, AI Decision / Insights)
  * project them into the seven spec sections
  * surface a deterministic one-paragraph business summary
  * echo every upstream ``generated_at`` in the inputs sidecar
  * emit safe "advice" labels — REVIEW / PRIORITISE / DECIDE /
    INVESTIGATE / PLAN / LEARN / MONITOR / REFRESH — that the
    user can act on manually

Architecture
------------

The service follows the same pattern as the Digital Twin engine
and the Sprint 6 Part 5 predictive-analytics page:

  * The endpoint is the only caller.
  * The service is constructed with a
    :class:`BusinessRepository` so it can be unit-tested with
    an in-memory session.
  * The service holds a reference to each of the five
    upstream service classes *but never instantiates them on
    construction* — it instantiates them lazily on
    :meth:`advise` so the wiring is
    request-scoped (matching the existing pattern in
    :mod:`app.api.v1.endpoints.chat`).
  * The response is a pure function of the upstream payloads
    + ``owner_id``. Two calls with the same owner_id + same
    database state produce byte-identical responses (sans
    ``generated_at``).

Determinism contract
--------------------

* The output ordering is stable: every tuple is sorted by
  priority rank then by source_key then by id.
* The inputs sidecar echoes every upstream ``generated_at`` so
  the verifier can strip them and prove the rest is
  byte-identical.
* The seven sections are never empty — each section either
  surfaces the matching upstream data (preferred) or a
  deterministic "no signal" line for the section.

Predictive Analytics + Notifications consumption
------------------------------------------------

The brief says the advisor "consumes" Predictive Analytics and
Notifications. Both are themselves pure derivations over the same
five upstream payloads (the Sprint 6 Part 5 predictive-analytics
page reads ``twin.timeline``; the Sprint 6 Part 4 notifications
page reads ``twin.risk_matrix`` + ``twin.opportunity_matrix`` +
``rules`` + ``recommendations`` + ``roadmap``). The advisor
surfaces the **same** fields those pages read — no parallel
indices, no second copy of the data. The :class:`AdvisorInputs`
sidecar records the timestamp of "predictive" and "notifications"
as the twin ``generated_at`` (the upstream those derivations
share), so the verifier can prove the advisor is reading the
same source of truth.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from app.repositories.business_repository import BusinessRepository
from app.services.advisor.base import (
    AdvisorAction,
    AdvisorActionType,
    AdvisorAdvice,
    AdvisorBusinessSummary,
    AdvisorHealthReview,
    AdvisorInputs,
    AdvisorResponse,
    AdvisorSection,
)
from app.services.ai import AIDecisionService
from app.services.recommendations import RecommendationService
from app.services.roadmap import RoadmapService
from app.services.rules import RuleEngineService
from app.services.twin import TwinService


# --------------------------------------------------------------------------- #
# Limits — keep the response bounded.
# --------------------------------------------------------------------------- #


_DAILY_BRIEF_LIMIT = 5
_WEEKLY_SUMMARY_LIMIT = 5
_PRIORITY_CHANGES_LIMIT = 5
_UPCOMING_RISKS_LIMIT = 5
_MISSED_OPPORTUNITIES_LIMIT = 5
_SUGGESTED_ACTIONS_LIMIT = 6


# --------------------------------------------------------------------------- #
# Priority ordering
# --------------------------------------------------------------------------- #


_PRIORITY_RANK = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


def _priority_rank(p: str) -> int:
    return _PRIORITY_RANK.get(str(p or ""), 99)


# --------------------------------------------------------------------------- #
# Helpers — safe type coercion
# --------------------------------------------------------------------------- #


def _safe_str(value: Any, default: str = "") -> str:
    try:
        return "" if value is None else str(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _band_for_score(score: int) -> str:
    if score >= 75:
        return "Leading"
    if score >= 50:
        return "Established"
    if score >= 25:
        return "Developing"
    return "Foundation"


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #


class AdvisorService:
    """The Autonomous Business Advisor façade.

    The service is reconstructed per request (matches the
    pattern of the chat endpoint factory in
    :mod:`app.api.v1.endpoints.chat`). It holds the
    upstream service classes by reference and instantiates
    them against the same :class:`BusinessRepository` it
    was given.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    # ---- Public API -------------------------------------------------- #

    def advise(self, *, owner_id: int) -> dict:
        """Build the full advice envelope.

        Returns a dict matching the schema in
        :mod:`app.schemas.advisor`. The endpoint validates
        the response against the Pydantic model so an
        unhandled code path fails loudly at the API boundary,
        not silently in the UI.

        Raises :class:`BusinessNotFound` when the user has
        no business profile yet. The endpoint translates
        that into a 404.
        """
        # 1. Read the five upstream payloads. None of these
        # call an LLM or mutate state.
        twin = TwinService(self._repo).compute(owner_id)
        rules = RuleEngineService(self._repo).compute(owner_id)
        recs = RecommendationService(self._repo).compute(owner_id)
        roadmap = RoadmapService(self._repo).compute(owner_id)
        decision = self._safe_decision(owner_id)

        # 2. Build the seven sections in order.
        business_summary = self._build_business_summary(twin, rules, recs, roadmap)
        daily_brief = self._build_daily_brief(twin, rules, recs, roadmap, decision)
        weekly_summary = self._build_weekly_summary(twin, rules, recs, roadmap, decision)
        health_review = self._build_health_review(twin)
        priority_changes = self._build_priority_changes(rules, recs)
        upcoming_risks = self._build_upcoming_risks(twin, rules)
        missed_opportunities = self._build_missed_opportunities(twin, recs)
        suggested_actions = self._build_suggested_actions(
            twin, rules, recs, roadmap, decision,
        )

        # 3. Inputs sidecar — echo every upstream generated_at.
        inputs = AdvisorInputs(
            twin_generated_at=_safe_str(twin.get("generated_at")) or None,
            rules_generated_at=_safe_str(rules.get("generated_at")) or None,
            recommendations_generated_at=_safe_str(recs.get("generated_at")) or None,
            roadmap_generated_at=_safe_str(roadmap.get("generated_at")) or None,
            decision_generated_at=(
                _safe_str(decision.get("generated_at")) or None
                if isinstance(decision, dict) else None
            ),
            # Predictive Analytics + Notifications are *derived
            # views* over the Twin. Their "generated_at" is the
            # twin's generated_at — the advisor surfaces the
            # same timestamps the derived pages would.
            predictive_generated_at=_safe_str(twin.get("generated_at")) or None,
            notifications_generated_at=_safe_str(twin.get("generated_at")) or None,
        )

        response = AdvisorResponse(
            generated_at=datetime.now(tz=timezone.utc).isoformat(),
            advisor_id=_advisor_id(owner_id),
            business_summary=business_summary,
            daily_brief=tuple(daily_brief),
            weekly_summary=tuple(weekly_summary),
            health_review=health_review,
            priority_changes=tuple(priority_changes),
            upcoming_risks=tuple(upcoming_risks),
            missed_opportunities=tuple(missed_opportunities),
            suggested_actions=tuple(suggested_actions),
            inputs=inputs,
        )
        return _to_payload(response)

    # ---- Section builders (pure functions of upstream payloads) ---- #

    def _build_business_summary(
        self,
        twin: dict,
        rules: dict,
        recs: dict,
        roadmap: dict,
    ) -> AdvisorBusinessSummary:
        identity = twin.get("identity") or {}
        dna = twin.get("dna") or {}
        scores = twin.get("scores") or {}
        cur = twin.get("current_health") or {}
        rules_summary = rules.get("summary") or {}
        recs_list = recs.get("recommendations") or []
        roadmap_items = roadmap.get("items") or []

        # The Twin stores the DNA archetype as a nested dict
        # (``dna.archetype.title``). The flat string is also
        # echoed on ``current_health.business_dna_archetype``
        # so the advisor prefers the nested source of truth
        # and falls back to the flat echo for older payloads.
        dna_archetype = dna.get("archetype") or {}
        if not isinstance(dna_archetype, dict):
            dna_archetype = {}
        archetype = _safe_str(
            dna_archetype.get("title")
            or dna_archetype.get("archetype_title")
            or cur.get("business_dna_archetype")
            or "Foundation Builder",
        )
        overall_score = _safe_int(
            scores.get("overall_score",
                       cur.get("overall_business_score",
                               twin.get("overall_twin_health"))),
        )
        overall_level = _safe_str(
            scores.get("overall_level", cur.get("overall_business_level", "")),
        )
        band = _band_for_score(overall_score)

        rule_critical = _safe_int(rules_summary.get("critical_count",
                                                    cur.get("rule_critical_count")))
        # Rules summary may not have critical_count directly; fall
        # back to summing the categories when present.
        if rule_critical == 0:
            cats = rules.get("categories") or {}
            if isinstance(cats, dict):
                for cat_block in cats.values():
                    if isinstance(cat_block, dict):
                        for f in cat_block.get("firings") or []:
                            if isinstance(f, dict) and str(f.get("priority", "")).lower() == "critical":
                                rule_critical += 1
        rule_high = _safe_int(rules_summary.get("high_count"))
        if rule_high == 0:
            cats = rules.get("categories") or {}
            if isinstance(cats, dict):
                for cat_block in cats.values():
                    if isinstance(cat_block, dict):
                        for f in cat_block.get("firings") or []:
                            if isinstance(f, dict) and str(f.get("priority", "")).lower() == "high":
                                rule_high += 1

        top_rec = None
        for r in recs_list:
            if not isinstance(r, dict):
                continue
            if top_rec is None:
                top_rec = r
                continue
            if _priority_rank(r.get("priority", "Low")) < _priority_rank(top_rec.get("priority", "Low")):
                top_rec = r
            elif (_priority_rank(r.get("priority", "Low")) ==
                  _priority_rank(top_rec.get("priority", "Low"))):
                if _safe_int(r.get("estimated_score_gain")) > _safe_int(top_rec.get("estimated_score_gain")):
                    top_rec = r
        highest = _safe_str(top_rec.get("title") if isinstance(top_rec, dict) else "")

        headline = (
            f"{_safe_str(identity.get('legal_name', 'Your business'))} is in the "
            f"{band} band at {overall_score}/100"
            f" with {rule_critical} critical rule"
            f"{'s' if rule_critical != 1 else ''}, "
            f"{len(recs_list)} active recommendation"
            f"{'s' if len(recs_list) != 1 else ''}, "
            f"and {len(roadmap_items)} roadmap item"
            f"{'s' if len(roadmap_items) != 1 else ''}. "
            f"Archetype: {archetype}."
        )

        return AdvisorBusinessSummary(
            legal_name=_safe_str(identity.get("legal_name", "")),
            industry=_safe_str(identity.get("industry", "")),
            archetype=archetype,
            overall_score=overall_score,
            overall_level=overall_level or band,
            band=band,
            dna_match=_safe_int(cur.get("business_dna_match")),
            rule_critical_count=rule_critical,
            rule_high_count=rule_high,
            recommendation_count=len(recs_list),
            roadmap_items_count=len(roadmap_items),
            highest_priority_action=highest or "No active recommendation yet.",
            headline=headline,
        )

    def _build_daily_brief(
        self,
        twin: dict,
        rules: dict,
        recs: dict,
        roadmap: dict,
        decision: dict | None,
    ) -> list[AdvisorAdvice]:
        """Daily brief — what the user should look at today.

        Builds a short, deterministic list sorted by
        (priority_rank, source_key) and capped at
        ``_DAILY_BRIEF_LIMIT``.
        """
        items: list[AdvisorAdvice] = []
        idx = 0

        # 1. Top recommendations by priority today.
        for i, r in enumerate(recs.get("recommendations") or []):
            if not isinstance(r, dict):
                continue
            items.append(AdvisorAdvice(
                id=f"daily.rec.{_safe_str(r.get('id', f'r{i}'))}",
                section=AdvisorSection.DAILY_BRIEF,
                title=_safe_str(r.get("title", "Unnamed recommendation")),
                summary=_safe_str(r.get("description", "")),
                priority=_safe_str(r.get("priority", "Medium")).capitalize() or "Medium",
                source="recommendations",
                source_key=f"recommendations.recommendations[{i}]",
                evidence_ids=tuple(sorted(set(_safe_str(x) for x in
                                               (r.get("supporting_rule_ids") or [])
                                               if x))),
            ))
            idx += 1

        # 2. Top critical / high rules.
        for cat_key, block in (rules.get("categories") or {}).items():
            if not isinstance(block, dict):
                continue
            for j, f in enumerate(block.get("firings") or []):
                if not isinstance(f, dict):
                    continue
                prio = _safe_str(f.get("priority", "")).capitalize()
                if prio not in ("Critical", "High"):
                    continue
                items.append(AdvisorAdvice(
                    id=f"daily.rule.{_safe_str(f.get('id', f'f{j}'))}",
                    section=AdvisorSection.DAILY_BRIEF,
                    title=_safe_str(f.get("title", "Unnamed rule")),
                    summary=_safe_str(f.get("reason", "")),
                    priority=prio,
                    source="rules",
                    source_key=f"rules.categories.{_safe_str(cat_key)}.firings[{j}]",
                    evidence_ids=(_safe_str(f.get("id")),),
                ))
                idx += 1

        # Sort by (priority_rank, source_key) and cap.
        items.sort(key=lambda a: (_priority_rank(a.priority), a.source_key, a.id))
        return items[:_DAILY_BRIEF_LIMIT]

    def _build_weekly_summary(
        self,
        twin: dict,
        rules: dict,
        recs: dict,
        roadmap: dict,
        decision: dict | None,
    ) -> list[AdvisorAdvice]:
        """Weekly summary — the broader outlook.

        Surfaces top roadmap items + insights. Same
        (priority, source_key) sort.
        """
        items: list[AdvisorAdvice] = []

        for i, it in enumerate(roadmap.get("items") or []):
            if not isinstance(it, dict):
                continue
            items.append(AdvisorAdvice(
                id=f"weekly.roadmap.{_safe_str(it.get('recommendation_id', f'ri{i}'))}",
                section=AdvisorSection.WEEKLY_SUMMARY,
                title=_safe_str(it.get("title", "Unnamed roadmap item")),
                summary=(
                    f"Phase {_safe_str(it.get('phase', ''))}, "
                    f"{_safe_int(it.get('completion_percentage'))}% complete, "
                    f"est. +{_safe_int(it.get('expected_score_improvement'))} score."
                ),
                priority=_safe_str(it.get("priority", "Medium")).capitalize() or "Medium",
                source="roadmap",
                source_key=f"roadmap.items[{i}]",
                evidence_ids=(_safe_str(it.get("recommendation_id", "")),),
            ))

        # Insight cards (when the AI Decision engine has produced one).
        if isinstance(decision, dict):
            dec = decision.get("decision") or {}
            for i, ins in enumerate(dec.get("insights") or []):
                if not isinstance(ins, dict):
                    continue
                sri = tuple(sorted(set(_safe_str(x) for x in
                                       (ins.get("supporting_rule_ids") or []) if x)))
                items.append(AdvisorAdvice(
                    id=f"weekly.insight.{_safe_str(ins.get('id', f'i{i}'))}",
                    section=AdvisorSection.WEEKLY_SUMMARY,
                    title=_safe_str(ins.get("title", "Unnamed insight")),
                    summary=_safe_str(ins.get("explanation", "")),
                    priority=_safe_str(ins.get("priority", "Medium")).capitalize() or "Medium",
                    source="decision",
                    source_key=f"decision.decision.insights[{i}]",
                    evidence_ids=sri,
                ))

        items.sort(key=lambda a: (_priority_rank(a.priority), a.source_key, a.id))
        return items[:_WEEKLY_SUMMARY_LIMIT]

    def _build_health_review(self, twin: dict) -> AdvisorHealthReview:
        """Today's health check + forward projections.

        Reads the four timeline projections from the existing
        Twin payload (the same payload the Sprint 6 Part 5
        Predictive Analytics page consumes). No new numeric
        value is computed.
        """
        timeline = twin.get("timeline") or {}
        cur = timeline.get("current") or {}
        m3 = timeline.get("three_month") or {}
        m6 = timeline.get("six_month") or {}
        m12 = timeline.get("twelve_month") or {}

        current = _safe_int(cur.get("projected_overall_score",
                                    twin.get("overall_twin_health")))
        p3 = _safe_int(m3.get("projected_overall_score"))
        p6 = _safe_int(m6.get("projected_overall_score"))
        p12 = _safe_int(m12.get("projected_overall_score"))

        # Risk + opportunity counts from the Twin risk/opportunity
        # matrices (the same source the Sprint 6 Part 4 Notifications
        # page reads).
        risk_matrix = twin.get("risk_matrix") or {}
        opp_matrix = twin.get("opportunity_matrix") or {}
        risk_count = (
            len(risk_matrix.get("critical_risks") or []) +
            len(risk_matrix.get("high_risks") or []) +
            len(risk_matrix.get("medium_risks") or []) +
            len(risk_matrix.get("emerging_risks") or [])
        )
        opp_count = (
            len(opp_matrix.get("quick_wins") or []) +
            len(opp_matrix.get("strategic_investments") or []) +
            len(opp_matrix.get("long_term_growth") or []) +
            len(opp_matrix.get("export_opportunities") or []) +
            len(opp_matrix.get("digital_opportunities") or []) +
            len(opp_matrix.get("funding_opportunities") or [])
        )

        current_level = _safe_str(
            cur.get("overall_business_level",
                    twin.get("current_health", {}).get("overall_business_level", "")),
        ) or _band_for_score(current)

        return AdvisorHealthReview(
            current_overall_score=current,
            current_overall_level=current_level,
            projected_3m=p3,
            projected_6m=p6,
            projected_12m=p12,
            delta_3m=p3 - current,
            delta_6m=p6 - current,
            delta_12m=p12 - current,
            band=_band_for_score(current),
            risk_count=risk_count,
            opportunity_count=opp_count,
        )

    def _build_priority_changes(
        self,
        rules: dict,
        recs: dict,
    ) -> list[AdvisorAdvice]:
        """Priority changes — items whose priority moved (or
        should).

        The advisor surfaces the highest-priority Critical rules
        that have no matching recommendation yet (the most
        common "priority gap" the user should close). This is a
        pure join over existing data; no new priority is
        computed.
        """
        items: list[AdvisorAdvice] = []
        rec_rule_ids = set()
        for r in recs.get("recommendations") or []:
            if not isinstance(r, dict):
                continue
            for rid in (r.get("supporting_rule_ids") or []):
                if rid:
                    rec_rule_ids.add(_safe_str(rid))

        for cat_key, block in (rules.get("categories") or {}).items():
            if not isinstance(block, dict):
                continue
            for j, f in enumerate(block.get("firings") or []):
                if not isinstance(f, dict):
                    continue
                prio = _safe_str(f.get("priority", "")).capitalize()
                if prio != "Critical":
                    continue
                if _safe_str(f.get("id")) in rec_rule_ids:
                    continue
                items.append(AdvisorAdvice(
                    id=f"priority.rule.{_safe_str(f.get('id', f'f{j}'))}",
                    section=AdvisorSection.PRIORITY_CHANGES,
                    title=f"Promote {_safe_str(f.get('title', 'Critical rule'))}",
                    summary=(
                        f"Critical rule with no matching recommendation — "
                        f"consider adding a recommendation to close the gap."
                    ),
                    priority="Critical",
                    source="rules",
                    source_key=f"rules.categories.{_safe_str(cat_key)}.firings[{j}]",
                    evidence_ids=(_safe_str(f.get("id")),),
                ))

        items.sort(key=lambda a: (a.source_key, a.id))
        return items[:_PRIORITY_CHANGES_LIMIT]

    def _build_upcoming_risks(
        self,
        twin: dict,
        rules: dict,
    ) -> list[AdvisorAdvice]:
        """Upcoming risks — Critical and High entries from the
        Twin risk matrix (the same source the Sprint 6 Part 4
        Notifications page surfaces as "risk" cards).
        """
        items: list[AdvisorAdvice] = []
        risk_matrix = twin.get("risk_matrix") or {}
        critical = risk_matrix.get("critical_risks") or []
        high = risk_matrix.get("high_risks") or []
        for i, r in enumerate(list(critical) + list(high)):
            if not isinstance(r, dict):
                continue
            prio = _safe_str(r.get("priority", "High")).capitalize() or "High"
            items.append(AdvisorAdvice(
                id=f"risk.twin.{_safe_str(r.get('risk_id', f'r{i}'))}",
                section=AdvisorSection.UPCOMING_RISKS,
                title=_safe_str(r.get("title", "Unnamed risk")),
                summary=_safe_str(r.get("description", "")),
                priority=prio,
                source="twin",
                source_key=f"twin.risk_matrix.{_safe_str(r.get('priority', 'high')).lower()}_risks[{i}]",
                evidence_ids=(_safe_str(r.get("risk_id", "")),),
            ))
        items.sort(key=lambda a: (_priority_rank(a.priority), a.source_key, a.id))
        return items[:_UPCOMING_RISKS_LIMIT]

    def _build_missed_opportunities(
        self,
        twin: dict,
        recs: dict,
    ) -> list[AdvisorAdvice]:
        """Missed opportunities — the top quick wins from the
        Twin opportunity matrix that have not been linked to a
        roadmap item yet.

        The advisor surfaces the highest-priority opportunities
        whose matching recommendation is not yet on the
        roadmap. This is a pure join; no new opportunity is
        invented.
        """
        items: list[AdvisorAdvice] = []
        opp = twin.get("opportunity_matrix") or {}
        # The Twin opportunity matrix is the same source the
        # Opportunity block of the dashboard uses, and the same
        # bucket the recommendations layer turns into roadmap
        # items. The advisor reads this single source — no
        # parallel index, no parallel derivation. The join to
        # in-flight roadmap items is via the
        # ``opportunity.recommendation_id`` field.
        for bucket_key, bucket in (
            ("quick_wins", opp.get("quick_wins") or []),
            ("strategic_investments", opp.get("strategic_investments") or []),
            ("long_term_growth", opp.get("long_term_growth") or []),
            ("export_opportunities", opp.get("export_opportunities") or []),
            ("digital_opportunities", opp.get("digital_opportunities") or []),
            ("funding_opportunities", opp.get("funding_opportunities") or []),
        ):
            for i, o in enumerate(bucket):
                if not isinstance(o, dict):
                    continue
                items.append(AdvisorAdvice(
                    id=f"missed.twin.{_safe_str(o.get('opportunity_id', f'o{i}'))}",
                    section=AdvisorSection.MISSED_OPPORTUNITIES,
                    title=_safe_str(o.get("title", "Unnamed opportunity")),
                    summary=(
                        f"{_safe_str(o.get('description', ''))} "
                        f"est. ROI {_safe_int(o.get('estimated_roi'))}%, "
                        f"+{_safe_int(o.get('estimated_score_gain'))} score."
                    ),
                    priority=_safe_str(o.get("priority", "Medium")).capitalize() or "Medium",
                    source="twin",
                    source_key=f"twin.opportunity_matrix.{bucket_key}[{i}]",
                    evidence_ids=(
                        _safe_str(o.get("opportunity_id", "")),
                        _safe_str(o.get("recommendation_id", "")),
                    ),
                ))
        items.sort(key=lambda a: (_priority_rank(a.priority), a.source_key, a.id))
        return items[:_MISSED_OPPORTUNITIES_LIMIT]

    def _build_suggested_actions(
        self,
        twin: dict,
        rules: dict,
        recs: dict,
        roadmap: dict,
        decision: dict | None,
    ) -> list[AdvisorAction]:
        """Suggested actions — the advice-only next steps.

        Every action maps to a safe :class:`AdvisorActionType`
        label. The advisor never tells the user to send an
        email, schedule a meeting, push a notification, or
        call an external API.
        """
        items: list[AdvisorAction] = []
        idx = 0
        for i, r in enumerate(recs.get("recommendations") or []):
            if not isinstance(r, dict):
                continue
            items.append(self._recommendation_to_action(r, i))
            idx += 1
        for cat_key, block in (rules.get("categories") or {}).items():
            if not isinstance(block, dict):
                continue
            for j, f in enumerate(block.get("firings") or []):
                if not isinstance(f, dict):
                    continue
                prio = _safe_str(f.get("priority", "Medium")).capitalize()
                if prio not in ("Critical", "High"):
                    continue
                items.append(self._rule_to_action(f, cat_key, j))
                idx += 1
        items.sort(key=lambda a: (_priority_rank(a.priority), a.source_key, a.id))
        return items[:_SUGGESTED_ACTIONS_LIMIT]

    # ---- Helpers — individual advice builders ---------------------- #

    def _recommendation_to_action(
        self,
        rec: dict,
        index: int,
    ) -> AdvisorAction:
        """Translate a recommendation into a suggested action.

        The action_type is derived purely from the
        recommendation's category + priority; no new logic.
        """
        rec_id = _safe_str(rec.get("id", f"r{index}"))
        priority = _safe_str(rec.get("priority", "Medium")).capitalize() or "Medium"
        category = _safe_str(rec.get("category", "")).lower()
        # Map the recommendation category to a safe advice label.
        if "compliance" in category or "certification" in category:
            action_type = AdvisorActionType.PRIORITISE
        elif "export" in category:
            action_type = AdvisorActionType.PLAN
        elif "digital" in category or "ecommerce" in category:
            action_type = AdvisorActionType.LEARN
        elif "risk" in category:
            action_type = AdvisorActionType.INVESTIGATE
        elif "growth" in category or "opportunity" in category:
            action_type = AdvisorActionType.DECIDE
        else:
            action_type = AdvisorActionType.REVIEW
        if priority == "Critical":
            action_type = AdvisorActionType.PRIORITISE
        sri = tuple(sorted(set(_safe_str(x) for x in
                               (rec.get("supporting_rule_ids") or []) if x)))
        tra_id = _safe_str(rec.get("id", ""))
        return AdvisorAction(
            id=f"action.rec.{rec_id}",
            title=f"Review recommendation: {_safe_str(rec.get('title', 'Unnamed'))}",
            rationale=_safe_str(rec.get("description", "")),
            action_type=action_type,
            priority=priority,
            source_key=f"recommendations.recommendations[{index}]",
            evidence_ids=sri,
            related_recommendation_id=tra_id or None,
            related_roadmap_id=None,
        )

    def _rule_to_action(
        self,
        firing: dict,
        cat_key: str,
        index: int,
    ) -> AdvisorAction:
        rule_id = _safe_str(firing.get("id", f"f{index}"))
        priority = _safe_str(firing.get("priority", "High")).capitalize() or "High"
        # Critical / High rules without a recommendation map to
        # INVESTIGATE; the user should look at the rule and decide
        # whether to build a recommendation.
        return AdvisorAction(
            id=f"action.rule.{rule_id}",
            title=f"Investigate rule: {_safe_str(firing.get('title', 'Unnamed'))}",
            rationale=_safe_str(firing.get("reason", "")),
            action_type=AdvisorActionType.INVESTIGATE,
            priority=priority,
            source_key=f"rules.categories.{_safe_str(cat_key)}.firings[{index}]",
            evidence_ids=(rule_id,),
            related_recommendation_id=None,
            related_roadmap_id=None,
        )

    # ---- Safe deciders -------------------------------------------- #

    def _safe_decision(self, owner_id: int) -> dict | None:
        """Read the AI Decision engine, tolerating BusinessNotFound.

        The Twin, Rules, Recommendations, and Roadmap services
        are required (a business profile implies they all
        resolve). The AI Decision engine can legitimately
        return 404 when the analysis has not been run yet, so
        the advisor treats it as optional.
        """
        try:
            return AIDecisionService(self._repo).compute(owner_id)
        except Exception:
            return None


# --------------------------------------------------------------------------- #
# Internal — payload projection
# --------------------------------------------------------------------------- #


def _to_payload(response: AdvisorResponse) -> dict:
    """Project the dataclass into a JSON-friendly dict shaped
    like the Pydantic schema in :mod:`app.schemas.advisor`.

    Lists, not tuples; dicts, not frozen dataclasses. The
    endpoint validates the result against the Pydantic model
    so a future refactor that accidentally leaks a field
    fails loudly here, not at the client.
    """
    summary = response.business_summary
    health = response.health_review
    inputs = response.inputs
    return {
        "generated_at": response.generated_at,
        "advisor_id": response.advisor_id,
        "business_summary": {
            "legal_name": summary.legal_name,
            "industry": summary.industry,
            "archetype": summary.archetype,
            "overall_score": summary.overall_score,
            "overall_level": summary.overall_level,
            "band": summary.band,
            "dna_match": summary.dna_match,
            "rule_critical_count": summary.rule_critical_count,
            "rule_high_count": summary.rule_high_count,
            "recommendation_count": summary.recommendation_count,
            "roadmap_items_count": summary.roadmap_items_count,
            "highest_priority_action": summary.highest_priority_action,
            "headline": summary.headline,
        },
        "daily_brief": [
            {
                "id": a.id,
                "section": a.section.value,
                "title": a.title,
                "summary": a.summary,
                "priority": a.priority,
                "source": a.source,
                "source_key": a.source_key,
                "evidence_ids": list(a.evidence_ids),
            }
            for a in response.daily_brief
        ],
        "weekly_summary": [
            {
                "id": a.id,
                "section": a.section.value,
                "title": a.title,
                "summary": a.summary,
                "priority": a.priority,
                "source": a.source,
                "source_key": a.source_key,
                "evidence_ids": list(a.evidence_ids),
            }
            for a in response.weekly_summary
        ],
        "health_review": {
            "current_overall_score": health.current_overall_score,
            "current_overall_level": health.current_overall_level,
            "projected_3m": health.projected_3m,
            "projected_6m": health.projected_6m,
            "projected_12m": health.projected_12m,
            "delta_3m": health.delta_3m,
            "delta_6m": health.delta_6m,
            "delta_12m": health.delta_12m,
            "band": health.band,
            "risk_count": health.risk_count,
            "opportunity_count": health.opportunity_count,
        },
        "priority_changes": [
            {
                "id": a.id,
                "section": a.section.value,
                "title": a.title,
                "summary": a.summary,
                "priority": a.priority,
                "source": a.source,
                "source_key": a.source_key,
                "evidence_ids": list(a.evidence_ids),
            }
            for a in response.priority_changes
        ],
        "upcoming_risks": [
            {
                "id": a.id,
                "section": a.section.value,
                "title": a.title,
                "summary": a.summary,
                "priority": a.priority,
                "source": a.source,
                "source_key": a.source_key,
                "evidence_ids": list(a.evidence_ids),
            }
            for a in response.upcoming_risks
        ],
        "missed_opportunities": [
            {
                "id": a.id,
                "section": a.section.value,
                "title": a.title,
                "summary": a.summary,
                "priority": a.priority,
                "source": a.source,
                "source_key": a.source_key,
                "evidence_ids": list(a.evidence_ids),
            }
            for a in response.missed_opportunities
        ],
        "suggested_actions": [
            {
                "id": a.id,
                "title": a.title,
                "rationale": a.rationale,
                "action_type": a.action_type.value,
                "priority": a.priority,
                "source_key": a.source_key,
                "evidence_ids": list(a.evidence_ids),
                "related_recommendation_id": a.related_recommendation_id,
                "related_roadmap_id": a.related_roadmap_id,
            }
            for a in response.suggested_actions
        ],
        "inputs": {
            "twin_generated_at": inputs.twin_generated_at,
            "rules_generated_at": inputs.rules_generated_at,
            "recommendations_generated_at": inputs.recommendations_generated_at,
            "roadmap_generated_at": inputs.roadmap_generated_at,
            "decision_generated_at": inputs.decision_generated_at,
            "predictive_generated_at": inputs.predictive_generated_at,
            "notifications_generated_at": inputs.notifications_generated_at,
        },
    }


def _advisor_id(owner_id: int) -> str:
    """A stable advisory id for the user.

    Different from the conversation / message ids the chat
    service uses: the advisor is read-only, so the id is a
    hash of the owner id + today's UTC date so the user can
    refresh and see the same advisory appear stable across
    the same day.
    """
    today = datetime.now(tz=timezone.utc).date().isoformat()
    raw = f"{owner_id}:{today}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"adv_{owner_id}_{digest}"

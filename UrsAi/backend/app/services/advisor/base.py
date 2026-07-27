"""Shared types for the Autonomous Business Advisor (Sprint 7 Part 5).

This module is narrow:

  * :class:`AdvisorSection`        — the seven spec sections.
  * :class:`AdvisorActionType`     — the safe action types the advisor
    may suggest. Any addition must NOT be a code path that executes
    side-effects (no email, push, schedule, webhook, etc.).
  * :class:`AdvisorAdvice`         — a single piece of advice the
    advisor emits.
  * :class:`AdvisorAction`         — a single suggested action.
  * :class:`AdvisorBusinessSummary` — the deterministic one-paragraph
    snapshot of the business.
  * :class:`AdvisorHealthReview`   — the daily health check.
  * :class:`AdvisorInputs`         — the upstream sidecar.
  * :class:`AdvisorResponse`       — the full envelope.

Everything is a frozen dataclass. The Advisor layer is read-only —
it never mutates the business, never writes to the database, never
calls an external API. The action types are descriptive labels, not
executable handles.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


# --------------------------------------------------------------------------- #
# Sections — the seven spec surfaces.
# --------------------------------------------------------------------------- #


class AdvisorSection(str, Enum):
    """The seven advisor sections the brief names.

    The mapping is intentionally 1:1 with the brief's bullet list
    so the frontend can index the response by section name.
    """

    DAILY_BRIEF = "daily_brief"
    WEEKLY_SUMMARY = "weekly_summary"
    HEALTH_REVIEW = "health_review"
    PRIORITY_CHANGES = "priority_changes"
    UPCOMING_RISKS = "upcoming_risks"
    MISSED_OPPORTUNITIES = "missed_opportunities"
    SUGGESTED_ACTIONS = "suggested_actions"


# --------------------------------------------------------------------------- #
# Action types — advice-only labels.
# --------------------------------------------------------------------------- #


class AdvisorActionType(str, Enum):
    """The safe action types an advisor may suggest.

    Every label is **descriptive** — the advisor reports what the
    user could do, never the code path that would do it. None of
    these values maps to an executor. The frontend treats them as
    badge copy, not as a switch on a dispatcher.
    """

    REVIEW = "review"
    PRIORITISE = "prioritise"
    DECIDE = "decide"
    INVESTIGATE = "investigate"
    PLAN = "plan"
    LEARN = "learn"
    MONITOR = "monitor"
    REFRESH = "refresh"


# --------------------------------------------------------------------------- #
# Priority + severity enums (sound-only variants the rest of the
# project already uses, so the response shape composes with the UI).
# --------------------------------------------------------------------------- #


AdvisorPriority = Literal["Critical", "High", "Medium", "Low"]
AdvisorSeverity = Literal["Critical", "High", "Medium", "Low"]


# --------------------------------------------------------------------------- #
# Pieces — a single advice, a single suggested action, the
# deterministic summary, the health review, the inputs sidecar.
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AdvisorAdvice:
    """A single piece of advice the advisor emits.

    ``source_key`` is a stable pointer back to the upstream field
    that produced this advice. The frontend uses it to deep-link
    to the matching engine page.

    ``evidence_ids`` is the list of upstream ids (rule_id,
    recommendation_id, roadmap_id, insight_id, twin risk id, ...)
    that the advisor joined in producing this advice. The list
    is sorted ascending and deduped — the surface is deterministic.
    """

    id: str
    section: AdvisorSection
    title: str
    summary: str
    priority: AdvisorPriority
    source: str  # "rules" | "recommendations" | "roadmap" | "twin" | "decision"
    source_key: str
    evidence_ids: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class AdvisorAction:
    """A single suggested action the user could take.

    ``action_type`` is one of the safe :class:`AdvisorActionType`
    values. The advisor never tells the user to send an email,
    schedule a meeting, push a notification, or call an external
    API — it only suggests the type of *thinking* the user
    should do next.
    """

    id: str
    title: str
    rationale: str
    action_type: AdvisorActionType
    priority: AdvisorPriority
    source_key: str
    evidence_ids: tuple[str, ...] = field(default_factory=tuple)
    related_recommendation_id: str | None = None
    related_roadmap_id: str | None = None


@dataclass(frozen=True)
class AdvisorBusinessSummary:
    """The deterministic one-paragraph snapshot of the business.

    Every field is a stable projection of the existing upstream
    payloads. The advisor does NOT write or compute a new value
    here — it surfaces what Twin + Recommendations + Roadmap already
    said, joined deterministically.
    """

    legal_name: str
    industry: str
    archetype: str
    overall_score: int
    overall_level: str
    band: str
    dna_match: int
    rule_critical_count: int
    rule_high_count: int
    recommendation_count: int
    roadmap_items_count: int
    highest_priority_action: str
    headline: str


@dataclass(frozen=True)
class AdvisorHealthReview:
    """Today's health check.

    The advisor pulls the four projection points from the existing
    Twin timeline (the same payload the Sprint 6 Part 5 Predictive
    Analytics page consumes) and surfaces them as forward-looking
    health indicators. No new numeric value is computed — the
    timeline is the source of truth.
    """

    current_overall_score: int
    current_overall_level: str
    projected_3m: int
    projected_6m: int
    projected_12m: int
    delta_3m: int
    delta_6m: int
    delta_12m: int
    band: str
    # Risk + opportunity counts come from the Twin risk and
    # opportunity matrices (the same matrices the notifications
    # page surfaces).
    risk_count: int
    opportunity_count: int


@dataclass(frozen=True)
class AdvisorInputs:
    """The upstream sidecar the advisor echoes.

    Every field is the ``generated_at`` of the upstream payload
    the advisor consumed. The verifier uses this sidecar to
    prove the advisor did not bypass the existing engines.
    """

    twin_generated_at: str | None = None
    rules_generated_at: str | None = None
    recommendations_generated_at: str | None = None
    roadmap_generated_at: str | None = None
    decision_generated_at: str | None = None
    # Sprint 6 Part 5 (Predictive Analytics) and Sprint 6 Part 4
    # (Notifications) are derived views. The advisor notes the
    # timestamps so the verifier can confirm the projections
    # surfaced are the same ones the predictive-analytics page
    # would render.
    predictive_generated_at: str | None = None
    notifications_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Envelope
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AdvisorResponse:
    """The full envelope the endpoint returns.

    The response is read-only. The advisor never changes the
    business, never writes a record, never schedules a job.
    """

    generated_at: str
    advisor_id: str
    business_summary: AdvisorBusinessSummary
    daily_brief: tuple[AdvisorAdvice, ...]
    weekly_summary: tuple[AdvisorAdvice, ...]
    health_review: AdvisorHealthReview
    priority_changes: tuple[AdvisorAdvice, ...]
    upcoming_risks: tuple[AdvisorAdvice, ...]
    missed_opportunities: tuple[AdvisorAdvice, ...]
    suggested_actions: tuple[AdvisorAction, ...]
    inputs: AdvisorInputs

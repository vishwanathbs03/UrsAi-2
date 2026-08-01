"""Autonomous Business Advisor — Sprint 7 Part 5.

The advisor is a read-only aggregator over the existing
five upstream payloads (Twin, Rules, Recommendations,
Roadmap, AI Decision / Insights). It surfaces deterministic
advice into seven sections:

  * daily_brief          — what to look at today
  * weekly_summary       — the broader outlook
  * health_review        — current + forward projections
  * priority_changes     — items that need re-prioritising
  * upcoming_risks       — forward-looking risk signals
  * missed_opportunities — opportunities the user has not yet
                            picked up
  * suggested_actions    — advice-only next steps

The advisor never executes actions, never sends emails,
never pushes notifications, never schedules jobs, never
calls external APIs, never mutates the Business profile.

See :mod:`app.services.advisor.service` for the façade.
"""
from app.services.advisor.base import (
    AdvisorAction,
    AdvisorActionType,
    AdvisorAdvice,
    AdvisorBusinessSummary,
    AdvisorHealthReview,
    AdvisorInputs,
    AdvisorResponse,
    AdvisorSection,
    AdvisorPriority,
    AdvisorSeverity,
)
from app.services.advisor.service import AdvisorService


__all__ = [
    "AdvisorAction",
    "AdvisorActionType",
    "AdvisorAdvice",
    "AdvisorBusinessSummary",
    "AdvisorHealthReview",
    "AdvisorInputs",
    "AdvisorPriority",
    "AdvisorResponse",
    "AdvisorSection",
    "AdvisorSeverity",
    "AdvisorService",
]

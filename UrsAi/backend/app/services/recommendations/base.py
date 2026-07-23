"""Shared types for the Recommendation Intelligence Engine.

The service layer operates on plain dataclasses; the Pydantic
schema in :mod:`app.schemas.recommendation` is the API
boundary only. The split keeps the helper modules
(``priorities``, ``roi``, ``timeline``, ``dependencies``,
``impact``, ``generator``) free of FastAPI / Pydantic
imports so they can be unit-tested without an app context.

Two key invariants the dataclass preserves:

  * **Determinism.** Every field has a single derivation rule
    documented at the point it's set. The dataclass carries
    no timestamps or session state.
  * **Traceability.** Every cross-reference (rule id,
    article id, score key, intelligence key, dependency id)
    traces back to a specific upstream signal so the UI can
    render "Why this recommendation?" tooltips without
    re-running the engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# --------------------------------------------------------------------------- #
# Enums (mirror the Pydantic schema)
# --------------------------------------------------------------------------- #


Category = Literal[
    "immediate_actions",
    "high_priority",
    "medium_priority",
    "long_term",
    "risk_alerts",
    "compliance_actions",
    "export_readiness_actions",
    "digital_transformation_actions",
]

Priority = Literal["Critical", "High", "Medium", "Low"]

Phase = Literal[
    "Immediate",
    "Short-Term",
    "Medium-Term",
    "Long-Term",
]

Difficulty = Literal["Easy", "Moderate", "Hard", "Expert"]

Status = Literal["planned"]


# --------------------------------------------------------------------------- #
# Building blocks
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RuleSnapshot:
    """The subset of a :class:`RuleFiring` that the
    Recommendation Engine actually consumes. Defined here so
    the helpers do not import the rule-engine module — the
    generator does the conversion in one place.

    All fields are plain values; no ORM, no session, no
    cross-references to mutable state.
    """

    id: str
    title: str
    description: str
    category: Category
    priority: Priority
    reason: str
    source_keys: tuple[str, ...]
    estimated_impact: int


@dataclass(frozen=True)
class KnowledgeMatch:
    """A knowledge article that this recommendation should
    reference. The :mod:`dependencies` helper picks these by
    intersecting the rule's source keys with the article's
    related_score_keys / related_intelligence_keys.
    """

    id: str
    title: str
    related_score_keys: tuple[str, ...]
    related_intelligence_keys: tuple[str, ...]


# --------------------------------------------------------------------------- #
# Recommendation — internal dataclass
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Recommendation:
    """One structured recommendation, computed by the engine.

    The dataclass is the single source of truth within the
    service layer. :class:`app.schemas.recommendation.RecommendationOut`
    is the API projection; the conversion happens in
    :mod:`app.services.recommendations.service`.

    Every numeric field carries a derivation rule inline —
    the helper module that produces it documents the math
    so the next agent can adjust the heuristic without
    hunting through the codebase.
    """

    # Identity & title
    id: str
    title: str
    description: str

    # Categorisation
    category: Category
    priority: Priority
    phase: Phase

    # Quantitative estimates
    business_impact: int
    estimated_score_gain: float
    estimated_roi: int
    estimated_cost: int
    estimated_timeline: str
    difficulty: Difficulty
    confidence: int

    # Cross-references
    dependencies: tuple[str, ...] = ()
    supporting_rule_ids: tuple[str, ...] = ()
    supporting_article_ids: tuple[str, ...] = ()
    related_score_keys: tuple[str, ...] = ()
    related_intelligence_keys: tuple[str, ...] = ()

    # Narrative
    projected_dna_effect: str = ""

    # Operational state — always "planned" on first read.
    status: Status = "planned"

    def to_payload(self) -> dict:
        """Project the dataclass into a JSON-friendly dict
        shaped like the Pydantic schema (lists, not tuples)."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "priority": self.priority,
            "phase": self.phase,
            "business_impact": self.business_impact,
            "estimated_score_gain": self.estimated_score_gain,
            "estimated_roi": self.estimated_roi,
            "estimated_cost": self.estimated_cost,
            "estimated_timeline": self.estimated_timeline,
            "difficulty": self.difficulty,
            "confidence": self.confidence,
            "dependencies": list(self.dependencies),
            "supporting_rule_ids": list(self.supporting_rule_ids),
            "supporting_article_ids": list(self.supporting_article_ids),
            "related_score_keys": list(self.related_score_keys),
            "related_intelligence_keys": list(self.related_intelligence_keys),
            "projected_dna_effect": self.projected_dna_effect,
            "status": self.status,
        }


# --------------------------------------------------------------------------- #
# Public container
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RecommendationBundle:
    """The engine's output: a list of recommendations plus the
    summary rollup. Computed once per request and returned to
    the caller."""

    recommendations: tuple[Recommendation, ...] = field(default_factory=tuple)
    knowledge_total_articles: int = 0

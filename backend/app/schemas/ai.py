"""Pydantic schemas for the AI Decision Engine.

Every model has ``extra="forbid"`` so accidental field additions
break loudly at the API boundary. The shape mirrors the dataclasses
in :mod:`app.services.ai.base` but is its own contract — the
service translates between the two so the dataclasses can stay
plain-Python and free of FastAPI / Pydantic coupling.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Context echo
# --------------------------------------------------------------------------- #


class AIScoreOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    score: int
    level: str


class AIRuleOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    category: str
    priority: str
    estimated_impact: int = Field(ge=0, le=100)
    reason: str


class AIKnowledgeOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    topic: str
    category: str
    summary: str
    relevance: int = Field(ge=0, le=100)


class AIArchetypeOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    match_score: int = Field(ge=0, le=100)


class AIContextOut(BaseModel):
    """Echo of the inputs the decision was generated from."""

    model_config = ConfigDict(extra="forbid")

    business_id: int
    archetype: AIArchetypeOut
    intelligence_overall: int = Field(ge=0, le=100)
    scores: list[AIScoreOut] = Field(default_factory=list)
    rules: list[AIRuleOut] = Field(default_factory=list)
    knowledge: list[AIKnowledgeOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Decision
# --------------------------------------------------------------------------- #


class AIInsightOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    explanation: str
    category: str
    priority: str
    confidence: int = Field(ge=0, le=100)
    supporting_rule_ids: list[str] = Field(default_factory=list)
    supporting_article_ids: list[str] = Field(default_factory=list)


class AIDecisionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    archetype_label: str
    overall_health: str
    top_strengths: list[str] = Field(default_factory=list)
    top_risks: list[str] = Field(default_factory=list)
    insights: list[AIInsightOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Inputs sidecar
# --------------------------------------------------------------------------- #


class AIInputsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None
    rules_generated_at: str | None = None
    model: str


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class AIDecisionResponse(BaseModel):
    """Returned by ``GET /business/decision``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    inputs: AIInputsOut
    context: AIContextOut
    decision: AIDecisionOut

"""Pydantic schemas for the Business Intelligence Engine.

The response is intentionally small and stable: a top-level
``overall`` rollup plus a list of analyzer payloads, each of which
exposes the same five fields (score, level, summary, breakdown,
missing). This uniformity lets the frontend render every lens
with a single component.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Per-analyzer shape
# --------------------------------------------------------------------------- #


Level = Literal["low", "medium", "high"]


class ScoreBreakdownItem(BaseModel):
    """One line in an analyzer's breakdown.

    ``weight`` is the maximum this line could have earned;
    ``earned`` is what it did earn. ``present`` records whether
    the underlying data exists at all (the analyzer may still
    award partial credit even when the data is present).
    """

    model_config = ConfigDict(extra="forbid")

    key: str
    label: str
    weight: int = Field(ge=0, le=100)
    earned: int = Field(ge=0, le=100)
    present: bool
    hint: str | None = None


class AnalyzerPayload(BaseModel):
    """One analyzer's contribution to the overall intelligence report."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    score: int = Field(ge=0, le=100)
    level: Level
    summary: str
    breakdown: list[ScoreBreakdownItem] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Overall
# --------------------------------------------------------------------------- #


class OverallPayload(BaseModel):
    """Top-level rollup across every analyzer."""

    model_config = ConfigDict(extra="forbid")

    score: int = Field(ge=0, le=100)
    level: Level
    analyzer_count: int = Field(ge=0)


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


from app.schemas.benchmark import BenchmarkReport
from app.schemas.dna import DNAPayload
from app.schemas.opportunity import OpportunityReport
from app.schemas.readiness import ReadinessReport
from app.schemas.swot import SWOTReport


class BusinessIntelligenceResponse(BaseModel):
    """Returned by ``GET /business/intelligence``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    overall: OverallPayload
    analyzers: list[AnalyzerPayload]
    dna: DNAPayload | None = None
    swot: SWOTReport | None = None
    readiness: ReadinessReport | None = None
    benchmark: BenchmarkReport | None = None
    opportunities: OpportunityReport | None = None

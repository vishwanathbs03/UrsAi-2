"""Pydantic schemas for the Business Score Engine.

The response is intentionally small and stable: a top-level
``summary`` rollup plus a list of score payloads, each of which
exposes the same five fields (score, level, explanation,
contributing_factors, title). This uniformity lets the frontend
render every score with a single component — the same component
the intelligence engine's lenses use.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Per-score shape
# --------------------------------------------------------------------------- #


Level = Literal["Low", "Medium", "High", "Excellent"]


class ContributingFactorOut(BaseModel):
    """One line in a score's ``contributing_factors`` list.

    ``impact`` is one of ``"positive"`` / ``"negative"`` /
    ``"neutral"`` and tells the UI how to colour-code the row.
    ``weight`` is the raw point contribution of this signal to
    the score (already weighted — the headline ``score`` is the
    precomputed sum).
    ``source_key`` traces the factor back to a breakdown key in
    the underlying intelligence analyzer so the UI can deep-link
    the user back to the relevant business section.
    """

    model_config = ConfigDict(extra="forbid")

    label: str
    impact: Literal["positive", "negative", "neutral"]
    weight: int = Field(ge=0, le=100)
    source_key: str
    detail: str | None = None


class ScorePayload(BaseModel):
    """One score's contribution to the response."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    score: int = Field(ge=0, le=100)
    level: Level
    explanation: str
    contributing_factors: list[ContributingFactorOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #


class BandDistribution(BaseModel):
    """How many of the eight scores fall into each band.

    Lets the UI render a small distribution bar next to the
    headline score without iterating the score list on every
    re-render.
    """

    model_config = ConfigDict(extra="forbid")

    Low: int = Field(ge=0, default=0)
    Medium: int = Field(ge=0, default=0)
    High: int = Field(ge=0, default=0)
    Excellent: int = Field(ge=0, default=0)


class SummaryPayload(BaseModel):
    """Top-level rollup across every score."""

    model_config = ConfigDict(extra="forbid")

    score: int = Field(ge=0, le=100)
    level: Level
    weighted_inputs: int = Field(ge=0)
    band_distribution: BandDistribution


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class BusinessScoresResponse(BaseModel):
    """Returned by ``GET /business/scores``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    summary: SummaryPayload
    scores: list[ScorePayload]

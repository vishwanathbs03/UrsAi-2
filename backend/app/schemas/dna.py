"""Pydantic schemas for the Business DNA Engine.

The response is intentionally small and stable. The UI renders
the entire DNA as a single page, so the API returns one
``BusinessDNAResponse`` envelope and lets the client pick which
sections to render.

Every primitive (rationale, finding, archetype, trait) is a
small Pydantic model with ``extra="forbid"`` so accidental
field additions break loudly at the API boundary instead of
silently being added to the response.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Primitives
# --------------------------------------------------------------------------- #


Severity = Literal["info", "low", "medium", "high"]
Impact = Literal["positive", "negative", "neutral"]


class RationaleOut(BaseModel):
    """One line in a DNA field's reasoning trace."""

    model_config = ConfigDict(extra="forbid")

    claim: str
    signal: str
    source_key: str | None = None


class RunnerUpOut(BaseModel):
    """The second-place archetype, so the UI can show how
    decisive the primary match was."""

    model_config = ConfigDict(extra="forbid")

    key: str
    match_score: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# DNA field shapes
# --------------------------------------------------------------------------- #


class ArchetypeOut(BaseModel):
    """The primary archetype assigned to the business."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    description: str
    match_score: int = Field(ge=0, le=100)
    rationale: list[RationaleOut] = Field(default_factory=list)
    runner_up: RunnerUpOut | None = None


class SecondaryTraitOut(BaseModel):
    """A named secondary trait."""

    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    present: bool
    strength: int = Field(ge=0, le=100)
    rationale: list[RationaleOut] = Field(default_factory=list)


class FindingOut(BaseModel):
    """A single line in strengths / weaknesses / opportunities / risks."""

    model_config = ConfigDict(extra="forbid")

    title: str
    detail: str
    severity: Severity = "info"
    source_key: str | None = None


class BusinessDNAData(BaseModel):
    """Deterministic Business DNA profile (Sprint 11.1)."""

    model_config = ConfigDict(extra="forbid")

    business_stage: str = Field(..., description="Stage of business development")
    digital_maturity: str = Field(..., description="Level of digital adoption")
    operational_complexity: str = Field(..., description="Degree of operational complexity")
    growth_potential: str = Field(..., description="Evaluated growth potential")
    market_position: str = Field(..., description="Market coverage and positioning")
    automation_level: str = Field(..., description="Degree of automated workflows")
    risk_profile: str = Field(..., description="Overall risk assessment")
    overall_dna: str = Field(..., description="Primary DNA archetype classification")


# --------------------------------------------------------------------------- #
# DNA payload
# --------------------------------------------------------------------------- #


class DNAPayload(BaseModel):
    """The DNA profile itself, nested inside the response envelope."""

    model_config = ConfigDict(extra="forbid")

    archetype: ArchetypeOut
    secondary_traits: list[SecondaryTraitOut] = Field(default_factory=list)
    strengths: list[FindingOut] = Field(default_factory=list)
    weaknesses: list[FindingOut] = Field(default_factory=list)
    opportunities: list[FindingOut] = Field(default_factory=list)
    risk_areas: list[FindingOut] = Field(default_factory=list)
    confidence: int = Field(ge=0, le=100)
    confidence_rationale: list[RationaleOut] = Field(default_factory=list)
    business_dna: BusinessDNAData | None = None


# --------------------------------------------------------------------------- #
# Inputs sidecar
# --------------------------------------------------------------------------- #


class DNAInputsOut(BaseModel):
    """Echo of the input generation timestamps, so the UI can
    show "DNA last computed at X (intelligence Y, scores Z)".
    Reproducibility is the point: if any of these drift between
    the inputs, the DNA can be recomputed deterministically."""

    model_config = ConfigDict(extra="forbid")

    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class BusinessDNAResponse(BaseModel):
    """Returned by ``GET /business/dna``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    inputs: DNAInputsOut
    dna: DNAPayload

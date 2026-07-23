"""Pydantic schemas for the Rule Engine.

The response is grouped by the 8 spec categories. The UI
renders the eight category cards in the order the spec
defines, so the API returns the categories in a fixed order
via a typed list field.

Every primitive (firing, summary, per-category block) is a
small Pydantic model with ``extra="forbid"`` so accidental
field additions break loudly at the API boundary.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Enums
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


# --------------------------------------------------------------------------- #
# Primitives
# --------------------------------------------------------------------------- #


class RuleFiringOut(BaseModel):
    """A single rule firing — one element of the response.

    ``estimated_impact`` is a deterministic 0..100 function of
    the gap size and the rule weight (see
    :class:`app.services.rules.base.RuleDef`). It is NOT a
    marketing claim; it is a unitless severity number.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    category: Category
    priority: Priority
    reason: str
    source_keys: list[str] = Field(default_factory=list)
    estimated_impact: int = Field(ge=0, le=100)


class CategoryBlockOut(BaseModel):
    """One category's contribution to the response."""

    model_config = ConfigDict(extra="forbid")

    firing_count: int = Field(ge=0)
    rules_evaluated: int = Field(ge=0)
    firings: list[RuleFiringOut] = Field(default_factory=list)


class SummaryOut(BaseModel):
    """Top-level rollup across all eight categories."""

    model_config = ConfigDict(extra="forbid")

    total_firings: int = Field(ge=0)
    categories_with_firings: int = Field(ge=0, le=8)
    categories_evaluated: int = Field(ge=0, le=8)
    total_estimated_impact: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Inputs sidecar
# --------------------------------------------------------------------------- #


class RulesInputsOut(BaseModel):
    """Echo of the three input generation timestamps so the UI
    can show "Rules last computed at X (intelligence Y, scores
    Z, DNA W)". Reproducibility is the point."""

    model_config = ConfigDict(extra="forbid")

    intelligence_generated_at: str | None = None
    scores_generated_at: str | None = None
    dna_generated_at: str | None = None


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class BusinessRulesResponse(BaseModel):
    """Returned by ``GET /business/rules``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    inputs: RulesInputsOut
    summary: SummaryOut
    # The eight category blocks, always present, in spec order.
    categories: dict[Category, CategoryBlockOut]

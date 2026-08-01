"""Pydantic v2 schemas for the Business Scenario Simulator.

The Scenario Engine is a *build-on-top* layer that simulates
business improvements without modifying the database. The
client sends a :class:`ScenarioRequest` (a list of
hypothetical changes); the server returns a
:class:`ScenarioResponse` (current vs projected snapshots,
delta analysis, and recommendation/roadmap impact).

Every model uses ``extra="forbid"`` so an unhandled code
path fails loudly at the API boundary.

Field name rationale
--------------------

The upstream engines' response shapes are the
authoritative source — the scenarios response is a
*projection* of those shapes, not a re-definition. The
Pydantic types are deliberately simple (no nested Literal
chains) so a frontend can render the diff with a single
JSON tree view.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Change primitives
# --------------------------------------------------------------------------- #


# The "type" discriminator the server uses to route the
# change to the right mutator. New change types are added
# here as the engine grows.
ChangeType = Literal[
    # Credentials
    "add_certification",
    # Web presence
    "add_website",
    "add_social_channels",
    "improve_digital_presence",
    # Production
    "increase_production_capacity",
    "increase_employee_count",
    # Export
    "enable_exports",
    "add_export_country",
    # Profile
    "complete_profile_fields",
]


class _ChangeBase(BaseModel):
    """Common fields every change carries.

    ``type`` is the discriminator the mutator uses to
    route. ``label`` is a free-form description the UI
    shows in the change list (and the response echoes
    back so the user can confirm what they simulated).
    """

    model_config = ConfigDict(extra="forbid")

    type: ChangeType
    label: str = Field(min_length=1, max_length=200)


class AddCertification(_ChangeBase):
    type: Literal["add_certification"] = "add_certification"
    name: str = Field(min_length=1, max_length=200)
    issuing_body: str | None = Field(default=None, max_length=200)


class AddWebsite(_ChangeBase):
    type: Literal["add_website"] = "add_website"
    url: str = Field(min_length=1, max_length=500)


class AddSocialChannels(_ChangeBase):
    type: Literal["add_social_channels"] = "add_social_channels"
    # The set of channels the user wants to add. The
    # mutator only flips empty ones — existing URLs are
    # left alone.
    channels: list[
        Literal["linkedin", "facebook", "instagram", "twitter", "youtube"]
    ] = Field(min_length=1)


class ImproveDigitalPresence(_ChangeBase):
    """A broad 'digitise' change that flips the
    e-commerce + digital marketing + cloud systems
    flags. The label is what the UI shows."""

    type: Literal["improve_digital_presence"] = "improve_digital_presence"
    enable_ecommerce: bool = True
    enable_digital_marketing: bool = True
    enable_cloud_systems: bool = True


class IncreaseProductionCapacity(_ChangeBase):
    type: Literal["increase_production_capacity"] = "increase_production_capacity"
    production_capacity: str = Field(min_length=1, max_length=500)
    production_capacity_unit: str = Field(min_length=1, max_length=50)
    capacity_utilization_pct: int | None = Field(default=None, ge=0, le=100)
    monthly_production_units: int | None = Field(default=None, ge=0)


class IncreaseEmployeeCount(_ChangeBase):
    type: Literal["increase_employee_count"] = "increase_employee_count"
    employee_count: int = Field(ge=0)


class EnableExports(_ChangeBase):
    """Set the IEC code on file (the gate-keeper for
    export readiness)."""

    type: Literal["enable_exports"] = "enable_exports"
    iec_number: str = Field(min_length=1, max_length=50)


class AddExportCountry(_ChangeBase):
    type: Literal["add_export_country"] = "add_export_country"
    destination_country: str = Field(min_length=2, max_length=100)
    product_category: str | None = Field(default=None, max_length=100)
    annual_export_value: float | None = Field(default=None, ge=0)


class CompleteProfileFields(_ChangeBase):
    """Generic 'fill in the blank profile fields' change
    that the business wizard exposes. The mutator fills
    the listed fields with sensible default values when
    they are currently empty; existing values are
    preserved."""

    type: Literal["complete_profile_fields"] = "complete_profile_fields"
    fields: list[
        Literal[
            "description",
            "country",
            "state_region",
            "city",
            "sub_industry",
            "business_type",
        ]
    ] = Field(min_length=1)


# The discriminated union the request body validates.
# Order matters only for the discriminator hint.
Change = Annotated[
    (
        AddCertification
        | AddWebsite
        | AddSocialChannels
        | ImproveDigitalPresence
        | IncreaseProductionCapacity
        | IncreaseEmployeeCount
        | EnableExports
        | AddExportCountry
        | CompleteProfileFields
    ),
    Field(discriminator="type"),
]


# --------------------------------------------------------------------------- #
# Request body
# --------------------------------------------------------------------------- #


class ScenarioRequest(BaseModel):
    """The body of ``POST /api/v1/business/scenario``.

    The ``changes`` list is the only required field. The
    server applies them in order, then runs the existing
    engines on the mutated clone.
    """

    model_config = ConfigDict(extra="forbid")

    changes: list[Change] = Field(min_length=1, max_length=20)


# --------------------------------------------------------------------------- #
# Snapshot block (current vs projected)
# --------------------------------------------------------------------------- #


class ScenarioSnapshotOut(BaseModel):
    """A minimal view of one business state. Mirrors the
    fields the spec names: overall score, profile
    completion, DNA match, and the four readiness lenses
    (export, digital, compliance, growth)."""

    model_config = ConfigDict(extra="forbid")

    overall_business_score: int = Field(ge=0, le=100)
    profile_completion: int = Field(ge=0, le=100)
    business_dna_match: int = Field(ge=0, le=100)
    business_dna_archetype: str
    export_readiness: int = Field(ge=0, le=100)
    digital_readiness: int = Field(ge=0, le=100)
    compliance_readiness: int = Field(ge=0, le=100)
    growth_readiness: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Delta block
# --------------------------------------------------------------------------- #


class ScenarioDeltaOut(BaseModel):
    """The diff between the current and projected
    snapshots. The spec calls out four deltas; we expose
    them as named integers with explicit deltas so the UI
    can render ``+12`` / ``-3`` chips without a round-
    trip."""

    model_config = ConfigDict(extra="forbid")

    score_difference: int
    readiness_difference: int  # average across the 4 lenses
    dna_difference: int
    profile_completion_difference: int

    # Per-lens deltas (the spec asks for *biggest
    # improvement*, *unchanged areas*, and *newly
    # unlocked opportunities* — the UI can derive those
    # from these four numbers plus the snapshots).
    export_readiness_difference: int
    digital_readiness_difference: int
    compliance_readiness_difference: int
    growth_readiness_difference: int

    # The biggest single improvement across the four
    # lenses, named so the UI does not have to compute
    # it. ``""`` when no readiness lens moved.
    biggest_improvement_lens: str
    biggest_improvement_value: int

    # Number of readiness lenses that did not move.
    unchanged_lenses: int

    # Number of readiness lenses that newly moved from
    # below the "low" band to at least the "medium"
    # band (or from medium to high, etc.). The UI
    # renders this as "Newly unlocked: N" chips.
    newly_unlocked_lenses: int


# --------------------------------------------------------------------------- #
# Recommendation / roadmap impact
# --------------------------------------------------------------------------- #


class ScenarioImpactOut(BaseModel):
    """How the existing recommendations and roadmap
    shift under the simulation. The engine re-runs the
    Recommendation Engine and Roadmap Engine on the
    projected clone and diffs the two sets against the
    current sets — no recommendation logic is
    duplicated."""

    model_config = ConfigDict(extra="forbid")

    # Recommendation IDs the projected clone no longer
    # produces (i.e. the hypothetical change resolves
    # them).
    resolved_recommendations: list[str]

    # Recommendation IDs that still apply after the
    # simulation. A resolved recommendation is
    # *removed* from the remaining set, so
    # ``remaining = current - resolved``.
    remaining_recommendations: list[str]

    # Roadmap item IDs that are newly *unlocked* by the
    # simulation — i.e. an item whose dependencies have
    # all been resolved by the change. The Roadmap
    # Engine already computes ``unlocks``; the scenario
    # engine diffs the projected graph against the
    # current graph and surfaces the new edges.
    newly_unlocked_roadmap_items: list[str]


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class ScenarioResponse(BaseModel):
    """Returned by ``POST /api/v1/business/scenario``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    current: ScenarioSnapshotOut
    projected: ScenarioSnapshotOut
    delta: ScenarioDeltaOut
    impact: ScenarioImpactOut

    # The labels of the changes the server actually
    # applied, in the order the request listed them.
    # Echoed so the UI can show "You simulated: ..."
    # without re-reading the request body.
    applied_changes: list[str]

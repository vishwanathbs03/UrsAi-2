"""Shared types for the OCR Review & Apply
Engine.

The Apply engine is the *write* counterpart
of the OCR engine. The OCR engine itself
stays read-only; the Apply engine is the
only place the OCR data flow becomes a
database write.

The pipeline is:

  OcrApplyRequest
        |
        v
  ApplyField list (the per-field plan)
        |
        v
  Validation pass
        |
        v
  Application pass (writes the Business
                     row; never overwrites
                     a valid existing value
                     with an invalid OCR
                     value)
        |
        v
  ApplyResult
        |
        v
  ApplyResponse (Pydantic projection)

The module exposes the internal types the
helpers pass around; the Pydantic models
in :mod:`app.schemas.ocr_apply` are the
API contract.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# The apply status the response surfaces.
APPLY_STATUS_APPLIED: str = "applied"
APPLY_STATUS_SKIPPED: str = "skipped"
APPLY_STATUS_REJECTED: str = "rejected"


@dataclass(frozen=True)
class ApplyField:
    """A single field the user submitted
    for review. The plan is the canonical
    intermediate representation between
    the request body and the database
    write."""

    field_name: str
    raw_value: str | None
    cleaned_value: str | None
    confidence: int
    upstream_validation_status: str | None
    user_approved: bool
    mapped_business_field: str | None

    @property
    def effective_value(self) -> str | None:
        """The value the apply engine should
        use: prefer the OCR-cleaned value
        when the upstream validator
        accepted it, else fall back to the
        raw value. The apply-time
        validator re-runs the format check
        on this value, so a downstream
        field that the upstream classified
        as "warning" can still be
        rejected at apply time."""
        if self.cleaned_value is not None:
            return self.cleaned_value
        return self.raw_value


@dataclass(frozen=True)
class ApplyChange:
    """The outcome of one field in the
    apply pass. The list of
    :class:`ApplyChange` records is the
    engine's response payload (rendered
    through Pydantic)."""

    field_name: str
    mapped_business_field: str | None
    old_value: str | None
    new_value: str | None
    confidence: int
    status: str  # "applied" | "skipped" | "rejected"
    reason: str


@dataclass(frozen=True)
class ApplySummary:
    applied: int
    skipped: int
    rejected: int
    updated_sections: tuple[str, ...]


# The set of Business Profile "sections"
# the spec calls out. A field maps to one
# of these sections; the summary's
# ``updated_sections`` lists the
# sections the engine actually modified.
SECTION_BASIC: str = "basic"
SECTION_CERTIFICATIONS: str = "certifications"

ALL_SECTIONS: tuple[str, ...] = (
    SECTION_BASIC,
    SECTION_CERTIFICATIONS,
)


# The spec's invariant: an *unknown*
# mapped_business_field is "the
# extraction was a field we do not
# know how to apply" — not an
# automatic rejection. The mapper
# returns ``None`` for unmapped
# fields; the applier treats that
# as a "skipped" with reason
# "field not mappable".
#
# The spec's *validators* (per
# format) are documented in
# :mod:`app.services.ocr.validators`
# (the OCR engine) and re-applied
# here in
# :mod:`app.services.ocr_apply.validator`.
# Re-using the OCR validators
# guarantees the apply-time check
# and the OCR-time check agree on
# what "valid" means.

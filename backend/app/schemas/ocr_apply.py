"""Pydantic v2 schemas for the OCR Review & Apply
Engine.

The Apply engine is the *write* counterpart of
the OCR engine: it accepts an OCR extraction
plus a per-field approval list, validates
each approved value, and writes the
approved-and-valid ones into the user's
Business Profile.

The OCR engine itself stays read-only. The
Apply engine is the only place the OCR data
flow becomes a database write.

Every model uses ``extra="forbid"`` so an
unhandled code path fails loudly at the API
boundary.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Request — the OCR fields the client just
# extracted, plus the per-field approval
# flags.
# --------------------------------------------------------------------------- #


class OcrApplyFieldIn(BaseModel):
    """One OCR field the client is asking
    the Apply engine to consider.

    ``value`` is the OCR-extracted value
    (verbatim). ``approved`` is the user's
    decision: True to apply, False to skip.
    The field is included in the response
    either way (the user wants to see what
    was approved / skipped / rejected)."""

    model_config = ConfigDict(extra="forbid")

    field: str = Field(min_length=1, max_length=100)
    value: str | None = None
    cleaned_value: str | None = None
    confidence: int = Field(ge=0, le=100, default=0)
    validation_status: str | None = None
    approved: bool = False


class OcrApplyRequest(BaseModel):
    """The body of ``POST /api/v1/business/ocr/apply``.

    The client sends the OCR fields it just
    received from ``POST /api/v1/business/ocr``
    (the engine does NOT re-run OCR) plus a
    per-field approval list. The ``extraction_id``
    is a logical id the client carries for its
    own audit log; the server does not look
    it up."""

    model_config = ConfigDict(extra="forbid")

    extraction_id: str | None = Field(
        default=None, max_length=200
    )
    fields: list[OcrApplyFieldIn] = Field(
        min_length=1, max_length=64
    )


# --------------------------------------------------------------------------- #
# Response
# --------------------------------------------------------------------------- #


ApplyStatus = Literal["applied", "skipped", "rejected"]


class OcrApplyChangeOut(BaseModel):
    """One per-field outcome in the apply
    response. The list is in the same
    order as the request's ``fields``
    list, so the client can match
    changes to its UI."""

    model_config = ConfigDict(extra="forbid")

    field_name: str
    mapped_business_field: str | None
    old_value: str | None
    new_value: str | None
    confidence: int = Field(ge=0, le=100)
    status: ApplyStatus
    reason: str


class OcrApplySummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    applied: int = Field(ge=0)
    skipped: int = Field(ge=0)
    rejected: int = Field(ge=0)
    updated_sections: list[str]


class OcrApplyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generated_at: str
    extraction_id: str | None
    summary: OcrApplySummaryOut
    changes: list[OcrApplyChangeOut]

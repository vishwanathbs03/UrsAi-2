"""Pydantic v2 schemas for the Intelligent Document Ingestion Engine
(OCR Foundation).

The engine is a *read-only* ingestion pipeline. It accepts an
uploaded document, runs the provider, extracts structured
business information, validates it, maps it to existing
Business Profile fields, and returns a review payload. The
Business Profile is *never* modified — the response is for
human review and approval.

The schemas below are the API contract. Every model uses
``extra="forbid"`` so an unhandled code path fails loudly at
the API boundary.

Field name rationale
--------------------

The 12 fields the spec names (Business Name, Owner Name,
GSTIN, PAN, IEC Number, Registration Number, Business
Type, Address, State, District, PIN Code, Year
Established) are the *extraction* keys. The mapper joins
each one to an existing Business Profile field. The Pydantic
model names the extraction keys verbatim so the spec's
field name contract is the API contract — the
``mapped_business_field`` value is a separate string that
points at the Business Profile field the extraction would
populate if the user approves.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Document type
# --------------------------------------------------------------------------- #


DocumentType = Literal[
    "gst_certificate",
    "udyam_certificate",
    "pan_card",
    "iec_certificate",
    "certificate_of_incorporation",
    "unknown",
]


# --------------------------------------------------------------------------- #
# Validation status (per field)
# --------------------------------------------------------------------------- #


ValidationStatus = Literal[
    "valid",
    "invalid",
    "warning",
    "unknown",
]


# --------------------------------------------------------------------------- #
# File upload (request shape)
# --------------------------------------------------------------------------- #


# The endpoint accepts multipart/form-data with a single
# "file" field. The file is parsed by FastAPI's
# UploadFile. The schema below is the *logical* request
# shape (we accept the file as bytes + filename +
# content_type from the UploadFile directly; the Pydantic
# model is not used in the request body because
# multipart/form-data is not JSON-parseable). The doc
# block is here so the spec's "request body contains"
# requirement is documented alongside the response.
#
# The endpoint *does* validate the file bytes / extension
# / size / empty-upload conditions before invoking the
# pipeline. Those validation errors surface as 4xx
# responses with a JSON body of the form
#   {"detail": "..."}
# matching the rest of Atlas AI's error contract.


# --------------------------------------------------------------------------- #
# Field extraction result
# --------------------------------------------------------------------------- #


class ExtractedFieldOut(BaseModel):
    """One extracted field.

    Every field carries:

      * ``field_name`` — the extraction key (one of the
        12 spec'd names).
      * ``value`` — the extracted value (string). The
        value is the OCR provider's output verbatim;
        the validator's pass-fail status is reported
        in ``validation_status`` and a cleaned version
        (e.g. stripped, normalised) is the same
        ``value`` field. The pipeline does *not* mutate
        ``value`` in place — the validator returns a
        separate ``cleaned_value`` (None when the
        validator was a no-op).
      * ``mapped_business_field`` — the Business
        Profile field this extraction would populate
        (None when the spec does not define a
        mapping for the field).
      * ``confidence`` — per-field confidence
        (0..100), produced by the confidence module.
      * ``validation_status`` — ``"valid"`` /
        ``"invalid"`` / ``"warning"`` / ``"unknown"``.
      * ``source_region`` — the (page, bbox) location
        the provider returned. The mock provider emits
        a synthetic region so the API shape is stable.
    """

    model_config = ConfigDict(extra="forbid")

    field_name: str
    value: str | None
    cleaned_value: str | None = None
    mapped_business_field: str | None = None
    confidence: int = Field(ge=0, le=100)
    validation_status: ValidationStatus
    source_region: dict | None = None


# --------------------------------------------------------------------------- #
# Review preview
# --------------------------------------------------------------------------- #


class OcrPreviewOut(BaseModel):
    """Compact summary block at the top of the
    response so the UI can render a one-line
    "We detected a GST Certificate for ACME
    Textiles, with 8 of 12 fields extractable"
    card before drilling into the full field
    list."""

    model_config = ConfigDict(extra="forbid")

    document_type_label: str
    business_name: str | None
    owner_name: str | None
    identifier_summary: str  # e.g. "GSTIN 33ABCDE... PAN ABCDE1234F"
    field_count: int
    valid_field_count: int
    overall_confidence: int = Field(ge=0, le=100)


# --------------------------------------------------------------------------- #
# Response envelope
# --------------------------------------------------------------------------- #


class OcrResponse(BaseModel):
    """Returned by ``POST /api/v1/business/ocr``."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    document_type: DocumentType

    # Confidence rollups.
    overall_confidence: int = Field(ge=0, le=100)
    document_confidence: int = Field(ge=0, le=100)

    # True when the user should review the
    # extraction before approving it. The rule is
    # deterministic: review_required is True when
    # *any* field has validation_status != "valid"
    # or when document_type is "unknown".
    review_required: bool

    # Validation warnings (e.g. "PIN code is
    # inconsistent with state" or "duplicate GSTIN
    # found on file"). The list is always present;
    # it is empty when the validator had no
    # warnings.
    warnings: list[str]

    # Compact summary card.
    preview: OcrPreviewOut

    # Per-field extraction results.
    fields: list[ExtractedFieldOut]

"""Document-type detection + per-field extraction.

This module is the *seam* between the provider's
raw output and the rest of the pipeline. The
provider returns a :class:`ProviderOutput` with a
``document_type`` string and a tuple of
:class:`ExtractedField` records. The extractors
module:

  1. Normalises the document_type literal (any
     string the provider emits is mapped to one
     of the schema's allowed values, or
     ``"unknown"``).
  2. Emits a *canonical* per-field list in a
     fixed order so the response is deterministic
     (the order is the same as the spec's
     enumeration).

The module is pure: same provider output, same
canonical output.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.ocr import DocumentType
from app.services.ocr.base import ExtractedField, ProviderOutput


# The spec's canonical field order. The
# extractors emit the fields in this order so
# the response is byte-deterministic across
# calls.
CANONICAL_FIELD_ORDER: tuple[str, ...] = (
    "business_name",
    "owner_name",
    "gstin",
    "pan",
    "iec_number",
    "registration_number",
    "business_type",
    "address",
    "state",
    "district",
    "pin_code",
    "year_established",
)


# Map every document type literal the
# provider might emit to the schema's
# allowed DocumentType values. The mock
# provider emits the schema's literals
# directly; this map is the safety net for
# any future provider that uses different
# names.
_PROVIDER_TO_SCHEMA_TYPE: dict[str, DocumentType] = {
    "gst_certificate": "gst_certificate",
    "udyam_certificate": "udyam_certificate",
    "pan_card": "pan_card",
    "iec_certificate": "iec_certificate",
    "certificate_of_incorporation": "certificate_of_incorporation",
    "unknown": "unknown",
}


@dataclass(frozen=True)
class CanonicalExtraction:
    """The extractors module's output — a
    normalised, ordered view of the provider's
    payload."""

    document_type: DocumentType
    fields: tuple[ExtractedField, ...] = field(default_factory=tuple)
    raw_text: str = ""


def extract(
    provider_output: ProviderOutput,
) -> CanonicalExtraction:
    """Normalise the provider's output into the
    pipeline's canonical shape.

    The function is pure: same provider output,
    same canonical extraction.
    """
    doc_type = _normalise_document_type(provider_output.document_type)
    fields = _reorder_fields(provider_output.fields)
    return CanonicalExtraction(
        document_type=doc_type,
        fields=fields,
        raw_text=provider_output.raw_text,
    )


def _normalise_document_type(value: str) -> DocumentType:
    """Map an arbitrary document_type string to
    one of the schema's allowed values. Unknown
    values fall back to ``"unknown"`` so the
    pipeline never raises on a novel provider
    literal."""
    if value in _PROVIDER_TO_SCHEMA_TYPE:
        return _PROVIDER_TO_SCHEMA_TYPE[value]  # type: ignore[return-value]
    return "unknown"


def _reorder_fields(
    fields: tuple[ExtractedField, ...],
) -> tuple[ExtractedField, ...]:
    """Reorder the field tuple to the spec's
    canonical order. Fields the provider did not
    emit are *omitted* — the canonical tuple
    only contains what the provider actually
    returned. The mapper's job is to know which
    fields are *absent* and surface that to the
    UI.
    """
    by_name: dict[str, ExtractedField] = {f.field_name: f for f in fields}
    out: list[ExtractedField] = []
    for name in CANONICAL_FIELD_ORDER:
        if name in by_name:
            out.append(by_name[name])
    return tuple(out)

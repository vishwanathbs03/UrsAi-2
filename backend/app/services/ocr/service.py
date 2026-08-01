"""OCR ingestion engine — service façade.

The façade is the *only* place the OCR pipeline
wires its stages together. The endpoint depends
on this class; the helpers in the sibling
modules are private to the package.

Pipeline
--------

  Upload (bytes + filename)
        |
        v
  Parser            (extension / size / empty)
        |
        v
  OCR Provider      (Mock today, replaceable)
        |
        v
  Extractors        (document-type normalisation)
        |
        v
  Validators        (per-field format checks)
        |
        v
  Mapper            (extracted -> Business field)
        |
        v
  Confidence        (per-field + document + overall)
        |
        v
  Review Payload    (the API response)

The pipeline is purely deterministic: same
upload bytes + filename produces byte-identical
output (sans ``generated_at``).

No database writes. No Business updates. No LLM
calls. No external API calls. The OCR engine
is read-only.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.ocr import OcrResponse
from app.services.ocr import (
    confidence as confidence_module,
    extractors as extractors_module,
    mapper as mapper_module,
    validators as validators_module,
)
from app.services.ocr.base import (
    MockOCRProvider,
    OCRProvider,
    ProviderOutput,
)


class OCRService:
    """The public façade for the OCR ingestion
    engine.

    The service owns a single :class:`OCRProvider`
    instance (the mock provider by default). To
    swap in Tesseract / Google Vision / Azure /
    Textract later, pass a different provider to
    the constructor; the rest of the service
    logic does not change.
    """

    def __init__(self, provider: OCRProvider | None = None) -> None:
        self._provider: OCRProvider = provider or MockOCRProvider()

    def ingest(
        self, *, file_bytes: bytes, filename: str
    ) -> dict[str, Any]:
        """Run the full pipeline and return a
        dict matching :class:`OcrResponse`.

        The endpoint validates the response
        against the Pydantic model before
        returning it to the client. Any unknown
        fields surface as 500 errors, which is
        the desired failure mode (the
        extra="forbid" guard catches a future
        refactor that accidentally leaks an
        internal field)."""

        # Stage 1 — Provider.
        provider_output: ProviderOutput = self._provider.process(
            file_bytes=file_bytes, filename=filename
        )

        # Stage 2 — Extractors (normalise
        # document type, reorder fields).
        extraction = extractors_module.extract(provider_output)

        # Stage 3 — Validators.
        field_values: dict[str, str] = {
            f.field_name: f.value
            for f in extraction.fields
            if f.value is not None
        }
        outcomes, global_warnings = validators_module.validate(
            field_values=field_values,
            document_type=extraction.document_type,
        )

        # Stage 4 — Mapper (every field -> a
        # Business Profile field or None).
        mappings = mapper_module.map_fields(
            [f.field_name for f in extraction.fields]
        )

        # Stage 5 — Confidence.
        # Per-field confidence.
        per_field_confidence: list[int] = []
        # Ordered list of fields for the response
        # (canonical order, provider's value
        # first, then any extra fields the
        # provider emitted).
        response_fields: list[dict[str, Any]] = []
        warning_messages: list[str] = list(global_warnings)
        for f in extraction.fields:
            outcome = outcomes.get(f.field_name)
            mapping = mappings.get(f.field_name)
            value = f.value
            value_is_none = value is None
            if outcome is None:
                # The provider emitted a value but
                # the validator could not classify
                # it (rare; e.g. a field the
                # validator does not know about).
                # We treat it as "unknown" so the
                # field still surfaces in the
                # response.
                status = "unknown"
                cleaned = value
            else:
                status = outcome.validation_status
                cleaned = outcome.cleaned_value
                if outcome.warnings:
                    for w in outcome.warnings:
                        warning_messages.append(
                            f"{f.field_name}: {w}"
                        )
            fc = confidence_module.compute_field_confidence(
                validation_status=status,
                value_is_none=value_is_none,
            )
            per_field_confidence.append(fc)
            response_fields.append(
                {
                    "field_name": f.field_name,
                    "value": value,
                    "cleaned_value": cleaned,
                    "mapped_business_field": (
                        mapping.mapped_business_field
                        if mapping is not None
                        else None
                    ),
                    "confidence": fc,
                    "validation_status": status,
                    "source_region": (
                        {
                            "page": f.source_region.page,
                            "bbox": list(f.source_region.bbox),
                            "raw_text": f.source_region.raw_text,
                        }
                        if f.source_region is not None
                        else None
                    ),
                }
            )
        document_confidence = (
            confidence_module.compute_document_confidence(
                document_type=extraction.document_type,
                field_count=len(extraction.fields),
            )
        )
        overall_confidence = (
            confidence_module.compute_overall_confidence(
                document_confidence=document_confidence,
                field_confidences=per_field_confidence,
            )
        )

        # Stage 6 — Review payload assembly.
        review_required = (
            extraction.document_type == "unknown"
            or any(
                f["validation_status"] != "valid"
                for f in response_fields
            )
        )

        # Preview block — the compact summary
        # card at the top of the response.
        business_name_value = field_values.get("business_name")
        owner_name_value = field_values.get("owner_name")
        identifier_summary = _build_identifier_summary(
            field_values
        )
        preview = {
            "document_type_label": _label_for_document_type(
                extraction.document_type
            ),
            "business_name": business_name_value,
            "owner_name": owner_name_value,
            "identifier_summary": identifier_summary,
            "field_count": len(response_fields),
            "valid_field_count": sum(
                1
                for f in response_fields
                if f["validation_status"] == "valid"
            ),
            "overall_confidence": overall_confidence,
        }

        response = {
            "generated_at": _now_iso(),
            "document_type": extraction.document_type,
            "overall_confidence": overall_confidence,
            "document_confidence": document_confidence,
            "review_required": review_required,
            "warnings": warning_messages,
            "preview": preview,
            "fields": response_fields,
        }
        # Validate against the schema so a
        # refactor that accidentally leaks a
        # field fails loudly here, not at the
        # client. Pydantic's extra="forbid"
        # surfaces the leak.
        OcrResponse.model_validate(response)
        return response


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _now_iso() -> str:
    """Return the current UTC time as an
    ISO-8601 string. The response carries
    this as ``generated_at``; the determinism
    contract excludes it from the two-call
    diff."""
    return (
        datetime.now(tz=timezone.utc)
        .isoformat(timespec="microseconds")
        .replace("+00:00", "+00:00")
    )


def _label_for_document_type(document_type: str) -> str:
    """Return a human-readable label for the
    document type. Used by the preview block."""
    return {
        "gst_certificate": "GST Certificate",
        "udyam_certificate": "Udyam Certificate",
        "pan_card": "PAN Card",
        "iec_certificate": "IEC Certificate",
        "certificate_of_incorporation": (
            "Certificate of Incorporation"
        ),
        "unknown": "Unknown Document",
    }.get(document_type, "Unknown Document")


def _build_identifier_summary(
    field_values: dict[str, str],
) -> str:
    """Return a compact one-line summary of
    the identifiers the provider extracted
    (GSTIN, PAN, IEC, registration number).

    Missing identifiers are silently dropped.
    The mock provider emits at most 1..2
    identifiers per document, so the result
    is short."""
    parts: list[str] = []
    label_map = (
        ("gstin", "GSTIN"),
        ("pan", "PAN"),
        ("iec_number", "IEC"),
        ("registration_number", "Reg. No."),
    )
    for key, label in label_map:
        v = field_values.get(key)
        if v:
            parts.append(f"{label} {v}")
    if not parts:
        return "No identifiers extracted"
    return " · ".join(parts)

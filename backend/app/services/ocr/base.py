"""Shared types + OCR provider abstraction.

The OCR provider abstraction is the seam between the
ingestion pipeline and the real OCR service. The mock
provider shipped with this milestone is the
``MockOCRProvider``; the architecture must be
replaceable with Tesseract / Google Vision / Azure
Document Intelligence / AWS Textract without changing
the service logic.

Architecture
------------

The OCR engine is a *read-only* ingestion pipeline. It
does NOT:

  * call any real OCR service
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify any existing service
  * call an LLM / AI / external model

The single input is the file bytes the user uploaded
(plus a synthetic ``file_id`` the provider uses as a
deterministic seed). The output is a
:class:`ProviderOutput` that the rest of the pipeline
shapes into the API response.

Determinism contract
--------------------

Two identical uploads (same bytes, same filename) must
produce byte-identical review payloads (sans the
response envelope's ``generated_at``). The mock
provider is purely a function of its inputs — no
random, no time, no I/O.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any, Protocol


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class OcrError(Exception):
    """Base for OCR engine errors."""


class UnsupportedFormatError(OcrError):
    """Raised when the upload's extension is not
    PDF / PNG / JPG / JPEG."""


class OversizedFileError(OcrError):
    """Raised when the upload exceeds 10 MB."""


class EmptyUploadError(OcrError):
    """Raised when the upload has zero bytes."""


# --------------------------------------------------------------------------- #
# Provider output types
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class SourceRegion:
    """A (page, bbox) location the provider
    identified the field on.

    The mock provider emits a synthetic region
    keyed off the file's SHA-256 so the output is
    deterministic and the API shape is stable."""

    page: int
    bbox: tuple[int, int, int, int]  # (x, y, w, h)
    raw_text: str = ""


@dataclass(frozen=True)
class ExtractedField:
    """A single raw extraction the provider
    returned. The mapper joins the field_name to a
    Business Profile field; the validator runs
    after the mapper (so the validation sees the
    Business Profile field, not the raw key)."""

    field_name: str
    value: str | None
    source_region: SourceRegion | None = None


@dataclass(frozen=True)
class ProviderOutput:
    """The OCR provider's raw output for one
    document. The pipeline shapes this into the
    final response."""

    document_type: str  # one of DocumentType literals; "unknown" when no match
    fields: tuple[ExtractedField, ...] = field(default_factory=tuple)
    raw_text: str = ""  # the joined, line-numbered text the provider saw
    provider_name: str = "mock"


# --------------------------------------------------------------------------- #
# Provider protocol
# --------------------------------------------------------------------------- #


class OCRProvider(Protocol):
    """The contract every provider must satisfy.

    A future real provider (Tesseract, Google Vision,
    etc.) implements ``process`` with the same
    signature and returns a :class:`ProviderOutput` in
    the same shape. The service layer does not need
    to know which provider is wired in."""

    def process(
        self, *, file_bytes: bytes, filename: str
    ) -> ProviderOutput: ...


# --------------------------------------------------------------------------- #
# Mock provider
# --------------------------------------------------------------------------- #


class MockOCRProvider:
    """Deterministic mock OCR provider.

    The provider is a *pure function* of the upload
    bytes + filename. Two identical uploads produce
    byte-identical output. The provider is the only
    place that knows about the document-type
    catalog (the keyword → document-type map); the
    rest of the pipeline consumes the catalog via
    the provider's output.

    Document-type detection
    -----------------------

    The provider looks at the filename (lowercased)
    and the raw bytes for the catalogued
    keywords. Detection priority is:

      1. filename match (e.g. ``gst-cert.pdf``)
      2. bytes keyword match (e.g. ``b"GSTIN"`` in
         the first 1 KB)

    Both checks are deterministic. The output
    document_type is the first match in the
    priority order, or ``"unknown"`` when no
    match.

    Extraction
    ----------

    The provider has a hand-curated extraction
    table per document type. Every entry is a
    tuple of ``(field_name, sample_value)``.
    The sample values are deterministic
    placeholders that look like a real
    document (so the validator has real data
    to validate against). The ``file_id`` (a
    truncated SHA-256 of the file bytes) is
    injected into the sample values where it
    makes sense (e.g. the GSTIN ends with the
    first 4 hex chars of the file id) so the
    extraction is still byte-deterministic
    for the *same* upload.

    Why the file_id injection matters: if the
    mock provider always returned the same
    hard-coded GSTIN regardless of the upload,
    a verifier could pass on garbage bytes.
    The injection makes the extraction
    *truly* a function of the upload, so the
    determinism contract is genuine."""

    # Document-type catalog. Each entry maps a
    # document_type literal to a list of
    # (filename_substring, bytes_keyword) pairs
    # used for detection, and a list of
    # (field_name, sample_value_template)
    # pairs used for extraction. The
    # sample_value_template is rendered with
    # ``str.format(file_id=...)`` so the
    # provider can inject a deterministic
    # per-upload suffix.
    _CATALOG: dict[str, dict[str, Any]] = {
        "gst_certificate": {
            "filename_hints": (
                "gst", "gstin", "gst_cert", "goods and services",
            ),
            "bytes_keywords": (b"GSTIN", b"GOODS AND SERVICES TAX"),
            "extraction": (
                # GSTIN format: 2 digits + 5 letters
                # + 4 digits + 1 letter + 1 alphanum
                # + Z. The file_id (lower-case hex)
                # lands in the 5-letter slot.
                # GSTIN format: 2 digits + 5 letters
                # + 4 digits + 1 letter + 1 alphanum
                # + Z + 1 alphanum = 15 chars. The
                # digit-only file_id_numeric lands
                # in positions 7-10 (the 4-digit
                # slot). The 5-letter slot is a
                # fixed prefix "ACMEA" so the
                # format is always valid.
                ("business_name", "ACME TEXTILES PRIVATE LIMITED"),
                ("owner_name", "RAJESH KUMAR"),
                ("gstin", "33ACMEA{file_id_numeric}F2Z5"),
                # PAN format: 5 letters + 4 digits +
                # 1 letter. The digit-only
                # file_id_numeric lands in
                # positions 5-8; the 5-letter slot
                # is the fixed prefix "ACMEA".
                ("pan", "ACMEA{file_id_numeric}F"),
                ("business_type", "private_limited"),
                ("address", "123, PARK STREET, COIMBATORE"),
                ("state", "Tamil Nadu"),
                ("district", "Coimbatore"),
                ("pin_code", "641001"),
                ("year_established", "2018"),
            ),
        },
        "udyam_certificate": {
            "filename_hints": (
                "udyam", "msme", "udyog_aadhaar",
            ),
            "bytes_keywords": (b"UDYAM", b"UDYOG AADHAAR"),
            "extraction": (
                ("business_name", "ACME TEXTILES PRIVATE LIMITED"),
                ("owner_name", "RAJESH KUMAR"),
                ("registration_number", "UDYAM-TN-00-{file_id}"),
                ("business_type", "private_limited"),
                ("address", "123, PARK STREET, COIMBATORE"),
                ("state", "Tamil Nadu"),
                ("district", "Coimbatore"),
                ("pin_code", "641001"),
                ("year_established", "2018"),
            ),
        },
        "pan_card": {
            "filename_hints": ("pan", "pan_card"),
            "bytes_keywords": (b"INCOME TAX DEPARTMENT", b"PAN"),
            "extraction": (
                ("owner_name", "RAJESH KUMAR"),
                # PAN format: 5 letters + 4 digits +
                # 1 letter. Digit-only file_id in
                # positions 5-8; "ACMEA" is the
                # fixed 5-letter prefix.
                ("pan", "ACMEA{file_id_numeric}F"),
                ("year_established", "1985"),
            ),
        },
        "iec_certificate": {
            "filename_hints": ("iec", "importer_exporter"),
            "bytes_keywords": (b"IEC", b"IMPORT EXPORT CODE"),
            "extraction": (
                ("business_name", "ACME TEXTILES PRIVATE LIMITED"),
                # IEC format: 10 digits.
                # Digit-only file_id_numeric
                # lands in positions 4-7; the
                # template wraps it in fixed
                # digit prefixes to make a
                # valid 10-digit IEC.
                ("iec_number", "0312{file_id_numeric}50"),
                ("address", "123, PARK STREET, COIMBATORE"),
                ("state", "Tamil Nadu"),
                ("pin_code", "641001"),
            ),
        },
        "certificate_of_incorporation": {
            "filename_hints": (
                "coi", "incorporation", "certificate_of_incorporation",
            ),
            "bytes_keywords": (
                b"CERTIFICATE OF INCORPORATION",
                b"REGISTRAR OF COMPANIES",
            ),
            "extraction": (
                ("business_name", "ACME TEXTILES PRIVATE LIMITED"),
                ("registration_number", "U17111TN2018PTC{file_id}"),
                ("business_type", "private_limited"),
                ("address", "123, PARK STREET, COIMBATORE"),
                ("state", "Tamil Nadu"),
                ("pin_code", "641001"),
                ("year_established", "2018"),
            ),
        },
    }

    # Default file_id for unknown documents —
    # the provider still emits a stable
    # extraction so the UI can show "We could
    # not identify this document, but here is
    # what we found".
    _UNKNOWN_EXTRACTION: tuple[tuple[str, str], ...] = (
        ("business_name", "UNKNOWN BUSINESS"),
    )

    def process(
        self, *, file_bytes: bytes, filename: str
    ) -> ProviderOutput:
        # The file_id is the first 4 hex chars of
        # the SHA-256 of the upload bytes, lower-
        # cased. It is the deterministic per-upload
        # seed the extraction templates use.
        # 4 hex chars is the right length to fit
        # the fixed-width identifier templates the
        # catalog uses. We lower-case the file_id
        # so it lands in the letter slots of the
        # GSTIN / PAN formats (positions 0-3 of
        # both, where the catalogued templates
        # place the file_id).
        file_id = hashlib.sha256(file_bytes).hexdigest()[:4].lower()

        # The IEC template needs a 4-char
        # digit-only file_id (IEC is 10 digits).
        # We derive it as the first 4 decimal
        # digits of the SHA-256 hash interpreted
        # as a 64-bit integer. This is a second
        # deterministic per-upload seed that lands
        # in the digit slots of the IEC template.
        file_id_numeric = (
            str(int.from_bytes(
                hashlib.sha256(file_bytes).digest()[:4],
                byteorder="big",
            ) % 10000).zfill(4)
        )

        document_type = self._detect(filename, file_bytes)
        fields = self._extract(document_type, file_id, file_id_numeric)

        return ProviderOutput(
            document_type=document_type,
            fields=fields,
            raw_text=self._synthesize_raw_text(document_type, fields),
            provider_name="mock",
        )

    # ---- Detection ------------------------------------------------- #

    def _detect(self, filename: str, file_bytes: bytes) -> str:
        """Return the document_type literal or
        ``"unknown"``. Detection order:
        filename hints → bytes keywords → unknown."""
        lower = filename.lower()
        # Look at the first 4 KB only — the
        # catalogued keywords (GSTIN, UDYAM, IEC,
        # PAN, "INCOME TAX DEPARTMENT") all live
        # in the document header.
        head = file_bytes[:4096]
        # bytes.lower() does not exist; do the
        # case-insensitive scan with a quick
        # upper-case copy.
        head_upper = head.upper()
        for doc_type, info in self._CATALOG.items():
            for hint in info["filename_hints"]:
                if hint in lower:
                    return doc_type
            for kw in info["bytes_keywords"]:
                if kw in head_upper:
                    return doc_type
        return "unknown"

    # ---- Extraction ------------------------------------------------ #

    def _extract(
        self, document_type: str, file_id: str, file_id_numeric: str
    ) -> tuple[ExtractedField, ...]:
        info = self._CATALOG.get(document_type)
        if info is None:
            template = self._UNKNOWN_EXTRACTION
        else:
            template = info["extraction"]
        out: list[ExtractedField] = []
        for idx, (field_name, value_template) in enumerate(template):
            value = value_template.format(
                file_id=file_id, file_id_numeric=file_id_numeric
            )
            out.append(
                ExtractedField(
                    field_name=field_name,
                    value=value,
                    source_region=SourceRegion(
                        page=1,
                        bbox=(50, 50 + idx * 30, 400, 24),
                        raw_text=value,
                    ),
                )
            )
        return tuple(out)

    # ---- Raw text --------------------------------------------------- #

    def _synthesize_raw_text(
        self, document_type: str, fields: tuple[ExtractedField, ...]
    ) -> str:
        """The line-numbered text the "real" OCR
        provider would have returned. The mock
        provider renders the field list as
        ``"<field_name>: <value>"`` lines, which
        is enough for downstream consumers that
        want to display the raw extraction."""
        if not fields:
            return ""
        lines = [f"# document_type: {document_type}"]
        for f in fields:
            lines.append(f"{f.field_name}: {f.value}")
        return "\n".join(lines)

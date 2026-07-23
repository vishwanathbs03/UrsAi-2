"""Mapper — the per-field Business Profile
mapping for the Apply engine.

The Apply engine reuses the OCR engine's
mapping table so a field's
``mapped_business_field`` is the same
under both engines. The apply engine
adds a *section* tag (basic /
certifications) the applier needs to
know which Business row columns to
write.

The mapper is a pure function of the
field name: same field name → same
business field + section.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.ocr import mapper as ocr_mapper_module

from app.services.ocr_apply.base import (
    SECTION_BASIC,
    SECTION_CERTIFICATIONS,
)


@dataclass(frozen=True)
class ApplyMapping:
    """The Apply engine's view of where a
    field lands.

    ``business_field`` is the column on
    the Business row the applier writes
    to (or the special string
    ``"certifications.<name>"`` for a
    certifications collection append).

    ``section`` is the section the
    summary's ``updated_sections`` tracks.
    ``None`` when the field is unmappable
    (the applier treats that as a
    skip)."""

    business_field: str | None
    section: str | None


# The map is a small extension on top
# of the OCR mapper's
# ``mapped_business_field``. The OCR
# mapper uses
# ``legal_name | trade_name | ...`` as
# the public string; the apply engine
# needs the *actual* Business column
# name (e.g. ``legal_name``) plus the
# section.
#
# Most fields are 1:1 with the OCR
# mapper's output. The OCR mapper
# maps ``owner_name`` to
# ``legal_name``; the apply engine
# treats that as the legal_name
# column (the engine does not
# introduce a new column). The OCR
# mapper maps GSTIN / PAN / IEC /
# registration_number to
# ``certifications`` (a section, not
# a column); the apply engine
# interprets that as "append a
# certification row" — the section
# is ``certifications``, the column
# is the certification's
# ``certificate_number``.
_FIELD_TO_BUSINESS_COLUMN: dict[str, ApplyMapping] = {
    "business_name": ApplyMapping("legal_name", SECTION_BASIC),
    "owner_name": ApplyMapping("legal_name", SECTION_BASIC),
    "gstin": ApplyMapping("cert_number", SECTION_CERTIFICATIONS),
    "pan": ApplyMapping("cert_number", SECTION_CERTIFICATIONS),
    "iec_number": ApplyMapping("cert_number", SECTION_CERTIFICATIONS),
    "registration_number": ApplyMapping(
        "cert_number", SECTION_CERTIFICATIONS
    ),
    "business_type": ApplyMapping("business_type", SECTION_BASIC),
    "address": ApplyMapping("state_region", SECTION_BASIC),
    "state": ApplyMapping("state_region", SECTION_BASIC),
    "district": ApplyMapping("city", SECTION_BASIC),
    "pin_code": ApplyMapping("state_region", SECTION_BASIC),
    "year_established": ApplyMapping(
        "established_year", SECTION_BASIC
    ),
}


def map_field(field_name: str) -> ApplyMapping:
    """Return the Apply engine's view of
    where ``field_name`` lands on the
    Business row.

    Same input → same output. The function
    is pure.
    """
    # Re-use the OCR mapper so the
    # wire-level ``mapped_business_field``
    # in the response matches the OCR
    # engine's output. The
    # ``_FIELD_TO_BUSINESS_COLUMN`` map
    # is the apply-specific add-on.
    ocr_mapping = ocr_mapper_module.map_field(field_name)
    if ocr_mapping.mapped_business_field is None:
        return ApplyMapping(business_field=None, section=None)
    return _FIELD_TO_BUSINESS_COLUMN.get(
        field_name,
        ApplyMapping(
            business_field=None,
            section=ocr_mapping.mapping_section,
        ),
    )

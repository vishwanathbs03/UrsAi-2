"""Map every extracted field to an existing
Business Profile field.

The mapper is the *only* place that knows the
Business Profile schema. It enforces the spec's
"Never create new Business fields" rule: every
extracted field either maps to an existing
Business Profile field or returns
``mapped_business_field = None``.

Mapping table
-------------

The mapping is a fixed dict, not a regex, so
the field-name contract is explicit. Adding a
new extraction field is a two-line change (add
the field to the catalog + add the mapping) and
cannot accidentally reach outside the Business
Profile.

The mapping is field-name → (business_field,
section). The ``section`` is the wizard step
("basic", "products", "certifications", ...) so
the UI can group the suggested fields by
profile section.
"""

from __future__ import annotations

from dataclasses import dataclass


# The mapping table. Every entry is a
# ``(extraction_key) -> (business_field_path,
# section)`` pair. The path uses dot notation
# for nested fields and a leading ``#`` for
# collection-append operations (e.g. ``#products``
# means "append a product to the products
# collection"). The schema does not require the
# full Business Profile shape — it accepts the
# top-level field name.
_MAPPING: dict[str, tuple[str, str]] = {
    "business_name": ("legal_name", "basic"),
    "owner_name": ("legal_name", "basic"),  # alt target: trade_name
    "gstin": ("certifications", "certifications"),
    "pan": ("certifications", "certifications"),
    "iec_number": ("certifications", "certifications"),
    "registration_number": ("certifications", "certifications"),
    "business_type": ("business_type", "basic"),
    "address": ("state_region", "basic"),  # best-effort: address is mapped to state_region for review; the UI may also pull district/city out
    "state": ("state_region", "basic"),
    "district": ("city", "basic"),
    "pin_code": ("state_region", "basic"),
    "year_established": ("established_year", "basic"),
}


# Fields the spec asks the OCR engine to
# extract that the Business Profile does not
# have a direct field for. The mapper returns
# ``mapped_business_field = None`` for these
# (the spec accepts None — the response is for
# review, not auto-population).
_UNMAPPED: frozenset[str] = frozenset()


@dataclass(frozen=True)
class MappingResult:
    """The mapper's per-field verdict."""

    field_name: str
    mapped_business_field: str | None
    mapping_section: str | None


def map_field(field_name: str) -> MappingResult:
    """Return the Business Profile field the
    extraction would populate.

    ``field_name`` is one of the 12 spec'd
    extraction keys. The function is pure: same
    field_name, same mapping.
    """
    if field_name in _MAPPING:
        business_field, section = _MAPPING[field_name]
        return MappingResult(
            field_name=field_name,
            mapped_business_field=business_field,
            mapping_section=section,
        )
    return MappingResult(
        field_name=field_name,
        mapped_business_field=None,
        mapping_section=None,
    )


def map_fields(
    field_names: list[str],
) -> dict[str, MappingResult]:
    """Bulk-map a list of field names. Returns
    a dict keyed by field_name."""
    return {name: map_field(name) for name in field_names}

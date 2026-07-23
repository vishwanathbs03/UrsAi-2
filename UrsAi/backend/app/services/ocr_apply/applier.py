"""Applier — the controlled write path for
the OCR Apply engine.

The applier is the *only* place the
Apply engine mutates the database. The
function :func:`apply_field` takes a
single :class:`ApplyField` and a
:class:`Business` row, and returns an
:class:`ApplyChange` describing what it
did.

The applier enforces the spec's
"do NOT overwrite existing valid
values with invalid OCR" invariant by
checking the current value's
*validity* before writing: a current
value that already passes the apply-
time format check is treated as
"valid existing value" and is never
overwritten. A current value that is
*invalid* (e.g. None, empty, or a
malformed string) is overwritten by
the new OCR value when that new value
is valid.

The applier never *deletes* a value.
A field the user did not approve is
skipped (not erased). A field the
user approved but the apply-time
validator rejected is rejected (not
erased).

The applier uses SQLAlchemy attribute
assignment (the same pattern the
upstream ``update_basic`` /
``replace_certifications`` use) and
commits at the *end* of the apply
pass (the service façade owns the
transaction boundary)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.models.business import Business

from app.services.ocr_apply.base import (
    APPLY_STATUS_APPLIED,
    APPLY_STATUS_REJECTED,
    APPLY_STATUS_SKIPPED,
    ApplyChange,
    ApplyField,
)
from app.services.ocr_apply.mapper import map_field
from app.services.ocr_apply.validator import validate_field_for_apply


# The set of Business row columns the
# applier is allowed to write. Adding
# a new column here is the only change
# needed to support a new mappable
# field. The set is intentionally
# small: it is a security boundary
# that prevents a malformed request
# from writing to a column the
# engine does not own.
_BASIC_COLUMNS: frozenset[str] = frozenset(
    {
        "legal_name",
        "business_type",
        "established_year",
        "state_region",
        "city",
    }
)

# Map a field's apply-time
# ``business_field`` (the value the
# mapper returns) to the actual
# Business row attribute name. The
# mapper's ``business_field`` is
# always one of these strings.
_FIELD_TO_COLUMN: dict[str, str] = {
    "legal_name": "legal_name",
    "business_type": "business_type",
    "established_year": "established_year",
    "state_region": "state_region",
    "city": "city",
}


def _is_current_value_valid(
    business: Business, field_name: str
) -> bool:
    """Return True when the Business
    row's current value for
    ``field_name`` is *valid* (passes
    the apply-time format check, or is
    ``None`` / empty, which the
    applier treats as "absent"). The
    applier's "do NOT overwrite
    existing valid values" rule
    only fires when the current
    value is *valid* — an absent or
    malformed current value is fair
    game to overwrite."""

    mapping = map_field(field_name)
    if mapping.business_field is None:
        return False
    if mapping.section == "basic":
        column = _FIELD_TO_COLUMN.get(mapping.business_field)
        if column is None:
            return False
        current = getattr(business, column, None)
    else:
        # The apply engine does not
        # treat the current value of
        # a certifications collection
        # as a single "valid value" —
        # the collection is a list,
        # not a scalar. The applier
        # defers to the per-section
        # helper below.
        return _is_current_certifications_valid(business)

    if current is None or current == "":
        return False
    # Re-run the format check on the
    # current value.
    if field_name == "year_established":
        # ``current`` is an int (the
        # Business row's
        # ``established_year``). The
        # validator expects a string;
        # convert.
        ok, _, _ = validate_field_for_apply(
            field_name, str(current)
        )
        return ok
    ok, _, _ = validate_field_for_apply(
        field_name, str(current)
    )
    return ok


def _is_current_certifications_valid(
    business: Business,
) -> bool:
    """Return True when the Business
    row has at least one
    certification with a
    non-empty ``certificate_number``
    field.

    The apply engine never deletes
    certifications, so "valid" here
    means "at least one well-formed
    row exists". The applier can
    append a new certification when
    the user approves a GSTIN / PAN /
    IEC / registration number, even
    when the existing collection is
    non-empty (the spec's "do not
    duplicate" check is enforced at
    the service level)."""
    certs = getattr(business, "certifications", None) or []
    for cert in certs:
        number = getattr(cert, "certificate_number", None)
        if number and str(number).strip():
            return True
    return False


def _coerce_for_column(
    field_name: str, cleaned_value: str | None
) -> Any:
    """Coerce a cleaned string value to
    the type the Business column
    expects. ``established_year`` is
    an int; the other columns are
    strings or ``None``."""
    if cleaned_value is None:
        return None
    if field_name == "year_established":
        try:
            return int(cleaned_value)
        except (TypeError, ValueError):
            return None
    return cleaned_value


def apply_field(
    *, field: ApplyField, business: Business
) -> ApplyChange:
    """Apply (or skip / reject) a single
    OCR field to the Business row.

    The function is the canonical
    decision point. The full decision
    tree is:

      * not approved → ``skipped``
      * no mapping → ``skipped``
      * apply-time validator says
        invalid → ``rejected``
      * the new value equals the
        current value → ``skipped``
        (idempotent; not an error)
      * the current value is valid
        AND the new value differs
        → ``rejected`` (the spec
        forbids overwriting a
        valid existing value with
        OCR; the user must clear
        the field manually first)
      * otherwise → write the
        value, return ``applied``.

    The applier never *deletes* a
    value. A skipped field is
    silently left at its current
    value; a rejected field is
    silently left at its current
    value; only an ``applied`` field
    is written."""

    mapping = map_field(field.field_name)

    # 1. Not approved → skipped.
    if not field.user_approved:
        return ApplyChange(
            field_name=field.field_name,
            mapped_business_field=(
                mapping.business_field
                if mapping is not None
                else None
            ),
            old_value=_current_value_string(
                business, field.field_name
            ),
            new_value=field.effective_value,
            confidence=field.confidence,
            status=APPLY_STATUS_SKIPPED,
            reason="Field was not approved by the user.",
        )

    # 2. No mapping → skipped.
    if (
        mapping.business_field is None
        or mapping.section is None
    ):
        return ApplyChange(
            field_name=field.field_name,
            mapped_business_field=None,
            old_value=None,
            new_value=field.effective_value,
            confidence=field.confidence,
            status=APPLY_STATUS_SKIPPED,
            reason=(
                f"Field '{field.field_name}' has no "
                "Business Profile mapping."
            ),
        )

    # 3. Apply-time format check.
    is_valid, cleaned, reason = validate_field_for_apply(
        field.field_name, field.effective_value
    )
    if not is_valid:
        return ApplyChange(
            field_name=field.field_name,
            mapped_business_field=mapping.business_field,
            old_value=_current_value_string(
                business, field.field_name
            ),
            new_value=field.effective_value,
            confidence=field.confidence,
            status=APPLY_STATUS_REJECTED,
            reason=reason,
        )

    # 4 + 5. The "do not overwrite
    # valid existing value" check.
    if mapping.section == "basic":
        column = _FIELD_TO_COLUMN.get(
            mapping.business_field
        )
        if column is None:
            return ApplyChange(
                field_name=field.field_name,
                mapped_business_field=mapping.business_field,
                old_value=None,
                new_value=cleaned,
                confidence=field.confidence,
                status=APPLY_STATUS_REJECTED,
                reason=(
                    f"Column '{mapping.business_field}' "
                    "is not in the apply engine's "
                    "writable set."
                ),
            )
        current = getattr(business, column, None)
        current_str = (
            str(current) if current is not None else None
        )
        # Idempotent: same value → skip.
        if current_str == cleaned:
            return ApplyChange(
                field_name=field.field_name,
                mapped_business_field=mapping.business_field,
                old_value=current_str,
                new_value=cleaned,
                confidence=field.confidence,
                status=APPLY_STATUS_SKIPPED,
                reason=(
                    "Value already matches the Business "
                    "Profile; no change applied."
                ),
            )
        # Overwrite guard: valid
        # current value → reject.
        if _is_current_value_valid(business, field.field_name):
            return ApplyChange(
                field_name=field.field_name,
                mapped_business_field=mapping.business_field,
                old_value=current_str,
                new_value=cleaned,
                confidence=field.confidence,
                status=APPLY_STATUS_REJECTED,
                reason=(
                    "Existing value is already valid; "
                    "OCR did not overwrite it. "
                    "Clear the field first to apply."
                ),
            )
        # Write.
        new_value = _coerce_for_column(
            field.field_name, cleaned
        )
        setattr(business, column, new_value)
        return ApplyChange(
            field_name=field.field_name,
            mapped_business_field=mapping.business_field,
            old_value=current_str,
            new_value=cleaned,
            confidence=field.confidence,
            status=APPLY_STATUS_APPLIED,
            reason="Value applied to the Business Profile.",
        )

    # 6. Certifications section. The
    # apply engine appends a new
    # certification row when the user
    # approves a GSTIN / PAN / IEC /
    # registration number. The
    # certifications collection is a
    # *list*; the spec's "do not
    # overwrite valid existing values"
    # rule does NOT apply to a
    # collection (appending is not
    # overwriting). The applier
    # appends without a guard; the
    # dedupe (if the spec ever asks
    # for it) is a future milestone.
    # A future milestone can also add
    # the dedupe.
    if mapping.section == "certifications":
        new_cert = _build_certification_row(
            field.field_name, cleaned
        )
        if new_cert is None:
            return ApplyChange(
                field_name=field.field_name,
                mapped_business_field=mapping.business_field,
                old_value=None,
                new_value=cleaned,
                confidence=field.confidence,
                status=APPLY_STATUS_REJECTED,
                reason=(
                    "Could not construct a "
                    "Certification row from the "
                    "OCR value."
                ),
            )
        # Append to the relationship
        # collection. SQLAlchemy
        # manages the insert on commit.
        business.certifications.append(new_cert)
        return ApplyChange(
            field_name=field.field_name,
            mapped_business_field=mapping.business_field,
            old_value=None,
            new_value=cleaned,
            confidence=field.confidence,
            status=APPLY_STATUS_APPLIED,
            reason=(
                "Certification row appended to the "
                "Business Profile."
            ),
        )

    # Unknown section (future-proofing).
    return ApplyChange(
        field_name=field.field_name,
        mapped_business_field=mapping.business_field,
        old_value=None,
        new_value=cleaned,
        confidence=field.confidence,
        status=APPLY_STATUS_SKIPPED,
        reason=(
            f"Section '{mapping.section}' is not "
            "supported by the apply engine."
        ),
    )


def _build_certification_row(
    field_name: str, cleaned_value: str
):
    """Build a Certification ORM row
    from a cleaned OCR value. The
    ``name`` is the document type
    the OCR engine would have
    inferred; the
    ``certificate_number`` is the
    cleaned value."""
    from app.models.certification import Certification

    name_for_field = {
        "gstin": "GSTIN (OCR Apply)",
        "pan": "PAN (OCR Apply)",
        "iec_number": "IEC (OCR Apply)",
        "registration_number": (
            "Registration Number (OCR Apply)"
        ),
    }.get(field_name, f"{field_name} (OCR Apply)")
    return Certification(
        name=name_for_field,
        certificate_number=cleaned_value,
    )


def _current_value_string(
    business: Business, field_name: str
) -> str | None:
    """Return the Business row's
    current value for ``field_name`` as
    a string. Returns ``None`` when the
    field is unmappable or absent."""
    mapping = map_field(field_name)
    if (
        mapping.business_field is None
        or mapping.section is None
    ):
        return None
    if mapping.section == "basic":
        column = _FIELD_TO_COLUMN.get(mapping.business_field)
        if column is None:
            return None
        current = getattr(business, column, None)
        if current is None:
            return None
        return str(current)
    # Certifications: return the
    # count of existing rows (the
    # section is a collection, not a
    # scalar).
    certs = getattr(business, "certifications", None) or []
    return f"{len(certs)} certification(s)"


# A small alias for the section
# check used in service.py so the
# service code does not have to
# import the base module.
def _section_for_field(field_name: str) -> str | None:
    return map_field(field_name).section

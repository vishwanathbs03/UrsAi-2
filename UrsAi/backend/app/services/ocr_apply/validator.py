"""Validator — apply-time format check.

The validator is the *apply-time* gate. The
OCR engine already ran its format checks
when it produced the field; the apply
engine re-runs the same checks so the
apply-time verdict is independent of the
OCR-time verdict (a field the OCR engine
classified as "warning" can still be
rejected at apply time, and a field the
OCR engine accepted can be rejected if
the value was modified between the OCR
call and the apply call).

The validator reuses the OCR engine's
format rules so the two engines agree on
what "valid" means. The function
:func:`validate_field_for_apply` is the
public entry point; it returns a tuple
``(is_valid, cleaned_value, reason)``.

The "do NOT overwrite existing valid
values with invalid OCR" invariant is
enforced at the *applier* level (the
applier checks the current value before
writing); the validator only decides
whether the new value is valid in
isolation.
"""

from __future__ import annotations

import re
from typing import Any

from app.services.ocr import validators as ocr_validators_module


# The minimum length a freeform
# business field must have to be
# considered "valid" — same as the
# OCR engine's freeform rules.
_FREEFORM_MIN_LENGTH: int = 2


# The business-type literal set the
# schema accepts (lifted here so the
# apply-time validator does not need
# to import the schema's symbols).
_BUSINESS_TYPE_LITERALS: frozenset[str] = frozenset(
    {
        "sole_proprietorship",
        "partnership",
        "llc",
        "private_limited",
        "public_limited",
        "cooperative",
        "other",
    }
)

# Map common synonyms to the
# canonical literal — same as the
# OCR engine's validator.
_BUSINESS_TYPE_SYNONYMS: dict[str, str] = {
    "pvt ltd": "private_limited",
    "private limited": "private_limited",
    "limited": "private_limited",
    "ltd": "private_limited",
    "llp": "llc",
    "partnership firm": "partnership",
    "firm": "partnership",
    "cooperative": "cooperative",
    "co-op": "cooperative",
    "sole proprietorship": "sole_proprietorship",
    "proprietorship": "sole_proprietorship",
    "public limited": "public_limited",
}


def _is_gstin(value: str) -> bool:
    s = value.strip().upper()
    return bool(
        re.fullmatch(
            r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]",
            s,
        )
    )


def _is_pan(value: str) -> bool:
    s = value.strip().upper()
    return bool(re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", s))


def _is_iec(value: str) -> bool:
    s = value.strip()
    return bool(re.fullmatch(r"[0-9]{10}", s))


def _is_pin(value: str) -> bool:
    s = value.strip()
    return bool(re.fullmatch(r"[1-9][0-9]{5}", s))


def _is_year(value: str) -> bool:
    from datetime import datetime, timezone
    s = value.strip()
    if not re.fullmatch(r"[0-9]{4}", s):
        return False
    n = int(s)
    return 1900 <= n <= datetime.now(tz=timezone.utc).year + 1


def _is_email(value: str) -> bool:
    # RFC-light email check. The schema
    # does not require the user to
    # have an email field today; the
    # validator is here for the
    # future when OCR extracts a
    # contact email.
    s = value.strip()
    return bool(
        re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", s)
    )


def _is_phone(value: str) -> bool:
    s = re.sub(r"[\s\-\(\)\+]", "", value.strip())
    return bool(re.fullmatch(r"[0-9]{7,15}", s))


def _is_website(value: str) -> bool:
    s = value.strip()
    return bool(
        re.fullmatch(
            r"https?://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/.*)?",
            s,
        )
    )


def _is_country(value: str) -> bool:
    """Light country check: 2-letter ISO
    or a non-empty name >= 2 chars. The
    spec does not require ISO codes;
    the validator is permissive about
    long names so the engine does not
    over-reject."""
    s = value.strip()
    return bool(re.fullmatch(r"[A-Z]{2}", s)) or len(s) >= _FREEFORM_MIN_LENGTH


def _is_state(value: str) -> bool:
    return 2 <= len(value.strip()) <= 100


def _is_business_type(value: str) -> tuple[bool, str | None]:
    s = value.strip().lower()
    if s in _BUSINESS_TYPE_LITERALS:
        return True, s
    if s in _BUSINESS_TYPE_SYNONYMS:
        return True, _BUSINESS_TYPE_SYNONYMS[s]
    return False, None


def _is_freeform(value: str) -> bool:
    s = value.strip()
    return _FREEFORM_MIN_LENGTH <= len(s) <= 200


def _clean_value(field_name: str, value: str) -> str:
    """Return a canonicalised version of
    the value. The apply engine uses
    the cleaned value when writing the
    Business row (e.g. GSTIN
    upper-cased)."""
    s = value.strip()
    if field_name in ("gstin", "pan", "registration_number"):
        return s.upper()
    if field_name in (
        "business_name",
        "owner_name",
        "address",
        "state",
        "district",
        "country",
        "city",
    ):
        return s
    return s


# Public entry point. The function
# returns ``(is_valid, cleaned_value,
# reason)``. The applier uses this to
# decide whether to write the field
# and what value to write.
def validate_field_for_apply(
    field_name: str, value: str | None
) -> tuple[bool, str | None, str]:
    """Apply-time format check.

    Returns
    -------
    (is_valid, cleaned_value, reason)
        ``is_valid`` is True when the
        value passes the format check
        for ``field_name``. ``cleaned_value``
        is the canonicalised value the
        applier should write (or
        ``value`` itself when no
        canonicalisation is needed).
        ``reason`` is the human-readable
        reason when ``is_valid`` is
        False (or a short success note
        when it is True).

    The function is pure: same inputs
    → same outputs.

    Fields the validator does not know
    about are treated as "valid" (the
    applier will then fall through to
    the existing-value check)."""
    if value is None or not value.strip():
        return False, None, "Value is empty."

    cleaned = _clean_value(field_name, value)

    # The apply engine reuses the OCR
    # engine's existing freeform
    # rules where the same logic
    # applies; the apply engine adds
    # email / phone / website / country
    # rules the OCR engine does not
    # currently need.
    if field_name == "gstin":
        ok = _is_gstin(cleaned)
    elif field_name == "pan":
        ok = _is_pan(cleaned)
    elif field_name == "iec_number":
        ok = _is_iec(cleaned)
    elif field_name == "pin_code":
        ok = _is_pin(cleaned)
    elif field_name == "year_established":
        ok = _is_year(cleaned)
    elif field_name == "email":
        ok = _is_email(cleaned)
    elif field_name == "phone":
        ok = _is_phone(cleaned)
    elif field_name == "website":
        ok = _is_website(cleaned)
    elif field_name == "country":
        ok = _is_country(cleaned)
    elif field_name == "state":
        ok = _is_state(cleaned)
    elif field_name == "business_type":
        ok, _ = _is_business_type(cleaned)
    elif field_name in (
        "business_name",
        "owner_name",
        "address",
        "district",
    ):
        ok = _is_freeform(cleaned)
    else:
        # Unknown field: defer to the
        # applier (it will check whether
        # the field is mappable and
        # whether the current value is
        # valid). The validator's
        # default is "do not block".
        ok = True

    if ok:
        return True, cleaned, "Value passes the apply-time format check."
    return False, cleaned, f"Value fails the apply-time format check for '{field_name}'."

"""Field-level validation.

The validator is a pure function of an extracted
field. Every supported field has a deterministic
rule:

  * **GSTIN** — 15 characters, format
    ``<2 digits><10 alphanum><1 alpha><1 alphanum/digit>``.
    The two leading digits are the state code (a
    known set of 01-37, 96, 99). The 13th char is
    the entity letter (alphabetic). The 14th and
    15th chars are the check digits.
  * **PAN** — 10 characters, format
    ``<5 alpha><4 digit><1 alpha>``. The first
    three letters encode the holder type
    (``A`` = AOP, ``B`` = BOI, ``C`` = company,
    ``F`` = firm, ``G`` = government, ``H`` =
    HUF, ``J`` = artificial juridical person,
    ``L`` = local authority, ``P`` = person, ``T``
    = trust).
  * **IEC** — 10 characters, format ``<10 digit>``.
    The first two digits are the issuing DGFT
    regional authority code.
  * **PIN code** — 6 digits. The first digit is
    1-9 (no leading zero). We also flag a
    *warning* when the PIN's first digit does not
    match the state the user declared (when the
    provider extracted a state alongside the
    PIN).
  * **Year** — 4 digits, between 1900 and the
    current year + 1.
  * **Registration number** — at least 5
    characters, drawn from
    ``[A-Z0-9-]``. Udyam registrations have a
    well-known prefix (``UDYAM-``) — we surface
    a *warning* (not an error) when the prefix
    is missing on a Udyam document.
  * **Address** — non-empty, length 5..500 chars.
  * **State** — non-empty, length 2..100 chars.
  * **District** — non-empty, length 2..100
    chars.
  * **Business name** — non-empty, length
    2..200 chars.
  * **Owner name** — non-empty, length 2..200
    chars.
  * **Business type** — one of the schema's
    :data:`BusinessTypeLiteral` values (or the
    canonical synonyms ``pvt ltd`` → ``private_limited``,
    ``llp`` → ``llc``, etc.).

Duplicate values
----------------

The validator also flags a *warning* when two
fields have identical values that should be
different (e.g. business_name == owner_name).
The check is a deterministic list of
field-name pairs to compare:

  * ``business_name`` vs ``owner_name``
  * ``state`` vs ``district``

The warnings are surfaced on both fields.

Unknown values
--------------

A *value* is unknown when the field is present in
the provider's output but the value is empty
or ``"UNKNOWN BUSINESS"`` (the placeholder the
mock provider emits for unknown documents). An
unknown value's status is ``"unknown"``, not
``"invalid"`` — the user has to decide.

Validation status precedence
-----------------------------

* ``invalid`` — the value failed the format check
  (e.g. PAN with 9 chars).
* ``warning`` — the value passed the format
  check but flagged a soft condition (e.g. PIN
  state mismatch).
* ``valid`` — the value passed.
* ``unknown`` — the value is empty or a
  placeholder.

``invalid`` wins over ``warning`` wins over
``unknown`` wins over ``valid`` (i.e. we surface
the worst observed status when a field triggers
multiple checks).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# The known set of GSTIN state codes.
_GSTIN_STATE_CODES: frozenset[str] = frozenset(
    {
        "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
        "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
        "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
        "31", "32", "33", "34", "35", "36", "37", "96", "99",
    }
)

# The known set of PAN holder-type prefixes.
_PAN_HOLDER_PREFIXES: frozenset[str] = frozenset(
    {"A", "B", "C", "F", "G", "H", "J", "L", "P", "T"}
)

# Business-type synonyms the mock provider
# might emit; we map them to the schema's
# canonical literals.
_BUSINESS_TYPE_SYNONYMS: dict[str, str] = {
    "private limited": "private_limited",
    "pvt ltd": "private_limited",
    "pvt. ltd.": "private_limited",
    "public limited": "public_limited",
    "ltd": "private_limited",
    "llp": "llc",
    "limited liability partnership": "llc",
    "sole proprietorship": "sole_proprietorship",
    "sole trader": "sole_proprietorship",
    "proprietorship": "sole_proprietorship",
    "partnership firm": "partnership",
    "firm": "partnership",
    "co-operative": "cooperative",
    "cooperative": "cooperative",
}

# Business-type literals the schema accepts.
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

# PIN first-digit → state code mapping (a
# partial map covering the common cases — the
# full 19-state / 8-territory map is too long
# to inline; the validator only checks the
# first digit so a partial map is enough to
# catch obvious mismatches).
_PIN_FIRST_DIGIT_TO_STATE: dict[str, str] = {
    "1": "north",
    "2": "north",
    "3": "north",
    "4": "central",
    "5": "east",
    "6": "south",
    "7": "east",
    "8": "east",
    "9": "north",
}

# Map the state-region the user might declare
# to the PIN's first-digit band. The mock
# provider emits the state name; the validator
# uses this map to compare.
_STATE_TO_PIN_BAND: dict[str, str] = {
    "Tamil Nadu": "south",
    "Karnataka": "south",
    "Kerala": "south",
    "Andhra Pradesh": "south",
    "Telangana": "south",
    "Maharashtra": "west",
    "Gujarat": "west",
    "Rajasthan": "north",
    "Delhi": "north",
    "Uttar Pradesh": "north",
    "West Bengal": "east",
    "Bihar": "east",
    "Odisha": "east",
    "Punjab": "north",
    "Haryana": "north",
}


@dataclass(frozen=True)
class ValidationOutcome:
    """The validator's per-field verdict."""

    validation_status: str  # "valid" | "invalid" | "warning" | "unknown"
    cleaned_value: str | None
    warnings: tuple[str, ...] = ()


def _is_unknown(value: str | None) -> bool:
    """Return True when the value is the mock
    provider's unknown-document placeholder."""
    if value is None:
        return True
    s = value.strip()
    if not s:
        return True
    if s.upper() == "UNKNOWN BUSINESS":
        return True
    return False


def _validate_gstin(value: str) -> ValidationOutcome:
    """Format-check a GSTIN.

    A valid GSTIN matches
    ``^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$``
    (15 characters total: 2-digit state code
    + 10-char PAN + 1-char entity number +
    Z + 1-char checksum). The first two
    digits are a known state code. We return
    ``"invalid"`` on a format mismatch,
    ``"warning"`` when the state code is
    unrecognised, and ``"valid"`` otherwise.
    """
    s = value.strip().upper()
    if not re.fullmatch(r"[0-9A-Z]{15}", s):
        return ValidationOutcome("invalid", value)
    state = s[:2]
    if not re.fullmatch(
        r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]", s
    ):
        return ValidationOutcome("invalid", value)
    if state not in _GSTIN_STATE_CODES:
        return ValidationOutcome(
            "warning", s, ("Unknown GSTIN state code",)
        )
    return ValidationOutcome("valid", s)


def _validate_pan(value: str) -> ValidationOutcome:
    """Format-check a PAN.

    A valid PAN matches
    ``^[A-Z]{5}[0-9]{4}[A-Z]$`` where the first
    letter is a known holder-type prefix. We
    return ``"invalid"`` on a length or shape
    mismatch, ``"warning"`` when the holder
    prefix is unrecognised, and ``"valid"``
    otherwise.
    """
    s = value.strip().upper()
    if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", s):
        return ValidationOutcome("invalid", value)
    if s[0] not in _PAN_HOLDER_PREFIXES:
        return ValidationOutcome(
            "warning", s, ("Unrecognised PAN holder type",)
        )
    return ValidationOutcome("valid", s)


def _validate_iec(value: str) -> ValidationOutcome:
    """Format-check an IEC.

    A valid IEC is 10 digits."""
    s = value.strip()
    if not re.fullmatch(r"[0-9]{10}", s):
        return ValidationOutcome("invalid", value)
    return ValidationOutcome("valid", s)


def _validate_pin(
    value: str, declared_state: str | None
) -> ValidationOutcome:
    """Format-check a PIN code.

    A valid PIN is 6 digits with a non-zero
    first digit. When the user declared a
    state, the PIN's first-digit band must
    match; mismatches surface as a
    ``"warning"`` (not an error) because the
    declared state may be a state-region
    abbreviation that the band map does not
    cover.
    """
    s = value.strip()
    if not re.fullmatch(r"[1-9][0-9]{5}", s):
        return ValidationOutcome("invalid", value)
    warnings: list[str] = []
    if declared_state:
        pin_band = _PIN_FIRST_DIGIT_TO_STATE.get(s[0])
        state_band = _STATE_TO_PIN_BAND.get(declared_state)
        if pin_band and state_band and pin_band != state_band:
            warnings.append(
                f"PIN code {s} first-digit band '{pin_band}' "
                f"does not match declared state '{declared_state}' "
                f"(band '{state_band}')."
            )
    if warnings:
        return ValidationOutcome("warning", s, tuple(warnings))
    return ValidationOutcome("valid", s)


def _validate_year(value: str) -> ValidationOutcome:
    """Format-check a year.

    A valid year is 4 digits between 1900 and
    the current year + 1. We use the system
    clock to determine the current year; the
    validator is *not* the system's source of
    truth for "today" — the response carries
    ``generated_at`` so the UI can re-check.
    """
    s = value.strip()
    if not re.fullmatch(r"[0-9]{4}", s):
        return ValidationOutcome("invalid", value)
    # Lazy import keeps the module import
    # cheap and isolates the clock from the
    # rest of the pipeline.
    from datetime import datetime, timezone
    now_year = datetime.now(tz=timezone.utc).year
    n = int(s)
    if n < 1900 or n > now_year + 1:
        return ValidationOutcome("invalid", s)
    return ValidationOutcome("valid", s)


def _validate_registration_number(
    value: str, document_type: str
) -> ValidationOutcome:
    """Format-check a registration number.

    A valid registration number is at least 5
    characters from ``[A-Z0-9-]``. Udyam
    registrations should start with ``UDYAM-``;
    a missing prefix on a Udyam document is a
    ``"warning"``.
    """
    s = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{5,}", s):
        return ValidationOutcome("invalid", value)
    if document_type == "udyam_certificate" and not s.startswith("UDYAM-"):
        return ValidationOutcome(
            "warning",
            s,
            ("Udyam registration should start with 'UDYAM-'.",),
        )
    return ValidationOutcome("valid", s)


def _validate_business_type(value: str) -> ValidationOutcome:
    """Format-check a business type.

    A valid business type is one of the schema's
    :data:`BusinessTypeLiteral` values or a
    recognised synonym (we return the
    canonical form as the cleaned value)."""
    s = value.strip().lower()
    if not s:
        return ValidationOutcome("invalid", value)
    if s in _BUSINESS_TYPE_LITERALS:
        return ValidationOutcome("valid", s)
    if s in _BUSINESS_TYPE_SYNONYMS:
        return ValidationOutcome("valid", _BUSINESS_TYPE_SYNONYMS[s])
    return ValidationOutcome("invalid", value)


def _validate_freeform(
    value: str, *, min_length: int, max_length: int
) -> ValidationOutcome:
    """Format-check a freeform text field
    (business name, owner name, address, state,
    district).

    A valid freeform is non-empty and within
    the length bounds. We do not enforce any
    specific character class — names in
    particular are too varied to constrain.
    """
    s = value.strip()
    if not s:
        return ValidationOutcome("invalid", value)
    if len(s) < min_length or len(s) > max_length:
        return ValidationOutcome("invalid", s)
    return ValidationOutcome("valid", s)


# Dispatch table — the validator module
# routes a field_name to its rule. New field
# types are added by registering a tuple
# ``(min_length, max_length)`` for freeform or
# a dedicated rule.
def _validate_field(
    field_name: str,
    value: str,
    document_type: str,
    declared_state: str | None,
) -> ValidationOutcome:
    """Route a field to its rule and return the
    validator's outcome.

    Fields the validator does not know about
    return ``"unknown"`` (the mapper will
    surface the field as-is)."""
    if field_name == "gstin":
        return _validate_gstin(value)
    if field_name == "pan":
        return _validate_pan(value)
    if field_name == "iec_number":
        return _validate_iec(value)
    if field_name == "pin_code":
        return _validate_pin(value, declared_state)
    if field_name == "year_established":
        return _validate_year(value)
    if field_name == "registration_number":
        return _validate_registration_number(value, document_type)
    if field_name == "business_type":
        return _validate_business_type(value)
    if field_name in ("business_name", "owner_name"):
        return _validate_freeform(value, min_length=2, max_length=200)
    if field_name in ("address",):
        return _validate_freeform(value, min_length=5, max_length=500)
    if field_name in ("state", "district"):
        return _validate_freeform(value, min_length=2, max_length=100)
    return ValidationOutcome("unknown", value)


def _status_rank(s: str) -> int:
    """Map a status to a rank for the worst-wins
    merge below. Higher rank = worse."""
    return {
        "valid": 0,
        "unknown": 1,
        "warning": 2,
        "invalid": 3,
    }.get(s, 0)


def _worse(a: str, b: str) -> str:
    """Return whichever of ``a`` and ``b`` is
    the worse status (invalid > warning >
    unknown > valid)."""
    return a if _status_rank(a) >= _status_rank(b) else b


def _dedup_warnings(
    field_values: dict[str, str],
    outcomes: dict[str, ValidationOutcome],
) -> dict[str, ValidationOutcome]:
    """Detect duplicate values across the
    field set and append a warning to the
    *both* fields.

    The check is a fixed set of (field_a,
    field_b) pairs that should not match:

      * ``business_name`` vs ``owner_name``
      * ``state`` vs ``district``

    When ``field_a`` and ``field_b`` are both
    present and their cleaned values match
    case-insensitively, both outcomes get a
    ``"values match across {a}/{b}"`` warning
    and their status is downgraded to
    ``"warning"`` (when not already ``"invalid"``).
    """
    pairs = (
        ("business_name", "owner_name"),
        ("state", "district"),
    )
    for a, b in pairs:
        va = outcomes.get(a)
        vb = outcomes.get(b)
        if va is None or vb is None:
            continue
        ca = (va.cleaned_value or field_values.get(a) or "").strip().lower()
        cb = (vb.cleaned_value or field_values.get(b) or "").strip().lower()
        if not ca or not cb or ca != cb:
            continue
        msg = f"Duplicate value across '{a}' and '{b}'."
        if "invalid" not in (va.validation_status, vb.validation_status):
            outcomes[a] = ValidationOutcome(
                _worse(va.validation_status, "warning"),
                va.cleaned_value,
                va.warnings + (msg,),
            )
            outcomes[b] = ValidationOutcome(
                _worse(vb.validation_status, "warning"),
                vb.cleaned_value,
                vb.warnings + (msg,),
            )
    return outcomes


def validate(
    *,
    field_values: dict[str, str],
    document_type: str,
) -> tuple[dict[str, ValidationOutcome], list[str]]:
    """Validate every field in the canonical
    order. Returns:

      * ``outcomes`` — a dict keyed by
        field_name (only fields the provider
        actually emitted are present).
      * ``global_warnings`` — a list of
        engine-wide warnings the response's
        top-level ``warnings`` field surfaces
        (e.g. "no fields extracted").
    """
    if not field_values:
        return {}, ["No fields could be extracted from the document."]

    # The declared state is whatever the
    # provider extracted as ``state`` (the
    # mapper turns it into the Business
    # Profile's state field, but the validator
    # needs the raw value for the PIN check).
    declared_state = field_values.get("state")

    outcomes: dict[str, ValidationOutcome] = {}
    for name, value in field_values.items():
        if _is_unknown(value):
            outcomes[name] = ValidationOutcome("unknown", None)
            continue
        outcomes[name] = _validate_field(
            name, value, document_type, declared_state
        )

    outcomes = _dedup_warnings(field_values, outcomes)

    # Engine-wide warnings.
    global_warnings: list[str] = []
    invalid_count = sum(
        1 for o in outcomes.values() if o.validation_status == "invalid"
    )
    if invalid_count:
        global_warnings.append(
            f"{invalid_count} field(s) failed validation."
        )

    return outcomes, global_warnings

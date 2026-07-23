"""Deterministic confidence scoring.

The confidence module produces three numbers, all
in 0..100:

  * ``field_confidence`` — per-field confidence.
  * ``document_confidence`` — the document-level
    confidence. It reflects how sure the engine is
    *of the document type and structure* (not the
    field values).
  * ``overall_confidence`` — the response's
    top-level rollup. It blends document and
    field confidence so the UI can show one
    "review confidence" bar.

Formula
-------

The formula is documented per-number, with the
constants inline.

``field_confidence`` (per field, 0..100):

    base = 100
    penalty_unknown = 40 if value is unknown else 0
    penalty_invalid = 60 if status == "invalid" else 0
    penalty_warning = 20 if status == "warning" else 0
    field_confidence = max(0, base - penalty_unknown
                                    - penalty_invalid
                                    - penalty_warning)

The per-field confidence is *not* a probability
the value is correct — it is a deterministic
penalty applied to a perfect score based on
the validation status. An invalid field starts
at 40 (40 points off a perfect 100); a warning
field starts at 80; an unknown field starts at
60. A valid field is 100.

``document_confidence`` (0..100):

    base = 100
    penalty_unknown_type = 70 if document_type == "unknown" else 0
    penalty_no_fields = 60 if no fields extracted else 0
    document_confidence = max(0, base - penalty_unknown_type
                                       - penalty_no_fields)

The document confidence is 30 when the document
type is unknown (the engine had to fall back to
"unknown business"); 40 when the document type
is known but the provider emitted zero fields; 100
when the document type is known and at least one
field was extracted.

``overall_confidence`` (0..100):

    field_avg = mean(field_confidence over all fields)
                if any fields, else 0
    overall = 0.3 * document_confidence
            + 0.7 * field_avg

The 30/70 weighting reflects that a review
payload's value comes from the field-level
information, not the document-type guess.
A document the engine cannot type (document=30)
but with 5 valid fields (field_avg=100) still
gets an overall of 79 — useful for the user,
even if the engine is unsure of the type.

The formula is the documented contract. It is
the *only* place confidence is computed.
"""

from __future__ import annotations


def compute_field_confidence(
    *, validation_status: str, value_is_none: bool
) -> int:
    """Return the per-field confidence in 0..100.

    The penalties are:

      * ``value_is_none`` (the provider emitted
        no value) → 40
      * ``"invalid"`` → 60
      * ``"warning"`` → 20

    ``"unknown"`` does not get a penalty beyond
    ``value_is_none`` (the status is the signal;
    a present-but-unknown value is just a None
    plus the ``"unknown"`` status). Penalties
    stack: a None+invalid value scores 0.
    """
    score = 100
    if value_is_none:
        score -= 40
    if validation_status == "invalid":
        score -= 60
    elif validation_status == "warning":
        score -= 20
    return max(0, min(100, score))


def compute_document_confidence(
    *, document_type: str, field_count: int
) -> int:
    """Return the document-level confidence in
    0..100.

    The penalties are:

      * ``"unknown"`` document type → 70
      * zero fields extracted → 60

    The two penalties stack. An unknown document
    with zero fields scores 0 — a complete miss.
    """
    score = 100
    if document_type == "unknown":
        score -= 70
    if field_count == 0:
        score -= 60
    return max(0, min(100, score))


def compute_overall_confidence(
    *, document_confidence: int, field_confidences: list[int]
) -> int:
    """Return the response's top-level rollup in
    0..100.

    The rollup is::

        overall = 0.3 * document_confidence
                + 0.7 * field_avg

    where ``field_avg`` is the mean of
    ``field_confidences`` (or 0 when the list is
    empty). The 30/70 weighting is documented
    above."""
    if not field_confidences:
        field_avg = 0
    else:
        field_avg = sum(field_confidences) / len(field_confidences)
    raw = 0.3 * document_confidence + 0.7 * field_avg
    return max(0, min(100, int(round(raw))))

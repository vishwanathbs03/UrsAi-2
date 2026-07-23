"""Small reusable predicates used by analyzers.

Analyzers are written as compositions of these helpers so each
business rule reads as a single English sentence. Keeping the
predicates in one module means tests for "is this field present"
or "is this date in the past" can be written once and reused.

Nothing here talks to the database, the network, or the request
context. Pure functions only.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Iterable


def has_text(value: str | None) -> bool:
    """A non-empty, non-whitespace string counts as present."""
    return bool(value) and value.strip() != ""


def has_collection(items: Iterable | None, *, min_length: int = 1) -> bool:
    """A collection of at least ``min_length`` items counts as present."""
    if items is None:
        return False
    try:
        return len(items) >= min_length
    except TypeError:
        return False


def has_positive_number(value: int | float | None) -> bool:
    """Strictly positive numbers are treated as 'present' for
    numeric fields (revenue, headcount, etc.). Zero is a valid
    reported value (e.g. a brand-new business) and is also
    considered present — the analyzer's job is to flag missing
    data, not empty ledgers."""
    return value is not None


def is_meaningful_number(value: int | float | None) -> bool:
    """Stricter than :func:`has_positive_number`. Used by the
    *engine* (not the wizard meta card) where the question is
    "is this business ready", not "did the user fill in a
    number". 0 is treated as a missing value: a business that
    reports 0 employees and 0 revenue has not told us anything
    actionable."""
    return value is not None and value > 0


def is_real_year(value: int | None) -> bool:
    """Year fields must be in a sensible range — 0 and 1900 are
    the SQLAlchemy / form defaults that mean "not entered"."""
    return value is not None and 1900 <= int(value) <= 2100


def is_past(date_value: date | datetime | None) -> bool:
    if date_value is None:
        return False
    cmp = date_value.date() if isinstance(date_value, datetime) else date_value
    return cmp < date.today()


def is_future(date_value: date | datetime | None) -> bool:
    if date_value is None:
        return False
    cmp = date_value.date() if isinstance(date_value, datetime) else date_value
    return cmp > date.today()


def pct(value: int | float | None) -> int:
    """Clamp a 0..1 ratio to a 0..100 integer percentage."""
    if value is None:
        return 0
    return max(0, min(100, int(round(float(value) * 100))))

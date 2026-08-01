"""Business valuation projection.

The valuation module is a thin wrapper around
:func:`app.services.finance.projections.build_valuation_projection`
that the spec calls out as a separate file
for architecture clarity.

The valuation index formula (in
``projections.py``) blends:

  * the overall business score
  * the business DNA match score
  * the profile completion percentage

The projected value adds the cumulative
score gain from completing the
recommendations, capped at +50. The result
is a 0..100 "business value index" — not a
real currency valuation (the spec says "no
real financial statements" — out of scope).
"""

from __future__ import annotations

from typing import Any

from app.services.finance.projections import build_valuation_projection


def build_valuation(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the valuation projection block."""
    return build_valuation_projection(bundle, recs_finance)

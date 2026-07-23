"""Export projection.

Thin wrapper around
:func:`app.services.finance.projections.build_export_projection`
for architecture clarity.
"""

from __future__ import annotations

from typing import Any

from app.services.finance.projections import build_export_projection


def build_exports_projection(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the export projection block."""
    return build_export_projection(bundle, recs_finance)

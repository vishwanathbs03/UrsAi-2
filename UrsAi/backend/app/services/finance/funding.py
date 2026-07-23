"""Loan-readiness funding projection.

This module is a thin wrapper around
:func:`app.services.finance.projections.build_loan_readiness`
that the spec calls out as a separate file.
The separation is for architecture clarity;
the actual computation is centralised in
``projections.py`` so the loan-readiness
formula is not duplicated in this file.

The module is importable independently for
unit tests but the service façade uses
``projections.build_loan_readiness``
directly.
"""

from __future__ import annotations

from typing import Any

from app.services.finance.projections import build_loan_readiness


def build_funding_projection(
    bundle: Any,
    recs_finance: list[dict[str, Any]],
) -> dict[str, Any]:
    """Alias for
    :func:`app.services.finance.projections.build_loan_readiness`.

    The Finance engine's funding sidecar is
    the same shape the spec calls
    "loan readiness" — the engine uses the
    spec's "funding" vocabulary in its
    internal naming and exposes the spec's
    "loan readiness" shape on the wire.
    """
    return build_loan_readiness(bundle, recs_finance)

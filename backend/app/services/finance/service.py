"""Financial ROI engine — service façade.

The façade is the *only* place the Finance
engine wires its builders together. The
endpoint depends on this class; the helpers
in the sibling modules are private to the
package.

Pipeline
--------

  owner_id
     |
     v
  Aggregator        (one-pass upstream read)
     |
     v
  FinanceBundle     (frozen view)
     |
     v
  ROI module        (per-recommendation finance)
     |
     v
  Projections       (revenue / loan / export /
                     digital / valuation)
     |
     v
  Summary           (rollup + highest-value)
     |
     v
  Inputs sidecar    (echoes upstream
                     generated_at for
                     freshness labels)
     |
     v
  Review Payload    (the API response)

The pipeline is purely deterministic: same
``owner_id`` + same database state → byte-
identical output (sans ``generated_at`` and
the upstream ``*_generated_at`` sidecar
timestamps).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.repositories.business_repository import BusinessRepository
from app.schemas.finance import FinancialImpactResponse
from app.services.finance.aggregator import FinanceAggregator
from app.services.finance import (
    exports as exports_module,
    funding as funding_module,
    projections as projections_module,
    roi as roi_module,
    summary as summary_module,
    valuation as valuation_module,
)


class FinanceService:
    """The public façade for the Financial
    ROI engine."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._aggregator = FinanceAggregator(repo)

    def compute(self, owner_id: int) -> dict[str, Any]:
        """Run the full pipeline and return a
        dict matching
        :class:`FinancialImpactResponse`.

        The endpoint validates the response
        against the Pydantic model before
        returning it to the client. Any
        unknown fields surface as 500 errors
        (Pydantic's ``extra="forbid"`` guard
        catches a future refactor that
        accidentally leaks an internal
        field)."""
        bundle = self._aggregator.collect(owner_id)

        raw_recommendations = (
            bundle.recommendations.get("recommendations") or []
        )

        # Per-recommendation finance view.
        recs_finance = roi_module.build_recommendation_finance_list(
            raw_recommendations
        )

        # Projections.
        revenue_projection = projections_module.build_revenue_projection(
            bundle, recs_finance
        )
        loan_readiness = funding_module.build_funding_projection(
            bundle, recs_finance
        )
        export_projection = exports_module.build_exports_projection(
            bundle, recs_finance
        )
        digital_projection = projections_module.build_digital_projection(
            bundle, recs_finance
        )
        valuation_projection = valuation_module.build_valuation(
            bundle, recs_finance
        )

        # Summary.
        summary = summary_module.build_summary(bundle, recs_finance)

        # Inputs sidecar.
        inputs = self._build_inputs_sidecar(
            bundle, raw_recommendations
        )

        response = {
            "generated_at": _now_iso(),
            "inputs": inputs,
            "summary": summary,
            "recommendations": recs_finance,
            "roi_analysis": summary,  # alias (spec lists both)
            "revenue_projection": revenue_projection,
            "loan_readiness": loan_readiness,
            "export_projection": export_projection,
            "digital_projection": digital_projection,
            "valuation_projection": valuation_projection,
        }
        # Validate against the schema so a
        # refactor that accidentally leaks
        # a field fails loudly here, not at
        # the client.
        FinancialImpactResponse.model_validate(response)
        return response

    # ---- Inputs sidecar ------------------------------------------- #

    def _build_inputs_sidecar(
        self,
        bundle: Any,
        raw_recommendations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Echo the upstream ``generated_at``
        timestamps so the UI can render
        freshness labels.

        All values are lifted verbatim from
        the bundle — the Finance engine
        computes nothing new here.
        """
        business = bundle.business or {}
        meta = business.get("meta", {}) or {}
        last_updated = meta.get("last_updated")
        # Pydantic dumps datetimes as datetime
        # objects; the Finance engine's
        # schema expects strings. We
        # ISO-format on the way out.
        if last_updated is not None and not isinstance(last_updated, str):
            last_updated = last_updated.isoformat()
        return {
            "business_id": bundle.business_id,
            "owner_id": bundle.owner_id,
            "business_generated_at": last_updated,
            "intelligence_generated_at": (
                bundle.intelligence.get("generated_at")
            ),
            "scores_generated_at": (
                bundle.scores.get("generated_at")
            ),
            "dna_generated_at": (
                bundle.dna.get("generated_at")
            ),
            "rules_generated_at": None,
            "recommendations_generated_at": (
                bundle.recommendations.get("generated_at")
            ),
            "roadmap_generated_at": (
                bundle.roadmap.get("generated_at")
            ),
            "twin_generated_at": (
                bundle.twin.get("generated_at")
            ),
            "recommendations_count": len(raw_recommendations),
            "roadmap_items_count": len(
                bundle.roadmap.get("items", []) or []
            ),
        }


def _now_iso() -> str:
    """Return the current UTC time as an
    ISO-8601 string. The response carries
    this as ``generated_at``; the
    determinism contract excludes it from
    the two-call diff."""
    return (
        datetime.now(tz=timezone.utc)
        .isoformat(timespec="microseconds")
    )

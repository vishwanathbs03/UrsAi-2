"""Roadmap Engine — service façade.

This is the *only* place the Roadmap Engine wires its
helpers together. The endpoint depends on this class; the
helpers in the sibling modules are private to the package.

Architecture
------------

The engine is a **build-on-top** layer. Its single input
is the Recommendation Engine's response. It also reads
the upstream Intelligence, Scores, and DNA services
*directly* to compute the projection baselines, but it
does not re-derive any signal — every number on the
roadmap traces back to either:

  * a recommendation field (lifted verbatim), or
  * a current value from the existing service modules
    (read once, not re-computed).

The engine does NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify the Recommendation Engine or any other
    upstream service

Determinism contract
--------------------

Two calls with the same ``owner_id`` and the same
database state must produce byte-identical roadmaps
(sans the response envelope's ``generated_at`` and the
upstream ``*_generated_at`` sidecar timestamps). The
planner is a deterministic topological sort, the
timeline is a deterministic function of items, and
the projections are deterministic functions of the
current values + the item list.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.services.recommendations import RecommendationService
from app.services.roadmap.base import (
    Phase,
    Priority,
    RecommendationView,
    RoadmapBundle,
    RoadmapProjections,
    RoadmapSummary,
)
from app.services.roadmap.planner import attach_unlocks, plan
from app.services.roadmap.projections import (
    build_projections,
    current_dna_match_score,
    current_lens_score,
    current_overall_score,
    current_profile_completion,
)
from app.services.roadmap.summary import build_summary


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #


class RoadmapService:
    """Generate the execution roadmap for the authenticated
    user's business profile.

    The service is constructed with a
    :class:`BusinessRepository` so it can be unit-tested
    with an in-memory session. The endpoint is the only
    other caller.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        # Build-on-top: the only analytics entry point is
        # the Recommendation Engine. The Roadmap Engine
        # pulls scores / DNA / intelligence directly for
        # the *current* values used in the projection
        # baseline.
        self._recommendations = RecommendationService(repo)
        # Lazy import to avoid a circular dependency
        # through the recommendations service's own
        # scoring/intelligence/dna deps.
        from app.services.dna import BusinessDNAService
        from app.services.intelligence import IntelligenceService
        from app.services.scoring import BusinessScoreService

        self._intelligence = IntelligenceService(repo)
        self._scoring = BusinessScoreService(repo)
        self._dna = BusinessDNAService(repo)

    # ---- Public API ---------------------------------------------------- #

    def compute(self, owner_id: int) -> dict:
        """Run the engine and return the response envelope.

        Raises :class:`BusinessNotFound` when the user has
        not created a business profile yet. The endpoint
        translates that into a 404.
        """
        if self._repo.get_by_owner(owner_id) is None:
            raise BusinessNotFound("No business profile to evaluate.")

        # 1.  Pull the upstream payloads. Each call goes
        #     through the existing service module — no
        #     parallel re-derivation.
        recs_payload = self._recommendations.compute(owner_id)
        scores_payload = self._scoring.compute(owner_id)
        intel_payload = self._intelligence.analyze(owner_id)
        dna_payload = self._dna.compute(owner_id)

        # 2.  Flatten the recommendations into the
        #     read-only RecommendationView list.
        views = _flatten_recommendations(recs_payload)
        views_by_id = {v.id: v for v in views}

        # 3.  Plan: topological-sorted list of
        #     RoadmapItem records, monotonic start_order.
        items = plan(views)
        items = attach_unlocks(items)

        # 4.  Projections: read the CURRENT values from
        #     the upstream services and apply the
        #     deterministic transforms.
        projections = build_projections(
            current_overall=current_overall_score(scores_payload),
            current_profile=current_profile_completion(intel_payload),
            current_dna=current_dna_match_score(dna_payload),
            current_export=current_lens_score(scores_payload, "export"),
            current_digital=current_lens_score(scores_payload, "digital"),
            current_growth=current_lens_score(scores_payload, "growth"),
            items=items,
            views_by_id=views_by_id,
        )

        # 5.  Summary rollup.
        summary = build_summary(items, projections)

        # 6.  Stitch the response envelope. The roadmap
        #     service exposes a small bundle; the
        #     endpoint converts the bundle into the
        #     Pydantic response.
        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "inputs": {
                "recommendations_generated_at": recs_payload.get("generated_at"),
                "rules_generated_at": (recs_payload.get("inputs") or {}).get(
                    "rules_generated_at"
                ),
                "intelligence_generated_at": (recs_payload.get("inputs") or {}).get(
                    "intelligence_generated_at"
                ),
                "scores_generated_at": (recs_payload.get("inputs") or {}).get(
                    "scores_generated_at"
                ),
                "dna_generated_at": (recs_payload.get("inputs") or {}).get(
                    "dna_generated_at"
                ),
            },
            "summary": summary.to_payload(),
            "items": [i.to_payload() for i in items],
        }


# --------------------------------------------------------------------------- #
# Internal
# --------------------------------------------------------------------------- #


def _flatten_recommendations(recs_payload: dict) -> tuple[RecommendationView, ...]:
    """Convert the Recommendation Engine's response into a
    tuple of :class:`RecommendationView` for the helpers.

    The conversion is tolerant: a single malformed
    recommendation is dropped rather than failing the
    whole plan. The recommendation shape is documented
    in :mod:`app.schemas.recommendation`; the conversion
    is the only place that knows the wire format.
    """
    out: list[RecommendationView] = []
    for r in (recs_payload.get("recommendations") or []):
        try:
            out.append(
                RecommendationView(
                    id=str(r["id"]),
                    title=str(r.get("title", "")),
                    category=str(r.get("category", "")),
                    priority=_coerce_priority(r.get("priority")),
                    phase=_coerce_phase(r.get("phase")),
                    business_impact=int(r.get("business_impact", 0) or 0),
                    estimated_score_gain=float(
                        r.get("estimated_score_gain", 0) or 0
                    ),
                    estimated_roi=int(r.get("estimated_roi", 0) or 0),
                    estimated_cost=int(r.get("estimated_cost", 0) or 0),
                    estimated_timeline=str(r.get("estimated_timeline", "")),
                    difficulty=str(r.get("difficulty", "")),
                    confidence=int(r.get("confidence", 0) or 0),
                    dependencies=tuple(r.get("dependencies", ()) or ()),
                    related_score_keys=tuple(
                        r.get("related_score_keys", ()) or ()
                    ),
                    related_intelligence_keys=tuple(
                        r.get("related_intelligence_keys", ()) or ()
                    ),
                    projected_dna_effect=str(r.get("projected_dna_effect", "")),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return tuple(out)


def _coerce_priority(value: object) -> Priority:
    """Coerce the upstream priority string into a
    :data:`Priority` literal. Unknown values fall back
    to ``"Low"`` so the planner still runs.
    """
    if value in ("Critical", "High", "Medium", "Low"):
        return value  # type: ignore[return-value]
    return "Low"


def _coerce_phase(value: object) -> Phase:
    """Coerce the upstream phase string into a
    :data:`Phase` literal. Unknown values fall back to
    ``"Medium-Term"`` so the planner still runs.
    """
    if value in ("Immediate", "Short-Term", "Medium-Term", "Long-Term"):
        return value  # type: ignore[return-value]
    return "Medium-Term"

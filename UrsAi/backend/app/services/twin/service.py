"""Digital Twin engine — service façade.

This is the *only* place the Twin engine wires its
helpers together. The endpoint depends on this
class; the helpers in the sibling modules are
private to the package.

Architecture
------------

The engine is a **build-on-top** layer that consumes
the existing services. It does NOT:

  * call an LLM or any external model
  * touch the database
  * mutate any user state
  * introduce a new ORM model
  * modify any existing service
  * duplicate any recommendation / roadmap /
    scoring / DNA logic

The flow per request is:

  1. Read every upstream engine's payload via
     :class:`TwinAggregator`.
  2. Build the snapshot blocks (identity, profile,
     DNA, scores, intelligence, rules,
     recommendations, roadmap, current health,
     risk overview, growth potential, digital /
     export / compliance / scenario readiness).
  3. Build the four timeline projections (current,
     3m, 6m, 12m).
  4. Build the risk matrix (Critical / High /
     Medium / Resolved / Emerging).
  5. Build the opportunity matrix (Quick Wins /
     Strategic / Long-Term / Export / Digital /
     Funding).
  6. Build the health summary (11 readiness scores,
     all 0..100).
  7. Stitch the response envelope and stamp
     ``generated_at`` + ``last_analysis_at``.

Determinism contract
--------------------

Two calls with the same ``owner_id`` and the same
database state must produce byte-identical twin
payloads (sans the response envelope's
``generated_at``). The builders are pure functions
of the bundle; the aggregator is a pure function of
the database state.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.services.twin import (
    health as health_module,
    opportunity_matrix as opportunity_module,
    risk_matrix as risk_module,
    snapshot as snapshot_module,
    timeline as timeline_module,
)
from app.services.twin.aggregator import TwinAggregator
from app.services.twin.base import TwinBundle


class TwinService:
    """Generate the Digital Twin for the
    authenticated user's business profile.

    The service is constructed with a
    :class:`BusinessRepository` so it can be
    unit-tested with an in-memory session. The
    endpoint is the only other caller.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._aggregator = TwinAggregator(repo)

    # ---- Public API ---------------------------------------------------- #

    def compute(self, owner_id: int) -> dict:
        """Build the full Digital Twin response and
        return the dict that the Pydantic schema
        will validate.

        Raises :class:`BusinessNotFound` when the
        user has not created a business profile
        yet. The endpoint translates that into a
        404.
        """
        bundle = self._aggregator.collect(owner_id)

        # ---- Snapshot --------------------------------- #
        identity = snapshot_module.build_identity(bundle.business)
        profile = snapshot_module.build_profile(bundle.business)
        dna = snapshot_module.build_dna(bundle.dna)
        scores = snapshot_module.build_scores(bundle.scores)
        intelligence = snapshot_module.build_intelligence(bundle.intelligence)
        rules = snapshot_module.build_rules(bundle.rules)
        recs = snapshot_module.build_recommendations(bundle.recommendations)
        roadmap = snapshot_module.build_roadmap(bundle.roadmap)

        # The rule counts and top risk id are
        # internal helpers (the Pydantic rules
        # block rejects unknown keys). The
        # service façade reads them off the
        # separate internal echo the snapshot
        # module produced.
        rules_internal = snapshot_module._rules_internal_echo(rules)

        # The timeline / opportunity modules need
        # the *raw* recommendations list (with
        # ``related_score_keys`` and
        # ``related_intelligence_keys`` still
        # present). The snapshot's
        # ``recommendations`` block trims those
        # fields out, so we read them directly off
        # the bundle.
        raw_recommendations = (
            bundle.recommendations.get("recommendations") or []
        )

        # The timeline annotates roadmap items with
        # ``_touches_*`` flags before the
        # projection. The annotations are pure
        # metadata; the API response does not
        # surface them, so we build a parallel
        # annotated list (rather than mutating
        # the items the snapshot module
        # produced).
        annotated_items = timeline_module.annotate_items_for_lens_targeting(
            roadmap.get("items") or [],
            raw_recommendations,
        )
        annotated_roadmap = {
            **roadmap,
            "items": annotated_items,
        }

        current_health = snapshot_module.build_current_health(
            bundle, dna, scores, rules, recs
        )
        risk_overview = snapshot_module.build_risk_overview(
            {**rules, **rules_internal}
        )
        growth_potential = snapshot_module.build_growth_potential(recs, roadmap)
        digital_maturity = snapshot_module.build_digital_maturity(profile)
        export_readiness = snapshot_module.build_export_readiness(profile, scores)
        compliance_readiness = snapshot_module.build_compliance_readiness(
            profile, scores
        )
        scenario_readiness = snapshot_module.build_scenario_readiness(recs, roadmap)

        # ---- Timeline + risk + opportunity + health -- #
        timeline = timeline_module.build_timeline(
            current_scores=scores,
            roadmap_block=annotated_roadmap,
        )
        risk_matrix = risk_module.build_risk_matrix(
            rules_block=rules,
            recs_block=recs,
        )
        opportunity_matrix = opportunity_module.build_opportunity_matrix(
            recs_block=recs,
            roadmap_block=roadmap,
            recommendations_raw=raw_recommendations,
        )
        health = health_module.build_health_summary(
            scores_block=scores,
            dna_block=dna,
            profile_block=profile,
        )

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "last_analysis_at": bundle.last_analysis_at,
            "identity": identity,
            "profile": profile,
            "dna": dna,
            "scores": scores,
            "intelligence": intelligence,
            "rules": rules,
            "recommendations": recs,
            "roadmap": roadmap,
            "current_health": current_health,
            "risk_overview": risk_overview,
            "growth_potential": growth_potential,
            "digital_maturity": digital_maturity,
            "export_readiness": export_readiness,
            "compliance_readiness": compliance_readiness,
            "scenario_readiness": scenario_readiness,
            "timeline": timeline,
            "risk_matrix": risk_matrix,
            "opportunity_matrix": opportunity_matrix,
            "health_summary": health,
            "overall_twin_health": health["overall_health"],
        }

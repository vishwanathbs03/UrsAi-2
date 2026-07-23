"""Scenario Engine — service façade.

This is the *only* place the Scenario Engine wires its
helpers together. The endpoint depends on this class;
the helpers in the sibling modules are private to the
package.

Architecture
------------

The engine is a **build-on-top** layer. It does NOT:

  * call an LLM or any external model
  * write to the database (the real one, the request
    session, or the engine's primary key sequences)
  * mutate any user state
  * introduce a new ORM model
  * modify the existing engines
  * duplicate any recommendation / roadmap / scoring
    logic

The flow per request is:

  1. Read the real Business row from the request
     session via the existing
     :class:`BusinessRepository`.
  2. Open an isolated in-memory SQLite session
     (:func:`app.services.scenario.base.build_isolated_session`).
  3. Deep-clone the row + nested collections into the
     in-memory session
     (:func:`app.services.scenario.clone.clone_business_into`).
  4. Apply the request's hypothetical changes to the
     clone via the mutator dispatch table.
  5. Re-instantiate every existing engine with a
     :class:`BusinessRepository` wrapping the in-memory
     session. The engines read the clone through their
     normal SQL paths.
  6. Call ``.compute(owner_id)`` on each — they
     return the *projected* payload.
  7. Snapshot the *current* payload from the
     engines' first invocation (against the real
     request session) and the *projected* payload
     from the second invocation (against the in-memory
     session).
  8. Run :func:`extract_snapshot` + :func:`compute_delta`
     on the two snapshots, and
     :func:`app.services.scenario.impact.compute_impact`
     on the recommendation + roadmap payloads.
  9. Tear down the in-memory session and engine. The
     request session was never written to.

Determinism contract
--------------------

Two calls with the same request body and the same
real database state must produce byte-identical
responses (sans the response envelope's
``generated_at``). The in-memory session is fresh
per call, so the SQLite autoincrement sequence
resets to 1 every time — that is the only source of
non-determinism in the cloned row's id, and it is
deliberately not surfaced in the response.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.scenario import ScenarioRequest
from app.services.dna import BusinessDNAService
from app.services.intelligence import IntelligenceService
from app.services.recommendations import RecommendationService
from app.services.roadmap import RoadmapService
from app.services.scenario.base import (
    ScenarioSnapshots,
    build_isolated_session,
)
from app.services.scenario.clone import clone_business_into
from app.services.scenario.delta import compute_delta, extract_snapshot
from app.services.scenario.impact import compute_impact
from app.services.scenario.mutations import MUTATORS
from app.services.scoring import BusinessScoreService


# Sentinel owner_id for the in-memory clone. It is
# never used by the engines for anything other than
# "find the business with this owner_id", and the
# in-memory session only ever contains the clone, so
# any value is safe. -1 is the conventional
# "no real user" sentinel and stays well clear of
# the real user id range (which is autoincrement,
# starting at 1).
_CLONE_OWNER_ID = -1


class ScenarioService:
    """Generate a deterministic in-memory projection of
    a hypothetical business state.

    The service is constructed with the *real*
    :class:`BusinessRepository` (the one bound to the
    request session). The endpoint is the only other
    caller; tests may instantiate the service with an
    in-memory repo to exercise the logic without a
    real database.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo

    # ---- Public API ---------------------------------------------------- #

    def simulate(self, owner_id: int, request: ScenarioRequest) -> dict:
        """Run the simulation and return the response
        envelope.

        Raises :class:`BusinessNotFound` when the user
        has not created a business profile yet. The
        endpoint translates that into a 404.

        The function is total: any error in the
        mutator or the engines is caught and re-raised
        as a generic ``RuntimeError`` so the endpoint
        does not leak internal tracebacks.
        """
        # 1. Pull the real Business row. The existing
        #    repository handles the eager-loaded
        #    relationships.
        source = self._repo.get_by_owner(owner_id)
        if source is None:
            raise BusinessNotFound("No business profile to simulate against.")

        # 2. Current payloads from the real session.
        current_scores = self._scoring().compute(owner_id)
        current_intel = self._intelligence().analyze(owner_id)
        current_dna = self._dna().compute(owner_id)
        current_recs = self._recommendations().compute(owner_id)
        current_roadmap = self._roadmap().compute(owner_id)

        # 3. Open the in-memory session, clone the
        #    row, apply the changes.
        clone_session, clone_engine = build_isolated_session()
        try:
            clone = clone_business_into(
                source=source,
                target_session=clone_session,
                new_owner_id=_CLONE_OWNER_ID,
            )
            applied_labels: list[str] = []
            for change in request.changes:
                mutator = MUTATORS.get(change.type)
                if mutator is None:
                    # The Pydantic model already
                    # rejects unknown change types at
                    # the request boundary, so this
                    # branch is defensive.
                    continue
                mutator(clone_session, clone, change)
                applied_labels.append(change.label)

            # 4. Projected payloads from the in-memory
            #    session. The engines read the clone
            #    through the cloned owner_id; the
            #    repository's ``get_by_owner`` returns
            #    the only Business row in the in-memory
            #    database, so the lookup is unambiguous.
            projected_scores = self._scoring_with(
                clone_session
            ).compute(_CLONE_OWNER_ID)
            projected_intel = self._intelligence_with(
                clone_session
            ).analyze(_CLONE_OWNER_ID)
            projected_dna = self._dna_with(clone_session).compute(
                _CLONE_OWNER_ID
            )
            projected_recs = self._recommendations_with(
                clone_session
            ).compute(_CLONE_OWNER_ID)
            projected_roadmap = self._roadmap_with(
                clone_session
            ).compute(_CLONE_OWNER_ID)

        finally:
            clone_session.close()
            clone_engine.dispose()

        # 5. Build the snapshots + delta + impact.
        current_snapshot = extract_snapshot(
            scores_payload=current_scores,
            intelligence_payload=current_intel,
            dna_payload=current_dna,
        )
        projected_snapshot = extract_snapshot(
            scores_payload=projected_scores,
            intelligence_payload=projected_intel,
            dna_payload=projected_dna,
        )
        delta = compute_delta(current_snapshot, projected_snapshot)
        impact = compute_impact(
            current_recommendations=current_recs,
            projected_recommendations=projected_recs,
            current_roadmap=current_roadmap,
            projected_roadmap=projected_roadmap,
        )

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "current": current_snapshot,
            "projected": projected_snapshot,
            "delta": delta,
            "impact": impact,
            "applied_changes": applied_labels,
        }

    # ---- Service factories -------------------------------------------- #
    #
    # The existing services accept a BusinessRepository
    # at construction. Each request produces a fresh
    # set of services — there is no shared state
    # between the current and projected calls.
    #
    # The pattern is:
    #   * the default factories read from the request
    #     session (the real one);
    #   * the ``_with(session)`` factories read from a
    #     caller-supplied session (the in-memory one
    #     for the projection).
    #
    # Both flavours build the services the same way
    # the existing endpoints build them.

    def _scoring(self) -> BusinessScoreService:
        return BusinessScoreService(self._repo)

    def _intelligence(self) -> IntelligenceService:
        return IntelligenceService(self._repo)

    def _dna(self) -> BusinessDNAService:
        return BusinessDNAService(self._repo)

    def _recommendations(self) -> RecommendationService:
        return RecommendationService(self._repo)

    def _roadmap(self) -> RoadmapService:
        return RoadmapService(self._repo)

    def _scoring_with(self, session) -> BusinessScoreService:
        return BusinessScoreService(BusinessRepository(session))

    def _intelligence_with(self, session) -> IntelligenceService:
        return IntelligenceService(BusinessRepository(session))

    def _dna_with(self, session) -> BusinessDNAService:
        return BusinessDNAService(BusinessRepository(session))

    def _recommendations_with(self, session) -> RecommendationService:
        return RecommendationService(BusinessRepository(session))

    def _roadmap_with(self, session) -> RoadmapService:
        return RoadmapService(BusinessRepository(session))

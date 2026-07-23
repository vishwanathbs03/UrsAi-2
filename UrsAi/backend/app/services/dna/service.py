"""Business DNA Engine — façade that wires the components together
and produces a single :class:`BusinessDNA`.

The service is intentionally thin: it owns no scoring or
classification rules. It composes:

  1. :mod:`app.services.dna.signal_extractor` — flatten the
     intelligence + score payloads into a signal table
  2. :mod:`app.services.dna.archetypes` — pick the top-scoring
     archetype + record the runner-up
  3. :mod:`app.services.dna.traits` — detect the five secondary
     traits
  4. :mod:`app.services.dna.swot` — compose the four SWOT lists
  5. :mod:`app.services.dna.confidence` — compute the confidence
     score

The whole engine is pure: same signals in, same DNA out. There
is no AI, no LLM, no rule-engine infrastructure. Adding a new
archetype means adding a function in :mod:`archetypes` and
registering it in ``ALL_ARCHETYPES`` — no dispatcher to update.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.services.dna.archetypes import ALL_ARCHETYPES
from app.services.dna.base import (
    Archetype,
    BusinessDNA,
    Finding,
    Rationale,
    SecondaryTrait,
)
from app.services.dna.confidence import compute_confidence
from app.services.dna.signal_extractor import SignalMap, extract
from app.services.dna.swot import compose_swot
from app.services.dna.traits import ALL_TRAITS
from app.services.intelligence import IntelligenceService
from app.services.scoring import BusinessScoreService


class BusinessDNAService:
    """Generate the Business DNA for the authenticated user's profile.

    Constructed with a :class:`BusinessRepository` so it can be
    unit-tested with an in-memory session.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._intelligence = IntelligenceService(repo)
        self._scoring = BusinessScoreService(repo)

    def compute(self, owner_id: int) -> dict:
        # Resolve business first so 404 is raised before we do
        # any analysis work.
        if self._repo.get_by_owner(owner_id) is None:
            raise BusinessNotFound("No business profile to analyze.")

        intelligence = self._intelligence.analyze(owner_id)
        scores = self._scoring.compute(owner_id)
        sig: SignalMap = extract(intelligence=intelligence, scores=scores)

        archetype = self._classify(sig)
        traits = self._detect_traits(sig)
        strengths, weaknesses, opportunities, risks = compose_swot(sig)
        confidence, confidence_rationale = compute_confidence(archetype, sig)

        dna = BusinessDNA(
            archetype=archetype,
            secondary_traits=traits,
            strengths=strengths,
            weaknesses=weaknesses,
            opportunities=opportunities,
            risk_areas=risks,
            confidence=confidence,
            confidence_rationale=confidence_rationale,
        )
        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "inputs": {
                "intelligence_generated_at": intelligence.get("generated_at"),
                "scores_generated_at": scores.get("generated_at"),
            },
            "dna": dna.to_payload(),
        }

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    def _classify(self, sig: SignalMap) -> Archetype:
        """Score every archetype, pick the top, record runner-up."""
        scored: list[tuple[int, Any, list[Rationale]]] = []
        for defn in ALL_ARCHETYPES:
            try:
                ms = int(defn.scorer(sig))
            except Exception:  # pragma: no cover — defensive
                ms = 0
            scored.append((ms, defn, defn.explainer(sig)))

        # Sort by match score descending; stable order preserves
        # the registry order as the tie-break.
        scored.sort(key=lambda t: t[0], reverse=True)

        top_score, top_defn, top_rationale = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else 0

        return Archetype(
            key=top_defn.key,
            title=top_defn.title,
            description=top_defn.description,
            match_score=max(0, min(100, top_score)),
            rationale=top_rationale,
            runner_up_key=scored[1][1].key if len(scored) > 1 else None,
            runner_up_score=second_score,
        )

    def _detect_traits(self, sig: SignalMap) -> list[SecondaryTrait]:
        """Run every trait detector and return the results."""
        results: list[SecondaryTrait] = []
        for trait in ALL_TRAITS:
            try:
                present, strength, rationale = trait.detector(sig)
            except Exception:  # pragma: no cover
                present, strength, rationale = False, 0, []
            results.append(SecondaryTrait(
                key=trait.key,
                title=trait.title,
                present=bool(present),
                strength=max(0, min(100, int(strength))),
                rationale=rationale,
            ))
        return results

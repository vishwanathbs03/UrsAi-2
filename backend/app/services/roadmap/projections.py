"""Projected business metrics.

The Roadmap Engine produces six *projected* numbers:

  1. ``projected_business_score``        — the user's
     overall business score after every item in the plan
     has been completed.
  2. ``projected_profile_completion``    — the user's
     profile completeness after the plan.
  3. ``projected_business_dna_shift``    — the maximum
     potential DNA archetype match-score lift the plan
     could produce. (Direction is always "up" — the
     plan cannot reduce a DNA match score.)
  4. ``projected_export_readiness``      — projected
     Export Readiness score.
  5. ``projected_digital_readiness``     — projected
     Digital Readiness score.
  6. ``projected_growth_readiness``      — projected
     Growth Readiness score.

Determinism
-----------

Every projection is a deterministic function of the
upstream *current* values (read from the existing
``scoring_service.compute()`` and
``dna_service.compute()`` payloads) plus the
:class:`RoadmapItem` list. There is no LLM, no
sampling, no scenario simulator. The values are
**clamped** to 0..100 at the boundary so the API
contract cannot be violated.

The Roadmap Engine does **not** re-derive scores. It
reads the current values from the upstream services
verbatim and applies a deterministic "what would
happen if every item in the plan were completed"
transform.
"""

from __future__ import annotations

from app.services.roadmap.base import (
    RecommendationView,
    RoadmapItem,
    RoadmapProjections,
)


# --------------------------------------------------------------------------- #
# Helpers — pull current values out of the upstream payloads
# --------------------------------------------------------------------------- #


def current_overall_score(scores_payload: dict) -> int:
    """Return the user's current overall business score.

    The upstream scoring service exposes the headline
    number as ``summary.score``. Fall back to 0 when
    the summary is missing (defensive).
    """
    summary = scores_payload.get("summary") or {}
    return _clamp(int(summary.get("score", 0) or 0))


def current_lens_score(scores_payload: dict, lens: str) -> int:
    """Return the user's current score for one lens.

    The lens keys are ``"export"``, ``"digital"``,
    ``"growth"`` (matching the upstream Business
    Score Engine). If the lens is missing from the
    payload (a very fresh business with no scores
    yet), return 0.
    """
    for s in (scores_payload.get("scores") or []):
        if s.get("key") == lens:
            return _clamp(int(s.get("score", 0) or 0))
    return 0


def current_profile_completion(intelligence_payload: dict) -> int:
    """Return the user's current profile completeness.

    The intelligence service exposes profile
    completeness as the ``profile_completeness`` analyzer
    score. Fall back to 0 if it is missing.
    """
    for a in (intelligence_payload.get("analyzers") or []):
        if a.get("key") == "profile_completeness":
            return _clamp(int(a.get("score", 0) or 0))
    return 0


def current_dna_match_score(dna_payload: dict) -> int:
    """Return the user's current DNA archetype match
    score.

    The DNA service exposes it as
    ``dna.archetype.match_score``. Fall back to 0.
    """
    inner = dna_payload.get("dna") or dna_payload
    archetype = inner.get("archetype") or {}
    return _clamp(int(archetype.get("match_score", 0) or 0))


# --------------------------------------------------------------------------- #
# Projections
# --------------------------------------------------------------------------- #


def project_business_score(
    current: int,
    items: tuple[RoadmapItem, ...],
) -> int:
    """Project the overall business score.

    Formula:
        lift = sum(item.expected_score_improvement for item in items)
        projected = clamp(current + lift, 0, 100)

    The per-item score gain is bounded at 25 in the
    upstream engine, so the total lift is bounded by
    ``25 * len(items)`` (and the projected value is
    still capped at 100).
    """
    lift = sum(float(i.expected_score_improvement) for i in items)
    return _clamp(int(round(current + lift)))


def project_profile_completion(
    current: int,
    items: tuple[RoadmapItem, ...],
) -> int:
    """Project the profile completion score.

    Only items in the ``immediate_actions`` or
    ``medium_priority`` categories that touch the
    profile-completeness intelligence key contribute
    to profile completion. We approximate the lift
    per such item as ``business_impact * 0.5`` — the
    upstream ``business_impact`` is the severity of
    the gap, so a high-impact profile-completeness
    item should produce a proportionally larger lift.

    Items that don't touch profile completeness
    contribute zero. The total lift is capped at the
    distance to 100.
    """
    lift = 0.0
    for it in items:
        # The RoadmapItem itself does not carry the
        # category or the source-key list — those are
        # upstream concerns. The service façade passes
        # the matching RecommendationView list to the
        # projection step in the dedicated function
        # below; this version is the *fallback* that
        # returns the current value if no views are
        # available (so unit tests can call it).
        pass
    return _clamp(int(round(current + lift)))


def project_profile_completion_from_views(
    current: int,
    items: tuple[RoadmapItem, ...],
    views_by_id: dict[str, RecommendationView],
) -> int:
    """Project profile completion when the upstream
    recommendation views are available. See
    :func:`project_profile_completion` for the
    contract.
    """
    lift = 0.0
    for it in items:
        view = views_by_id.get(it.recommendation_id)
        if view is None:
            continue
        if view.category in ("immediate_actions", "medium_priority") and any(
            k.startswith("intelligence.profile_completeness")
            for k in view.related_intelligence_keys
        ):
            lift += view.business_impact * 0.5
    return _clamp(int(round(current + lift)))


def project_dna_shift(
    current: int,
    items: tuple[RoadmapItem, ...],
) -> int:
    """Project the DNA archetype match-score lift.

    The DNA engine can only increase the user's match
    score (the plan cannot reduce a DNA match). The
    lift is the *upper bound* — a sum over the items
    weighted by their business impact — capped at the
    distance to 100.

    Formula:
        lift = sum(int(item.expected_business_impact * 0.4) for item in items)
        shift = clamp(lift, 0, 100 - current)

    A ``business_impact`` of 100 contributes up to 40
    points of DNA match lift. A realistic plan with
    20 high-impact items can comfortably saturate
    this projection.
    """
    lift = sum(int(i.expected_business_impact * 0.4) for i in items)
    shift = _clamp(lift, 0, 100 - current)
    return shift


def project_lens_score(
    current: int,
    items: tuple[RoadmapItem, ...],
    views_by_id: dict[str, RecommendationView],
    lens: str,
) -> int:
    """Project one readiness lens score.

    Only items whose ``related_score_keys`` contain
    ``f"score.{lens}"`` contribute to that lens. The
    per-item lift is the item's
    ``expected_score_improvement`` (already in 0..25).

    Formula:
        lift = sum(item.expected_score_improvement for lens-touching items)
        projected = clamp(current + lift, 0, 100)
    """
    lens_key = f"score.{lens}"
    lift = 0.0
    for it in items:
        view = views_by_id.get(it.recommendation_id)
        if view is None:
            continue
        if any(k == lens_key for k in view.related_score_keys):
            lift += float(it.expected_score_improvement)
    return _clamp(int(round(current + lift)))


# --------------------------------------------------------------------------- #
# Aggregate
# --------------------------------------------------------------------------- #


def build_projections(
    *,
    current_overall: int,
    current_profile: int,
    current_dna: int,
    current_export: int,
    current_digital: int,
    current_growth: int,
    items: tuple[RoadmapItem, ...],
    views_by_id: dict[str, RecommendationView],
) -> RoadmapProjections:
    """Compute every projection in a single pass. The
    result is the dataclass the API serialises."""
    return RoadmapProjections(
        projected_business_score=project_business_score(current_overall, items),
        projected_profile_completion=project_profile_completion_from_views(
            current_profile, items, views_by_id
        ),
        projected_business_dna_shift=project_dna_shift(current_dna, items),
        projected_export_readiness=project_lens_score(
            current_export, items, views_by_id, "export"
        ),
        projected_digital_readiness=project_lens_score(
            current_digital, items, views_by_id, "digital"
        ),
        projected_growth_readiness=project_lens_score(
            current_growth, items, views_by_id, "growth"
        ),
    )


# --------------------------------------------------------------------------- #
# Internal
# --------------------------------------------------------------------------- #


def _clamp(n: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, int(n)))

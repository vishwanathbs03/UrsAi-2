"""Delta analysis for the Scenario Engine.

The delta module extracts a tiny, consistent view of
each "business state" (the current one and the
projected one) and computes the differences the spec
asks for:

  * ``score_difference``
  * ``readiness_difference``   (average across the 4
    readiness lenses)
  * ``dna_difference``
  * ``profile_completion_difference``

Plus three derived highlights:

  * ``biggest_improvement_lens``  — the single lens
    with the largest positive delta (or "" if none
    moved).
  * ``unchanged_lenses``          — the count of lenses
    whose delta is 0.
  * ``newly_unlocked_lenses``     — the count of lenses
    whose band changed (e.g. from low to medium, or
    from medium to high).

Snapshot shape
--------------

The current payload comes from the existing
:class:`BusinessScoreService` and
:class:`BusinessDNAService`. The projected payload
comes from re-running the same services against the
cloned in-memory row. The extractors normalise both
payloads into a small dict so the diff is a one-liner
per field.
"""

from __future__ import annotations

from typing import Any

from app.services.scoring.levels import level_for as _score_level_for


# The four readiness lenses the spec calls out. The
# names match the keys the Business Score Engine uses
# in its ``scores`` list.
_LENSES: tuple[str, ...] = ("export", "digital", "compliance", "growth")

# Bands the Business Score Engine uses. The
# ``levels.level_for`` helper is the source of truth.
# The scoring engine has 4 bands (Low/Medium/High/
# Excellent); the diff considers any upward movement
# in this ordering as "newly unlocked".
_BAND_ORDER = {
    "Low": 0,
    "Medium": 1,
    "High": 2,
    "Excellent": 3,
}


# --------------------------------------------------------------------------- #
# Snapshot extraction
# --------------------------------------------------------------------------- #


def extract_snapshot(
    *,
    scores_payload: dict,
    intelligence_payload: dict,
    dna_payload: dict,
) -> dict[str, Any]:
    """Pull the 8 numbers the spec requires out of the
    upstream payloads.

    The returned dict has the exact keys the
    :class:`~app.schemas.scenario.ScenarioSnapshotOut`
    Pydantic model expects, so a direct
    ``model_validate`` works downstream.
    """
    summary = scores_payload.get("summary") or {}
    overall = int(summary.get("score", 0) or 0)

    lens_scores = _lens_scores(scores_payload)
    profile_completion = _profile_completion(intelligence_payload)
    dna_match, dna_archetype = _dna(dna_payload)

    return {
        "overall_business_score": _clamp(overall),
        "profile_completion": _clamp(profile_completion),
        "business_dna_match": _clamp(dna_match),
        "business_dna_archetype": dna_archetype,
        "export_readiness": _clamp(lens_scores.get("export", 0)),
        "digital_readiness": _clamp(lens_scores.get("digital", 0)),
        "compliance_readiness": _clamp(lens_scores.get("compliance", 0)),
        "growth_readiness": _clamp(lens_scores.get("growth", 0)),
    }


def _lens_scores(scores_payload: dict) -> dict[str, int]:
    """Extract the four readiness lens scores from the
    Business Score Engine payload. The engines'
    ``scores`` list carries every score (overall,
    export, digital, compliance, growth, risk,
    innovation, sustainability); we only want the four
    the spec requires."""
    out: dict[str, int] = {}
    for entry in (scores_payload.get("scores") or []):
        key = entry.get("key")
        if key in _LENSES:
            out[key] = int(entry.get("score", 0) or 0)
    return out


def _profile_completion(intelligence_payload: dict) -> int:
    """The profile-completeness analyzer is the first
    analyzer in the Intelligence Engine. Fall back to
    0 if the analyzer is missing (a defensive
    no-op)."""
    for a in (intelligence_payload.get("analyzers") or []):
        if a.get("key") == "profile_completeness":
            return int(a.get("score", 0) or 0)
    return 0


def _dna(dna_payload: dict) -> tuple[int, str]:
    """Return ``(match_score, archetype_title)`` from
    the Business DNA Engine payload."""
    inner = dna_payload.get("dna") or dna_payload
    archetype = inner.get("archetype") or {}
    return (
        int(archetype.get("match_score", 0) or 0),
        str(archetype.get("title", "") or ""),
    )


# --------------------------------------------------------------------------- #
# Delta
# --------------------------------------------------------------------------- #


def compute_delta(
    current: dict[str, Any], projected: dict[str, Any]
) -> dict[str, Any]:
    """Compute the delta block.

    The function is pure: same inputs, same outputs.
    The diff is symmetric in the sense that every
    positive delta on the projected side is matched by
    a negative delta on the current side; we report the
    projection minus the current, so a positive number
    is always an improvement.
    """
    score_diff = _diff(current, projected, "overall_business_score")
    dna_diff = _diff(current, projected, "business_dna_match")
    profile_diff = _diff(current, projected, "profile_completion")

    lens_diffs: dict[str, int] = {}
    for lens in _LENSES:
        lens_diffs[lens] = _diff(current, projected, f"{lens}_readiness")

    readiness_diff = int(round(sum(lens_diffs.values()) / len(_LENSES)))

    biggest_lens, biggest_value = _biggest_improvement(lens_diffs)
    unchanged = sum(1 for v in lens_diffs.values() if v == 0)
    newly_unlocked = _count_newly_unlocked(current, projected)

    return {
        "score_difference": score_diff,
        "readiness_difference": readiness_diff,
        "dna_difference": dna_diff,
        "profile_completion_difference": profile_diff,
        "export_readiness_difference": lens_diffs["export"],
        "digital_readiness_difference": lens_diffs["digital"],
        "compliance_readiness_difference": lens_diffs["compliance"],
        "growth_readiness_difference": lens_diffs["growth"],
        "biggest_improvement_lens": biggest_lens,
        "biggest_improvement_value": biggest_value,
        "unchanged_lenses": unchanged,
        "newly_unlocked_lenses": newly_unlocked,
    }


def _diff(current: dict, projected: dict, key: str) -> int:
    """``projected - current`` for a single integer
    key, with both sides clamped to 0..100."""
    a = int(current.get(key, 0) or 0)
    b = int(projected.get(key, 0) or 0)
    return _clamp(b) - _clamp(a)


def _biggest_improvement(lens_diffs: dict[str, int]) -> tuple[str, int]:
    """Return ``(lens_name, value)`` for the lens with
    the largest positive delta, or ``("", 0)`` when no
    lens moved."""
    if not lens_diffs:
        return ("", 0)
    best_lens = max(lens_diffs, key=lambda k: lens_diffs[k])
    best_value = lens_diffs[best_lens]
    if best_value <= 0:
        return ("", 0)
    return (best_lens, best_value)


def _count_newly_unlocked(
    current: dict, projected: dict
) -> int:
    """Count the lenses whose band moved up by at least
    one tier between current and projected.

    "Tier" is a 3-level ladder (Low < Medium < High),
    matching the Business Score Engine's banding."""
    unlocked = 0
    for lens in _LENSES:
        key = f"{lens}_readiness"
        before = _band(_clamp(int(current.get(key, 0) or 0)))
        after = _band(_clamp(int(projected.get(key, 0) or 0)))
        if _BAND_ORDER[after] > _BAND_ORDER[before]:
            unlocked += 1
    return unlocked


def _band(score: int) -> str:
    return _score_level_for(int(score))


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _clamp(n: int) -> int:
    return max(0, min(100, int(n)))

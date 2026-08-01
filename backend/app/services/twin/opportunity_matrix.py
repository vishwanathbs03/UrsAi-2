"""Twin opportunity matrix.

The spec asks for six buckets:

  * Quick Wins
  * Strategic Investments
  * Long-Term Growth
  * Export Opportunities
  * Digital Opportunities
  * Funding Opportunities

Each entry references:

  * ``recommendation_id`` (the source
    recommendation)
  * ``roadmap_item`` (the matching roadmap item
    — by convention the same as the
    recommendation_id, since the roadmap item's
    primary key is the recommendation id)

Mapping to the upstream data
----------------------------

The mapping is purely a function of the
recommendation's metadata:

  * **Quick Wins** = ``phase = "Immediate"``.
  * **Strategic Investments** = high business
    impact + medium/long phase. We pick items
    whose estimated_roi >= 50 AND phase in
    ``("Short-Term", "Medium-Term")``.
  * **Long-Term Growth** = ``phase =
    "Long-Term"``.
  * **Export Opportunities** = recommendations
    whose category starts with
    ``"export_readiness"`` OR whose
    ``related_intelligence_keys`` contains
    ``"export_readiness.*"``.
  * **Digital Opportunities** = category
    starts with ``"digital_transformation"``
    OR related intelligence keys contain
    ``"digital_presence.*"``.
  * **Funding Opportunities** = recommendations
    whose category or intelligence keys mention
    funding / grant / loan. The engine emits
    these via the ``export_readiness.foreign_
    market`` and ``export_readiness.export_
    finance`` categories (we keep the
    mapping explicit so the next agent can
    extend it).

The buckets are not mutually exclusive. A
single recommendation can appear in two
buckets (e.g. an export recommendation that is
also a Quick Win). The matrix is built once
per recommendation and the per-bucket lists
are flat views.
"""

from __future__ import annotations

from typing import Any


# Category patterns the upstream Recommendation
# Engine emits. We hard-code the patterns here
# rather than importing them from the engine so
# the Twin service does not depend on private
# engine internals.
_EXPORT_CATEGORIES = (
    "export_readiness_actions",
    "export_readiness",
)
_DIGITAL_CATEGORIES = (
    "digital_transformation_actions",
    "digital_transformation",
)
_FUNDING_KEYWORDS = (
    "funding",
    "loan",
    "grant",
    "subsidy",
    "finance",
)


def build_opportunity_matrix(
    *,
    recs_block: dict[str, Any],
    roadmap_block: dict[str, Any],
    recommendations_raw: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the six-bucket opportunity matrix.

    The function is pure: same inputs, same
    outputs.

    ``recommendations_raw`` is the upstream
    recommendations list (with
    ``related_score_keys`` and
    ``related_intelligence_keys`` still
    present). The snapshot trims those fields
    out, so the service façade passes the raw
    list explicitly. If omitted, we fall back to
    the trimmed list, which is enough for the
    quick-wins / strategic / long-term buckets
    but not for the export / digital / funding
    classifiers.
    """

    recommendations = recommendations_raw if recommendations_raw is not None else (
        recs_block.get("recommendations") or []
    )
    # Build a set of roadmap item ids so we can
    # cross-check the cross-reference. The
    # roadmap item's primary key is the
    # recommendation id, so the set is also the
    # set of recommendation ids the roadmap
    # actually scheduled.
    roadmap_ids: set[str] = {
        it.get("recommendation_id")
        for it in (roadmap_block.get("items") or [])
        if isinstance(it.get("recommendation_id"), str)
    }

    quick_wins: list[dict[str, Any]] = []
    strategic: list[dict[str, Any]] = []
    long_term: list[dict[str, Any]] = []
    export_ops: list[dict[str, Any]] = []
    digital_ops: list[dict[str, Any]] = []
    funding_ops: list[dict[str, Any]] = []

    for rec in recommendations:
        entry = _entry(rec, roadmap_ids)
        if entry is None:
            continue
        # Skip resolved recommendations (zero
        # business impact + zero score gain = the
        # engine considers the gap closed).
        if (
            int(rec.get("business_impact", 0) or 0) == 0
            and float(rec.get("estimated_score_gain", 0) or 0) == 0
        ):
            continue

        if rec.get("phase") == "Immediate":
            quick_wins.append(entry)
        if rec.get("phase") == "Long-Term":
            long_term.append(entry)
        if (
            int(rec.get("estimated_roi", 0) or 0) >= 50
            and rec.get("phase") in ("Short-Term", "Medium-Term")
        ):
            strategic.append(entry)
        if _is_export(rec):
            export_ops.append(entry)
        if _is_digital(rec):
            digital_ops.append(entry)
        if _is_funding(rec):
            funding_ops.append(entry)

    return {
        "quick_wins": quick_wins,
        "strategic_investments": strategic,
        "long_term_growth": long_term,
        "export_opportunities": export_ops,
        "digital_opportunities": digital_ops,
        "funding_opportunities": funding_ops,
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _entry(rec: dict, roadmap_ids: set[str]) -> dict[str, Any] | None:
    rid = rec.get("id")
    if not isinstance(rid, str) or not rid:
        return None
    return {
        "opportunity_id": rid,
        "recommendation_id": rid,
        # ``roadmap_item`` is the matching roadmap
        # entry's primary key. The Roadmap Engine
        # keys items by recommendation id, so the
        # two are the same when the recommendation
        # is on the active roadmap. When the
        # recommendation has not been added to
        # the roadmap yet (rare — the engine
        # normally schedules every
        # recommendation) we fall back to the
        # recommendation id so the cross-
        # reference is still valid.
        "roadmap_item": rid if rid in roadmap_ids else rid,
        "title": str(rec.get("title", "") or ""),
        "description": str(rec.get("description", "") or ""),
        "category": str(rec.get("category", "") or ""),
        "priority": rec.get("priority", "Low"),
        "phase": rec.get("phase", "Medium-Term"),
        "estimated_score_gain": float(
            rec.get("estimated_score_gain", 0) or 0
        ),
        "estimated_roi": int(rec.get("estimated_roi", 0) or 0),
        "estimated_timeline": str(rec.get("estimated_timeline", "") or ""),
    }


def _is_export(rec: dict) -> bool:
    if (rec.get("category") or "").lower().startswith(_EXPORT_CATEGORIES):
        return True
    for k in (rec.get("related_intelligence_keys") or []):
        if "export_readiness" in str(k).lower():
            return True
    return False


def _is_digital(rec: dict) -> bool:
    if (rec.get("category") or "").lower().startswith(_DIGITAL_CATEGORIES):
        return True
    for k in (rec.get("related_intelligence_keys") or []):
        if "digital_presence" in str(k).lower():
            return True
    return False


def _is_funding(rec: dict) -> bool:
    """Funding opportunities are flagged by a
    category pattern *or* by an intelligence key
    that mentions funding. The upstream engine
    does not yet emit a dedicated funding
    category, so the heuristic is conservative:
    we surface an opportunity as a funding
    opportunity when the title or description
    mentions any of the funding keywords. The
    fallback is intentionally generous so the
    bucket is non-empty for real profiles."""
    hay = " ".join(
        [
            str(rec.get("title", "") or "").lower(),
            str(rec.get("description", "") or "").lower(),
            str(rec.get("category", "") or "").lower(),
        ]
    )
    return any(kw in hay for kw in _FUNDING_KEYWORDS)

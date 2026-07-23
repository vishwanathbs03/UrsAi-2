"""Twin risk matrix.

The spec asks for five buckets:

  * Critical Risks
  * High Risks
  * Medium Risks
  * Resolved Risks
  * Emerging Risks

Each entry references the originating Rule ID.

Mapping to the upstream data
----------------------------

The Rule Engine produces the *active* rules — every
firing is an active risk. The Recommendation
Engine produces *recommended fixes*; each
recommendation references its source rule via
``supporting_rule_ids``.

The mapping we use:

  * **Active risks** (Critical / High / Medium /
    Low) = rule firings bucketed by priority. The
    firings already carry the rule id, title,
    description, and estimated_impact.

  * **Emerging risks** = rules that the
    Recommendation Engine flagged via a
    recommendation, but the Rule Engine did *not*
    fire them in the current state. These are
    latent risks the engine is predicting — the
    user does not have the gap today, but a
    specific change in posture would surface it.
    The Risk Matrix surfaces them with priority
    derived from the recommendation's priority.

  * **Resolved risks** = rules that the
    Recommendation Engine considers closed. In
    the absence of historical state we cannot
    detect *time-series* resolution, so we use a
    conservative proxy: a rule is "resolved" if
    it appears in a recommendation's
    ``supporting_rule_ids`` AND the
    recommendation's ``estimated_score_gain`` is
    0 (i.e. the engine considers the work
    trivially done). In practice this is a
    small set; the field is included so the
    response shape is stable.
"""

from __future__ import annotations

from typing import Any


# Risk priority order. Used to bucket the active
# firings into the spec's three top buckets.
_PRIORITY_BUCKETS: tuple[str, ...] = ("Critical", "High", "Medium")


def build_risk_matrix(
    *,
    rules_block: dict[str, Any],
    recs_block: dict[str, Any],
) -> dict[str, Any]:
    """Build the five-bucket risk matrix.

    The function is pure: same inputs, same
    outputs."""

    firings = rules_block.get("firings") or []
    recommendations = recs_block.get("recommendations") or []

    # Set of rule ids the Rule Engine fired.
    fired_ids: set[str] = {
        f.get("id") for f in firings if isinstance(f.get("id"), str) and f.get("id")
    }

    # Recommendations bucket: rule_id -> list of
    # matching recommendations. A rule can have
    # multiple recommendations (e.g. one critical
    # and one low-priority fix).
    recs_by_rule: dict[str, list[dict[str, Any]]] = {}
    for rec in recommendations:
        for rid in (rec.get("supporting_rule_ids") or []):
            if not isinstance(rid, str) or not rid:
                continue
            recs_by_rule.setdefault(rid, []).append(rec)

    # ---- Active risks -------------------------------- #
    critical = [_entry(f) for f in firings if f.get("priority") == "Critical"]
    high = [_entry(f) for f in firings if f.get("priority") == "High"]
    medium = [_entry(f) for f in firings if f.get("priority") == "Medium"]

    # ---- Emerging risks ------------------------------ #
    # A rule that has a recommendation but did
    # not fire. We emit one entry per
    # (rule, recommendation) pair so the UI can
    # link back to the recommended fix.
    emerging: list[dict[str, Any]] = []
    for rid, recs in recs_by_rule.items():
        if rid in fired_ids:
            continue
        # Take the highest-priority recommendation
        # for the rule so the entry carries the
        # most relevant fix.
        top = _highest_priority_rec(recs)
        if top is None:
            continue
        emerging.append(
            {
                "risk_id": f"emerging.{rid}",
                "rule_id": rid,
                "title": top.get("title", ""),
                "description": _emerging_description(top),
                "priority": top.get("priority", "Low"),
                "category": top.get("category", ""),
                "estimated_impact": int(
                    top.get("business_impact", 0) or 0
                ),
            }
        )

    # ---- Resolved risks ------------------------------ #
    # A rule is "resolved" if every
    # recommendation for it has
    # estimated_score_gain = 0. The proxy is
    # conservative (the engine rarely emits 0-
    # gain recommendations) so the bucket is
    # usually empty; the field is always
    # present so the response shape is stable.
    resolved: list[dict[str, Any]] = []
    for rid, recs in recs_by_rule.items():
        if rid in fired_ids:
            continue
        if not recs:
            continue
        if all(float(r.get("estimated_score_gain", 0) or 0) == 0 for r in recs):
            top = _highest_priority_rec(recs)
            if top is None:
                continue
            resolved.append(
                {
                    "risk_id": f"resolved.{rid}",
                    "rule_id": rid,
                    "title": top.get("title", ""),
                    "description": "The engine no longer considers this a live risk.",
                    "priority": top.get("priority", "Low"),
                    "category": top.get("category", ""),
                    "estimated_impact": 0,
                }
            )

    return {
        "critical_risks": critical,
        "high_risks": high,
        "medium_risks": medium,
        "resolved_risks": resolved,
        "emerging_risks": emerging,
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _entry(firing: dict) -> dict[str, Any]:
    """Map a rule firing to a risk entry."""
    return {
        "risk_id": str(firing.get("id", "") or ""),
        "rule_id": str(firing.get("id", "") or ""),
        "title": str(firing.get("title", "") or ""),
        "description": str(firing.get("description", "") or ""),
        "priority": firing.get("priority", "Low"),
        "category": str(firing.get("category", "") or ""),
        "estimated_impact": int(firing.get("estimated_impact", 0) or 0),
    }


def _highest_priority_rec(recs: list[dict]) -> dict | None:
    """Pick the highest-priority recommendation
    from a list. Priority rank: Critical > High >
    Medium > Low. Stable on rec id as a
    tiebreak."""
    rank = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
    return max(
        recs,
        key=lambda r: (
            rank.get(r.get("priority", "Low"), 0),
            int(r.get("business_impact", 0) or 0),
            r.get("id", ""),
        ),
        default=None,
    )


def _emerging_description(rec: dict) -> str:
    """A short description for an emerging risk
    entry. The Recommendation Engine already
    produces a ``description`` field, but it is
    written in the imperative ("Add a website
    URL"). The Risk Matrix frames it as a
    forecast: "If this gap surfaces, the
    recommendation is to …"."""
    title = rec.get("title", "")
    return f"Forecast: {title}."

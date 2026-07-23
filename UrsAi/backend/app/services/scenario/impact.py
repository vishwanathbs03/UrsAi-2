"""Recommendation + roadmap impact analysis for the
Scenario Engine.

The impact module is a thin diff over the
Recommendation Engine and Roadmap Engine outputs:

  * ``resolved_recommendations`` — recommendation ids
    the projected clone *no longer* produces (i.e. the
    hypothetical change made the underlying rule no
    longer fire).
  * ``remaining_recommendations`` — the projected
    recommendation id set, i.e. current minus
    resolved.
  * ``newly_unlocked_roadmap_items`` — roadmap item
    ids whose dependencies all resolve under the
    projection but did not resolve under the current
    state. The Roadmap Engine already exposes
    ``unlocks`` per item; the impact module diffs the
    two graphs and surfaces the new edges.

The module does NOT recompute any recommendation or
roadmap logic. The service façade hands it the two
payload dicts and it returns the diff.

Diffing rules
-------------

* Recommendation ids are matched by string equality
  on the upstream ``id`` field.

* For roadmap unlocks, we use a *graph* definition:
  a roadmap item B is "newly unlocked" under the
  projection if and only if every id in B's
  ``blocked_by`` list resolves under the projection
  AND the same was not true under the current state.

  This definition is independent of the upstream
  ``unlocks`` field on each item (which lists what B
  unlocks, not whether B is unlocked). Using the
  ``blocked_by`` side is the right frame because
  "unlocked" is a property of the *dependent* item,
  not the *blocker* item.
"""

from __future__ import annotations

from typing import Any


def compute_impact(
    *,
    current_recommendations: dict[str, Any],
    projected_recommendations: dict[str, Any],
    current_roadmap: dict[str, Any],
    projected_roadmap: dict[str, Any],
) -> dict[str, Any]:
    """Return the three impact fields the spec asks for.

    The function is pure: same inputs, same outputs.
    The arguments are the full ``recommendations``
    payload dict and the full ``roadmap`` payload
    dict; the impact module reads only the parts it
    needs (id lists + per-item dependency maps)."""

    current_ids = _recommendation_ids(current_recommendations)
    projected_ids = _recommendation_ids(projected_recommendations)

    # A recommendation is "resolved" if the projected
    # state no longer produces it.
    resolved = sorted(current_ids - projected_ids)
    # "Remaining" is the projected set; the spec asks
    # for the ids the simulation still has work to do
    # on, so we report the projected set, not the
    # current-minus-resolved set. The two are
    # equivalent when the projection is consistent
    # (no id appears in current that does not also
    # appear in current-minus-resolved).
    remaining = sorted(projected_ids)

    # Build the per-item dependency maps for both
    # states. A roadmap item B is "blocked" by an id X
    # iff X appears in B's ``blocked_by`` list.
    current_blocked_by = _build_blocked_by_map(current_roadmap)
    projected_blocked_by = _build_blocked_by_map(projected_roadmap)

    # An item is "unlocked" in a state if every
    # dependency in its ``blocked_by`` list is in the
    # recommendation-id set for that state.
    current_recommendation_set = current_ids
    projected_recommendation_set = projected_ids

    current_unlocked = _unlocked_items(
        current_blocked_by, current_recommendation_set
    )
    projected_unlocked = _unlocked_items(
        projected_blocked_by, projected_recommendation_set
    )

    newly_unlocked = sorted(projected_unlocked - current_unlocked)

    return {
        "resolved_recommendations": resolved,
        "remaining_recommendations": remaining,
        "newly_unlocked_roadmap_items": newly_unlocked,
    }


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #


def _recommendation_ids(payload: dict) -> set[str]:
    """Pull the set of recommendation ids from a
    Recommendation Engine payload."""
    out: set[str] = set()
    for r in (payload.get("recommendations") or []):
        rid = r.get("id")
        if isinstance(rid, str) and rid:
            out.add(rid)
    return out


def _build_blocked_by_map(roadmap_payload: dict) -> dict[str, tuple[str, ...]]:
    """Build ``{roadmap_item_id: (blocker_id, ...)}``
    from a Roadmap Engine payload."""
    out: dict[str, tuple[str, ...]] = {}
    for it in (roadmap_payload.get("items") or []):
        rid = it.get("recommendation_id")
        if not isinstance(rid, str) or not rid:
            continue
        blocked_by = it.get("blocked_by") or []
        out[rid] = tuple(b for b in blocked_by if isinstance(b, str))
    return out


def _unlocked_items(
    blocked_by_map: dict[str, tuple[str, ...]],
    recommendation_set: set[str],
) -> set[str]:
    """Return the set of roadmap items that have *no*
    outstanding blockers — i.e. their ``blocked_by``
    list is empty, or every id in it is also a
    recommendation id in ``recommendation_set``.

    Note: an item is "unlocked" if its dependencies
    are satisfied, but the Roadmap Engine's contract
    is that dependencies are *only* satisfied when
    the blocker is no longer in the recommendation
    list. So an item is unlocked iff every blocker is
    *absent* from the recommendation set. We achieve
    that by interpreting "blocker id in
    recommendation_set" as "blocker still has work to
    do, so the item is still blocked"."""
    unlocked: set[str] = set()
    for item_id, blockers in blocked_by_map.items():
        if not blockers:
            unlocked.add(item_id)
            continue
        # Every blocker must be *resolved* (i.e.
        # absent from the recommendation set) for the
        # item to be unlocked.
        if all(b not in recommendation_set for b in blockers):
            unlocked.add(item_id)
    return unlocked

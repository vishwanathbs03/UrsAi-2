"""Cross-recommendation dependency detection.

The Recommendation Engine needs to surface *dependencies*
between recommendations so the UI can render a "you should
do X first" affordance. The spec example: a
``get_iec_registration`` recommendation blocks any
``first_export`` recommendation, because exports without an
IEC are a customs / banking problem.

The detection is **deterministic and rule-based** — there
is no AI, no LLM, no graph algorithm. Every dependency is
the result of a small hand-written matcher that compares:

  * The rule's ``source_keys`` (the signals that fired the
    rule) against the source_keys of every other
    recommendation's source rule.
  * The knowledge article's ``related_score_keys`` and
    ``related_intelligence_keys`` (used to surface
    "this recommendation is taught in article X").
  * A small static dependency table that encodes
    known-ordering constraints (e.g. IEC before first
    export).

The dependency list is intentionally small and curated —
the engine is *not* trying to build a complete causal
graph of business improvement. It surfaces the half-dozen
constraints a real business owner would know about.
"""

from __future__ import annotations

from app.services.recommendations.base import (
    KnowledgeMatch,
    Recommendation,
    RuleSnapshot,
)


# --------------------------------------------------------------------------- #
# Static dependency table
# --------------------------------------------------------------------------- #
#
# A small dict: prerequisite rule id → set of rule ids that
# depend on the prerequisite. A recommendation R1 is
# "depended on" by R2 iff R1.id is in DEPENDS_ON[R2.id] OR
# R2.id is in REQUIRED_BY[R1.id].
#
# The list is intentionally tiny — only the ordering
# constraints that the Rule Engine itself does not already
# encode. Adding to this list is the supported extension
# mechanism: every entry has a docstring explaining *why*
# the constraint exists.
#
# Convention: the rule id strings must match the rule
# definitions in `app/services/rules/rules_*.py`. If you
# rename a rule, update this table in the same commit.

# prerequisite_rule_id -> set of "downstream" rule ids
DEPENDS_ON: dict[str, frozenset[str]] = {
    # IEC registration is the legal prerequisite for any
    # export. If the IEC rule fires, every export-related
    # rule depends on it.
    "rule.export.no_iec": frozenset({
        "rule.export.first_export",
        "rule.export.expand_markets",
    }),
    # Website is the floor of digital presence; every other
    # digital rule depends on it.
    "rule.digital.no_website": frozenset({
        "rule.digital.no_social",
        "rule.digital.no_ecommerce",
        "rule.digital.no_digital_marketing",
    }),
    # Quality certification is required before any
    # export-to-regulated-market rule fires.
    "rule.compliance.no_quality_cert": frozenset({
        "rule.export.first_export",
        "rule.export.expand_markets",
    }),
    # Profile basics must be filled before any other rule
    # produces an actionable result.
    "rule.immediate.no_profile_basics": frozenset({
        "rule.immediate.products_no_capacity",
        "rule.immediate.export_no_iec",
    }),
}


# Reverse map for quick lookup.
def _build_required_by() -> dict[str, frozenset[str]]:
    out: dict[str, frozenset[str]] = {}
    for prereq, dependents in DEPENDS_ON.items():
        for d in dependents:
            out[d] = out.get(d, frozenset()) | {prereq}
    return out


REQUIRED_BY: dict[str, frozenset[str]] = _build_required_by()


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #


def dependencies_for(rule: RuleSnapshot, all_rules: tuple[RuleSnapshot, ...]) -> tuple[str, ...]:
    """Return the rule ids that the given rule depends on.

    A dependency is the prerequisite rule's id. The UI
    renders these as "Blocked by: …" chips; the engine
    does not enforce them.

    The lookup is O(n) over ``all_rules`` so callers
    should not invoke this in a tight loop — the
    generator batches the calls.
    """
    all_ids = {r.id for r in all_rules}
    deps: set[str] = set()

    # 1. Static dependency table.
    for prereq in REQUIRED_BY.get(rule.id, frozenset()):
        if prereq in all_ids:
            deps.add(prereq)

    # 2. Source-key overlap. If another rule's source_keys
    #    is a subset of THIS rule's source_keys, the other
    #    rule is a prerequisite. (E.g. if this rule fires on
    #    "no_iec" + "has_export_history", a "no_iec" rule is
    #    a prerequisite.)
    rule_keys = set(rule.source_keys)
    for other in all_rules:
        if other.id == rule.id:
            continue
        if not other.source_keys:
            continue
        # Other's source keys must be a non-empty subset of
        # this rule's source keys for the dependency to
        # hold. The empty case is excluded above.
        if set(other.source_keys).issubset(rule_keys) and other.source_keys != rule.source_keys:
            deps.add(other.id)

    return tuple(sorted(deps))


def articles_for(
    rule: RuleSnapshot,
    knowledge: tuple[KnowledgeMatch, ...],
) -> tuple[str, ...]:
    """Return the knowledge article ids that this rule should
    reference.

    A recommendation points to an article when the article's
    ``related_score_keys`` or ``related_intelligence_keys``
    overlap with the rule's ``source_keys``. The lookup is
    deterministic and bounded by ``len(knowledge)`` — for the
    current catalog (~20 articles) this is trivial.
    """
    rule_keys = set(rule.source_keys)
    if not rule_keys:
        return ()
    article_ids: list[str] = []
    for article in knowledge:
        keys = set(article.related_score_keys) | set(article.related_intelligence_keys)
        if keys & rule_keys:
            article_ids.append(article.id)
    return tuple(article_ids)


def build_knowledge_index(
    articles_payload: list[dict],
) -> tuple[KnowledgeMatch, ...]:
    """Convert the Knowledge service's raw article payloads
    into a tuple of :class:`KnowledgeMatch` for the dependency
    helper. The Knowledge service is the only place that
    knows the article shape; this is the only place that
    converts it into Recommendation-friendly tuples.
    """
    out: list[KnowledgeMatch] = []
    for a in articles_payload:
        out.append(
            KnowledgeMatch(
                id=str(a.get("id", "")),
                title=str(a.get("title", "")),
                related_score_keys=tuple(a.get("related_score_keys", ()) or ()),
                related_intelligence_keys=tuple(
                    a.get("related_intelligence_keys", ()) or ()
                ),
            )
        )
    return tuple(out)

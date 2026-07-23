"""Deterministic rule → recommendation transformation.

The generator is the only place that knows how to convert
a :class:`RuleSnapshot` into a :class:`Recommendation`. Every
helper module above is invoked from here, in a stable
order, with no branching on time / random / external state.

The transformation is:

    1.  Compute the priority / phase / timeline / cost via
        :mod:`priorities` + :mod:`timeline`.
    2.  Compute the business_impact / score_gain / confidence
        via :mod:`impact`.
    3.  Compute the dependencies and the knowledge article
        references via :mod:`dependencies`.
    4.  Compute the difficulty bucket (Easy / Moderate / Hard /
        Expert) from priority + impact.
    5.  Compute the projected_dna_effect narrative (a
        one-sentence description of the archetype the
        recommendation would push the user toward).
    6.  Build the immutable :class:`Recommendation` and return
        it.

The output is fully reproducible: two calls with the same
inputs (rules list, knowledge articles, DNA archetype key,
priority, impact) produce byte-identical
:class:`Recommendation` instances.
"""

from __future__ import annotations

from app.services.recommendations.base import (
    Category,
    Difficulty,
    KnowledgeMatch,
    Recommendation,
    RuleSnapshot,
)
from app.services.recommendations.dependencies import (
    articles_for,
    dependencies_for,
)
from app.services.recommendations.impact import (
    business_impact_from_rule,
    confidence_for,
    estimate_score_gain,
)
from app.services.recommendations.priorities import priority_weight
from app.services.recommendations.roi import estimate_roi
from app.services.recommendations.timeline import (
    cost_for,
    phase_for,
    timeline_for,
)


# --------------------------------------------------------------------------- #
# Difficulty bucket
# --------------------------------------------------------------------------- #
#
# Higher priority + lower impact = easier (urgent quick wins).
# Lower priority + higher impact = harder (heavy lift).
#
# Score range: 30..130 (weight*15 - impact*0.4 + 50).
# Buckets: Easy >= 80, Moderate >= 60, Hard >= 40, else Expert.

def _difficulty_for(priority: Priority, business_impact: int) -> Difficulty:
    weight = priority_weight(priority)
    impact = max(0, min(100, int(business_impact)))
    score = weight * 15 - impact * 0.4 + 50
    if score >= 80:
        return "Easy"
    if score >= 60:
        return "Moderate"
    if score >= 40:
        return "Hard"
    return "Expert"


# --------------------------------------------------------------------------- #
# Projected DNA effect
# --------------------------------------------------------------------------- #
#
# A short narrative that names the archetype a successful
# recommendation would push the user toward. The mapping is
# derived from the rule's category — each category has a
# natural "target archetype" the user is moving toward.
# Deterministic, no AI.

_CATEGORY_DNA_EFFECT: dict[Category, str] = {
    "immediate_actions": (
        "Completing this will move the business out of the "
        "Foundation Builder state and unlock a more specific "
        "DNA archetype on the next analysis."
    ),
    "high_priority": (
        "Closing this gap will lift the Growth Operator "
        "archetype's match score and shift the secondary "
        "trait mix toward 'export_ready'."
    ),
    "medium_priority": (
        "Steady progress here will reinforce the Steady Builder "
        "archetype and improve the Compliance Champion "
        "secondary trait."
    ),
    "long_term": (
        "Strategic investments like this move the business "
        "toward the Long-Horizon Planner archetype."
    ),
    "risk_alerts": (
        "Resolving this risk will reduce the weakness count "
        "in the SWOT and stabilise the Risk Reducer "
        "archetype's match score."
    ),
    "compliance_actions": (
        "Active compliance certifications strengthen the "
        "Compliance Champion archetype and improve Export "
        "Readiness score."
    ),
    "export_readiness_actions": (
        "Successful execution here will move the business "
        "toward the Export Pathfinder archetype and "
        "materially improve the Export Readiness score."
    ),
    "digital_transformation_actions": (
        "Closing this gap will strengthen the Digital Pioneer "
        "archetype and lift the Digital Readiness and "
        "Innovation scores in tandem."
    ),
}


def _projected_dna_effect(category: Category) -> str:
    return _CATEGORY_DNA_EFFECT[category]


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #


def generate(
    rule: RuleSnapshot,
    *,
    all_rules: tuple[RuleSnapshot, ...],
    knowledge: tuple[KnowledgeMatch, ...],
) -> Recommendation:
    """Convert a :class:`RuleSnapshot` into a
    :class:`Recommendation`.

    The function is pure: same ``rule``, ``all_rules``, and
    ``knowledge`` → same :class:`Recommendation`.
    """
    business_impact = business_impact_from_rule(rule.estimated_impact)
    phase = phase_for(rule.category)
    timeline = timeline_for(rule.category, business_impact)
    cost = cost_for(rule.category, business_impact)
    roi = estimate_roi(rule.priority, business_impact)
    score_gain = estimate_score_gain(rule.priority, business_impact)
    articles = articles_for(rule, knowledge)
    deps = dependencies_for(rule, all_rules)
    confidence = confidence_for(rule.priority, business_impact, len(articles))
    difficulty = _difficulty_for(rule.priority, business_impact)
    dna_effect = _projected_dna_effect(rule.category)

    return Recommendation(
        id=rule.id,
        title=rule.title,
        description=rule.description,
        category=rule.category,
        priority=rule.priority,
        phase=phase,
        business_impact=business_impact,
        estimated_score_gain=score_gain,
        estimated_roi=roi,
        estimated_cost=cost,
        estimated_timeline=timeline,
        difficulty=difficulty,
        confidence=confidence,
        dependencies=deps,
        supporting_rule_ids=(rule.id,),
        supporting_article_ids=articles,
        related_score_keys=tuple(
            k for k in rule.source_keys if k.startswith("score.")
        ),
        related_intelligence_keys=tuple(
            k for k in rule.source_keys if k.startswith("intelligence.")
        ),
        projected_dna_effect=dna_effect,
        status="planned",
    )

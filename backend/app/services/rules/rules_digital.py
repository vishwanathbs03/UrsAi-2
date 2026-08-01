"""Digital-transformation rules.

These fire when the digital + innovation pillars have a
concrete missing element. Distinct from the generic "high
priority" pillar rules — these name the specific digital
items.
"""

from __future__ import annotations

from app.services.rules.base import RuleDef, RuleSignalMap


def _no_website(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_website"):
        return None
    return ("No business website is on file.", 30, 1.2)


def _no_ecommerce(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.flag("flag.has_website"):
        if not sig.flag("flag.has_ecommerce"):
            return ("Website exists but e-commerce is not enabled.", 20, 0.7)
    return None


def _few_social_channels(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    social = sig.score("intelligence.digital_readiness.social_channels", 0)
    if social >= 10:  # the analyzer awards 20 for 2+ channels
        return None
    return ("Fewer than 2 social channels are filled in; channel presence is thin.", 10, 0.6)


def _no_digital_marketing(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.score("intelligence.digital_readiness.digital_marketing", 0) > 0:
        return None
    return ("Digital marketing is not marked as in use.", 15, 0.6)


def _no_cloud(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    if sig.score("intelligence.digital_readiness.cloud_systems", 0) > 0:
        return None
    return ("Cloud systems are not marked as in use.", 15, 0.5)


def _digital_score_medium(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.digital.score", 0)
    if not (40 <= s < 60):
        return None
    return (f"Digital score is {s}; specific channel gaps remain.", 60 - s, 0.7)


def _innovation_score_medium(sig: RuleSignalMap) -> tuple[str, int, int] | None:
    s = sig.score("score.innovation.score", 0)
    if not (40 <= s < 60):
        return None
    return (f"Innovation score is {s}; e-commerce, cloud, or digital marketing would help.", 60 - s, 0.6)


ALL: tuple[RuleDef, ...] = (
    RuleDef(
        id="digital_transformation.no_website",
        title="No business website",
        description="No business website is on file.",
        category="digital_transformation_actions",
        priority="High",
        source_keys=("digital_readiness.website",),
        firer=_no_website,
    ),
    RuleDef(
        id="digital_transformation.no_ecommerce",
        title="Website exists but e-commerce is off",
        description="Website exists but e-commerce is not enabled.",
        category="digital_transformation_actions",
        priority="Medium",
        source_keys=("digital_readiness.website", "digital_readiness.ecommerce"),
        firer=_no_ecommerce,
    ),
    RuleDef(
        id="digital_transformation.few_social_channels",
        title="Fewer than 2 social channels",
        description="Fewer than 2 social channels are filled in; channel presence is thin.",
        category="digital_transformation_actions",
        priority="Low",
        source_keys=("digital_readiness.social_channels",),
        firer=_few_social_channels,
    ),
    RuleDef(
        id="digital_transformation.no_digital_marketing",
        title="Digital marketing not in use",
        description="Digital marketing is not marked as in use.",
        category="digital_transformation_actions",
        priority="Low",
        source_keys=("digital_readiness.digital_marketing",),
        firer=_no_digital_marketing,
    ),
    RuleDef(
        id="digital_transformation.no_cloud",
        title="Cloud systems not in use",
        description="Cloud systems are not marked as in use.",
        category="digital_transformation_actions",
        priority="Low",
        source_keys=("digital_readiness.cloud_systems",),
        firer=_no_cloud,
    ),
    RuleDef(
        id="digital_transformation.score_medium",
        title="Digital score in the Medium band",
        description="Digital score is in the Medium band; specific channel gaps remain.",
        category="digital_transformation_actions",
        priority="Medium",
        source_keys=("score.digital",),
        firer=_digital_score_medium,
    ),
    RuleDef(
        id="digital_transformation.innovation_medium",
        title="Innovation score in the Medium band",
        description="Innovation score is in the Medium band; e-commerce, cloud, or digital marketing would help.",
        category="digital_transformation_actions",
        priority="Low",
        source_keys=("score.innovation",),
        firer=_innovation_score_medium,
    ),
)

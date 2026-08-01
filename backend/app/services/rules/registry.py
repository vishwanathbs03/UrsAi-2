"""Rule registry — single source of truth for the rule set.

The engine iterates ``ALL_RULES`` in category order. The
category order is the order the spec defines and the order
the UI renders the eight category cards in.

To add a new rule:

  1. Add a :class:`~app.services.rules.base.RuleDef` to the
     appropriate ``rules_<category>.py`` module's ``ALL``
     tuple.
  2. Done. The engine will pick it up on the next call.

There is no rule dispatcher to update and no rule ID to
register separately — the rule's ``id`` field is the
identifier.
"""

from __future__ import annotations

from app.services.rules.base import CATEGORIES, RuleDef
from app.services.rules.rules_compliance import ALL as COMPLIANCE
from app.services.rules.rules_digital import ALL as DIGITAL
from app.services.rules.rules_export import ALL as EXPORT
from app.services.rules.rules_high_priority import ALL as HIGH
from app.services.rules.rules_immediate import ALL as IMMEDIATE
from app.services.rules.rules_long_term import ALL as LONG_TERM
from app.services.rules.rules_medium_priority import ALL as MEDIUM
from app.services.rules.rules_risk_alerts import ALL as RISK


# Category index — the order the spec defines and the order
# the UI renders the eight category cards in.
_CATEGORY_ORDER: tuple[tuple[str, tuple[RuleDef, ...]], ...] = (
    ("immediate_actions", IMMEDIATE),
    ("high_priority", HIGH),
    ("medium_priority", MEDIUM),
    ("long_term", LONG_TERM),
    ("risk_alerts", RISK),
    ("compliance_actions", COMPLIANCE),
    ("export_readiness_actions", EXPORT),
    ("digital_transformation_actions", DIGITAL),
)


def all_rules() -> list[RuleDef]:
    """Return every rule in category order. New rules added to
    any ``rules_<category>.ALL`` tuple show up here automatically."""
    out: list[RuleDef] = []
    for _, rules in _CATEGORY_ORDER:
        out.extend(rules)
    return out


def rules_by_category() -> dict[str, list[RuleDef]]:
    """Return a {category -> [rules]} map keyed by the 8 spec
    categories. Useful for the API to surface per-category
    counts and lists without re-walking the rule set."""
    return {cat: list(rules) for cat, rules in _CATEGORY_ORDER}


def category_names() -> tuple[str, ...]:
    """Return the 8 spec categories in order."""
    return CATEGORIES

"""Shared result types for the Rule Engine.

The Rule Engine is a deterministic firing engine. It evaluates a
small, hand-written set of rules against a flat signal table
(``RuleSignalMap``) and returns a list of firings. Each firing
is a :class:`RuleFiring` and carries:

  * a stable ``id`` for cross-referencing in tests / UI
  * a ``title`` and ``description`` that describe *what the
    rule is*, not what the user should do
  * a ``category`` (one of the 8 categories the spec requires)
  * a ``priority`` (Critical / High / Medium / Low)
  * a ``reason`` (the signal trace that fired the rule)
  * a list of ``source_keys`` that trace back to the
    intelligence / score / DNA layers
  * an ``estimated_impact`` 0..100 — a deterministic function
    of the size of the gap, NOT a marketing claim

What the engine is NOT:

  * It is NOT a recommendation system. The ``description`` field
    describes the rule, not an action. The UI is free to
    reframe the rule as a checklist item; the engine itself
    does not say "you should do X".
  * It is NOT an LLM, a chat, or a RAG pipeline. Every line of
    the response is reproducible from the signal table.

The engine is intentionally an O(n_rules) iteration — there is
no rule dispatcher to maintain. Adding a new rule means adding
a new :class:`RuleDef` to the appropriate module and registering
it in the category's ``ALL_RULES`` tuple.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #


Category = str  # one of CATEGORIES
Priority = str  # one of PRIORITIES

CATEGORIES: tuple[str, ...] = (
    "immediate_actions",
    "high_priority",
    "medium_priority",
    "long_term",
    "risk_alerts",
    "compliance_actions",
    "export_readiness_actions",
    "digital_transformation_actions",
)

PRIORITIES: tuple[str, ...] = ("Critical", "High", "Medium", "Low")


# --------------------------------------------------------------------------- #
# Building blocks
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RuleSignalMap:
    """Read-only signal table built from the intelligence + score
    + DNA payloads. Used only by the Rule Engine — a separate
    type from the DNA engine's SignalMap so the two can evolve
    independently.

    The Rule Engine uses two kinds of signals:

    * numeric (0..100) — intelligence and score values
    * boolean — derived flags (e.g. ``has_iec``)

    Every signal has a ``label`` (human-readable explanation)
    and a ``source_key`` (traces back to the layer that
    produced it).
    """

    _values: dict[str, object] = field(default_factory=dict)
    _labels: dict[str, str] = field(default_factory=dict)
    _source_keys: dict[str, str] = field(default_factory=dict)

    # ---- read side (rules only call these) ----

    def get(self, key: str, default: object = 0) -> object:
        return self._values.get(key, default)

    def has(self, key: str) -> bool:
        return key in self._values

    def label(self, key: str) -> str:
        return self._labels.get(key, key)

    def source_key(self, key: str) -> str | None:
        return self._source_keys.get(key)

    def score(self, key: str, default: int = 0) -> int:
        """Convenience: read a numeric signal as int, default 0."""
        try:
            return int(self._values.get(key, default))
        except (TypeError, ValueError):
            return default

    def flag(self, key: str) -> bool:
        """Convenience: read a boolean signal as bool."""
        return bool(self._values.get(key, False))

    def all_keys(self) -> list[str]:
        return list(self._values.keys())

    def items(self):
        return self._values.items()


# --------------------------------------------------------------------------- #
# Rule definition
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RuleDef:
    """One rule, declared once.

    ``firer`` returns ``None`` if the rule does not fire, or a
    tuple ``(reason, gap, weight)`` if it does. ``reason`` is a
    one-sentence plain-English trace; ``gap`` and ``weight`` are
    used to compute the deterministic ``estimated_impact``:

        estimated_impact = int(round(0.5 * gap * weight))

    ``gap`` is the size of the gap (0..100). ``weight`` is a
    multiplier that lets rules in the same category contribute
    different amounts — for example, a "no active certification"
    rule might carry more weight than a "no goals declared"
    rule even though both are categorized as compliance.
    """

    id: str
    title: str
    description: str
    category: Category
    priority: Priority
    source_keys: tuple[str, ...]
    firer: Callable[[RuleSignalMap], tuple[str, int, int] | None]

    def fire(self, sig: RuleSignalMap) -> "RuleFiring | None":
        """Evaluate the rule. Returns None if it does not fire."""
        result = self.firer(sig)
        if result is None:
            return None
        reason, gap, weight = result
        # Clamp gap to 0..100 and weight to 0..2.0 for safety.
        gap_c = max(0, min(100, int(gap)))
        weight_c = max(0.0, min(2.0, float(weight)))
        impact = int(round(0.5 * gap_c * weight_c))
        impact = max(0, min(100, impact))
        return RuleFiring(
            id=self.id,
            title=self.title,
            description=self.description,
            category=self.category,
            priority=self.priority,
            reason=reason,
            source_keys=list(self.source_keys),
            estimated_impact=impact,
        )


@dataclass(frozen=True)
class RuleFiring:
    """A single rule firing — the output of one rule evaluation."""

    id: str
    title: str
    description: str
    category: Category
    priority: Priority
    reason: str
    source_keys: list[str]
    estimated_impact: int

    def to_payload(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "priority": self.priority,
            "reason": self.reason,
            "source_keys": list(self.source_keys),
            "estimated_impact": self.estimated_impact,
        }

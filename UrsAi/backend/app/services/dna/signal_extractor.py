"""Signal extraction layer — the *only* place the DNA engine
touches the intelligence / score payloads.

The DNA engine is a deterministic classifier. It does not read
the SQLAlchemy models directly, does not touch the database, and
does not implement a "rule engine". It consumes the typed
analysis results from Sprint 2 Part 1 (intelligence) and Part 2
(scores) and produces a single DNA profile.

To make every verdict auditable, this module does one thing:
flatten the two input payloads into a small dictionary of
``signals`` with stable string keys, and a parallel dictionary
of human-readable labels. Downstream modules (archetype
classifier, trait detector, SWOT composer) only ever read from
this flat signal table. Every signal has a 0..100 value (or a
boolean for binary flags), and a ``source_key`` that traces
back to the intelligence or score key it came from.

Adding a new signal here automatically makes it available to
the archetype + trait + SWOT layers — the rest of the engine
is purely declarative.
"""

from __future__ import annotations

from typing import Any


class SignalMap:
    """Read-only signal table built from the intelligence + score
    payloads. Accessed by the rest of the DNA engine as
    ``signals.get("export.score")`` etc.

    Two parallel stores:

    * ``values`` — numeric / boolean / list values used for math
    * ``labels`` — short human-readable explanations of what
      produced each signal, used in the rationale
    * ``source_keys`` — trace-back path back to the original
      intelligence / score key (so the UI can deep-link)
    """

    __slots__ = ("_values", "_labels", "_source_keys")

    def __init__(self) -> None:
        self._values: dict[str, Any] = {}
        self._labels: dict[str, str] = {}
        self._source_keys: dict[str, str] = {}

    # ---- write side (only used by :func:`extract`) ----

    def set(
        self,
        key: str,
        value: Any,
        *,
        label: str,
        source_key: str | None = None,
    ) -> None:
        self._values[key] = value
        self._labels[key] = label
        if source_key:
            self._source_keys[key] = source_key

    # ---- read side (everything else) ----

    def get(self, key: str, default: Any = None) -> Any:
        return self._values.get(key, default)

    def has(self, key: str) -> bool:
        return key in self._values

    def label(self, key: str) -> str:
        return self._labels.get(key, key)

    def source_key(self, key: str) -> str | None:
        return self._source_keys.get(key)

    def items(self):
        """Iterate ``(key, value)`` pairs. Used by the SWOT
        composer to dump the full signal table into the response
        when ``include_signals`` is requested."""
        return self._values.items()

    def all_keys(self) -> list[str]:
        return list(self._values.keys())


def extract(*, intelligence: dict, scores: dict) -> SignalMap:
    """Build the signal table from the two input payloads.

    The signal key namespace is:

    * ``intelligence.<analyzer_key>.<breakdown_key>`` for raw
      intelligence breakdown items (numeric ``earned`` value)
    * ``intelligence.<analyzer_key>.score`` for analyzer headline
    * ``intelligence.<analyzer_key>.missing`` for the count of
      missing breakdown items
    * ``score.<score_key>.score`` for the 8 score headlines
    * ``score.<score_key>.level`` for the 4-band level string
    * ``signal.<short_name>`` for derived boolean flags
      (e.g. ``signal.has_export_history``)

    Keeping the namespace flat and namespaced means the rest of
    the engine never has to look at the raw payload structure.
    """
    s = SignalMap()

    # ---- Intelligence analyzers (5) ----
    for a in intelligence.get("analyzers", []):
        akey = a["key"]
        s.set(
            f"intelligence.{akey}.score",
            int(a.get("score", 0)),
            label=f"{a.get('title', akey)} score",
            source_key=akey,
        )
        for item in a.get("breakdown", []):
            s.set(
                f"intelligence.{akey}.{item['key']}",
                int(item.get("earned", 0)),
                label=f"{akey} / {item.get('label', item['key'])}",
                source_key=f"{akey}.{item['key']}",
            )
        s.set(
            f"intelligence.{akey}.missing_count",
            len(a.get("missing", [])),
            label=f"{akey} missing items",
            source_key=akey,
        )

    # Overall intelligence rollup
    overall = intelligence.get("overall") or {}
    s.set(
        "intelligence.overall.score",
        int(overall.get("score", 0)),
        label="Overall intelligence score",
        source_key="intelligence.overall",
    )

    # ---- Business scores (8) ----
    for sc in scores.get("scores", []):
        skey = sc["key"]
        s.set(
            f"score.{skey}.score",
            int(sc.get("score", 0)),
            label=f"{sc.get('title', skey)} score",
            source_key=f"score.{skey}",
        )
        s.set(
            f"score.{skey}.level",
            sc.get("level", "Low"),
            label=f"{sc.get('title', skey)} level",
            source_key=f"score.{skey}",
        )

    # Score summary (used for overall confidence)
    summary = scores.get("summary") or {}
    s.set(
        "score.summary.score",
        int(summary.get("score", 0)),
        label="Summary score",
        source_key="score.summary",
    )

    # ---- Derived boolean signals ----
    # These are the only "logic" in the extraction layer, and
    # they are simple thresholds with documented meaning.
    s.set(
        "signal.has_export_history",
        s.get("intelligence.export_readiness.export_history", 0) > 0,
        label="Has at least one export history row",
        source_key="export_readiness.export_history",
    )
    s.set(
        "signal.has_iec",
        s.get("intelligence.export_readiness.iec_number", 0) > 0,
        label="IEC number registered",
        source_key="export_readiness.iec_number",
    )
    s.set(
        "signal.has_active_cert",
        s.get("intelligence.compliance_readiness.active_certification", 0) > 0,
        label="Has at least one active certification",
        source_key="compliance_readiness.active_certification",
    )
    s.set(
        "signal.has_multiple_active_certs",
        s.get("intelligence.compliance_readiness.multiple_certifications", 0)
        >= 6,  # the analyzer awards 10 for 3+ active, 6 for 2
        label="Has 2+ active certifications",
        source_key="compliance_readiness.multiple_certifications",
    )
    s.set(
        "signal.has_website",
        s.get("intelligence.digital_readiness.website", 0) > 0,
        label="Has a business website",
        source_key="digital_readiness.website",
    )
    s.set(
        "signal.has_ecommerce",
        s.get("intelligence.digital_readiness.ecommerce", 0) > 0,
        label="E-commerce active",
        source_key="digital_readiness.ecommerce",
    )
    s.set(
        "signal.has_goals",
        s.get("intelligence.growth_readiness.goals_declared", 0) > 0,
        label="Has declared business goals",
        source_key="growth_readiness.goals_declared",
    )
    s.set(
        "signal.has_employees",
        s.get("intelligence.growth_readiness.employee_count", 0) > 0,
        label="Employees reported",
        source_key="growth_readiness.employee_count",
    )
    s.set(
        "signal.has_production_capacity",
        s.get("intelligence.growth_readiness.production_capacity_text", 0) > 0,
        label="Production capacity declared",
        source_key="growth_readiness.production_capacity_text",
    )
    s.set(
        "signal.revenue_reported",
        s.get("intelligence.profile_completeness.basic.annual_revenue", 0) > 0,
        label="Annual revenue reported",
        source_key="profile_completeness.basic.annual_revenue",
    )

    return s

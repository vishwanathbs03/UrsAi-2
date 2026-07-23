"""Signal extraction for the Rule Engine.

The Rule Engine consumes three payloads:

  1. ``intelligence`` (Sprint 2 Part 1) — 5 analyzers with
     per-analyzer scores + per-field breakdowns
  2. ``scores`` (Sprint 2 Part 2) — 8 scores with their 4-band
     levels + per-score contributing factors
  3. ``dna`` (Sprint 2 Part 3) — 1 archetype + 5 secondary
     traits + SWOT findings

The extractor flattens these into a :class:`RuleSignalMap` —
a small dictionary of numeric and boolean signals keyed by
stable names. Rules in the registry only ever read from this
table.

The signal key namespace:

* ``intelligence.<analyzer_key>.<breakdown_key>`` (numeric,
  the ``earned`` value of the breakdown item)
* ``intelligence.<analyzer_key>.score`` (numeric, 0..100)
* ``score.<score_key>.score`` (numeric, 0..100)
* ``score.<score_key>.level`` (string, the 4-band level)
* ``dna.archetype.key`` (string)
* ``dna.trait.<trait_key>`` (boolean — whether the trait is
  present)
* ``dna.finding.severity_high`` (numeric count — how many
  high-severity DNA findings the SWOT produced)
* ``flag.<short_name>`` (boolean — derived flags like
  ``has_iec``, ``has_export_history``)

Adding a new signal here makes it immediately available to
every rule in the registry.
"""

from __future__ import annotations

from typing import Any

from app.services.rules.base import RuleSignalMap


def _set(sig: RuleSignalMap, key: str, value: Any, *, label: str, source_key: str | None = None) -> None:
    """Internal helper: store a signal with its label and trace."""
    sig._values[key] = value
    sig._labels[key] = label
    if source_key:
        sig._source_keys[key] = source_key


def extract(
    *,
    intelligence: dict,
    scores: dict,
    dna: dict,
) -> RuleSignalMap:
    """Build the rule-engine signal table from the three inputs."""
    sig = RuleSignalMap()

    # ---- Intelligence analyzers (5) ----
    for a in intelligence.get("analyzers", []):
        akey = a["key"]
        _set(sig, f"intelligence.{akey}.score", int(a.get("score", 0)),
             label=f"{a.get('title', akey)} analyzer score",
             source_key=akey)
        for item in a.get("breakdown", []):
            _set(sig, f"intelligence.{akey}.{item['key']}", int(item.get("earned", 0)),
                 label=f"{akey} / {item.get('label', item['key'])}",
                 source_key=f"{akey}.{item['key']}")
    overall_i = intelligence.get("overall") or {}
    _set(sig, "intelligence.overall.score", int(overall_i.get("score", 0)),
         label="Overall intelligence score",
         source_key="intelligence.overall")

    # ---- Business scores (8) ----
    for sc in scores.get("scores", []):
        skey = sc["key"]
        _set(sig, f"score.{skey}.score", int(sc.get("score", 0)),
             label=f"{sc.get('title', skey)} score",
             source_key=f"score.{skey}")
        _set(sig, f"score.{skey}.level", sc.get("level", "Low"),
             label=f"{sc.get('title', skey)} level",
             source_key=f"score.{skey}")
    summary_s = scores.get("summary") or {}
    _set(sig, "score.summary.score", int(summary_s.get("score", 0)),
         label="Summary score",
         source_key="score.summary")

    # ---- DNA layer ----
    # The DNA service returns a payload wrapped as
    #   {"generated_at", "inputs", "dna": {archetype, ...}}
    # but a test or alternative caller may pass the inner dict
    # directly. Normalise to a single inner dict.
    dna_payload = dna if "archetype" in dna else (dna.get("dna") or {})
    archetype = dna_payload.get("archetype") or {}
    _set(sig, "dna.archetype.key", archetype.get("key", "foundation_builder"),
         label=f"DNA archetype: {archetype.get('title', 'unknown')}",
         source_key="dna.archetype")
    _set(sig, "dna.archetype.match_score", int(archetype.get("match_score", 0)),
         label="DNA archetype match score",
         source_key="dna.archetype")

    traits = dna_payload.get("secondary_traits", []) or []
    for t in traits:
        _set(sig, f"dna.trait.{t['key']}", bool(t.get("present", False)),
             label=f"DNA trait: {t.get('title', t['key'])}",
             source_key=f"dna.trait.{t['key']}")

    # Aggregate SWOT severity counts so rules can fire on
    # "how many high-severity findings" without iterating lists.
    sev_counts = {"info": 0, "low": 0, "medium": 0, "high": 0}
    for field in ("strengths", "weaknesses", "opportunities", "risk_areas"):
        for f in dna_payload.get(field, []) or []:
            s = f.get("severity", "info")
            sev_counts[s] = sev_counts.get(s, 0) + 1
    for s, n in sev_counts.items():
        _set(sig, f"dna.finding.severity_{s}", n,
             label=f"Count of {s}-severity DNA findings",
             source_key=f"dna.finding.{s}")

    # ---- Derived boolean flags ----
    _set(sig, "flag.has_export_history",
         sig.score("intelligence.export_readiness.export_history", 0) > 0,
         label="Has at least one export history row",
         source_key="export_readiness.export_history")
    _set(sig, "flag.has_iec",
         sig.score("intelligence.export_readiness.iec_number", 0) > 0,
         label="IEC number registered",
         source_key="export_readiness.iec_number")
    _set(sig, "flag.has_active_cert",
         sig.score("intelligence.compliance_readiness.active_certification", 0) > 0,
         label="Has at least one active certification",
         source_key="compliance_readiness.active_certification")
    _set(sig, "flag.has_website",
         sig.score("intelligence.digital_readiness.website", 0) > 0,
         label="Has a business website",
         source_key="digital_readiness.website")
    _set(sig, "flag.has_ecommerce",
         sig.score("intelligence.digital_readiness.ecommerce", 0) > 0,
         label="E-commerce active",
         source_key="digital_readiness.ecommerce")
    _set(sig, "flag.has_goals",
         sig.score("intelligence.growth_readiness.goals_declared", 0) > 0,
         label="Has declared business goals",
         source_key="growth_readiness.goals_declared")
    _set(sig, "flag.has_employees",
         sig.score("intelligence.growth_readiness.employee_count", 0) > 0,
         label="Employees reported",
         source_key="growth_readiness.employee_count")
    _set(sig, "flag.has_production_capacity",
         sig.score("intelligence.growth_readiness.production_capacity_text", 0) > 0,
         label="Production capacity declared",
         source_key="growth_readiness.production_capacity_text")
    _set(sig, "flag.revenue_reported",
         sig.score("intelligence.profile_completeness.basic.annual_revenue", 0) > 0,
         label="Annual revenue reported",
         source_key="profile_completeness.basic.annual_revenue")
    _set(sig, "flag.has_products",
         sig.score("intelligence.profile_completeness.products", 0) > 0,
         label="Has at least one product",
         source_key="profile_completeness.products")

    return sig

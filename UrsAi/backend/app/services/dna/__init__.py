"""Business DNA Engine.

The DNA engine is a deterministic classifier on top of the
Sprint 2 Part 1 (intelligence) and Part 2 (scoring) outputs.
It produces a single :class:`BusinessDNA` per call with seven
named fields: archetype, secondary traits, strengths,
weaknesses, opportunities, risk areas, confidence.

What the engine is NOT:

  * It is NOT a rule engine. The "rules" are explicit, named
    Python functions in :mod:`archetypes`, :mod:`traits`, and
    :mod:`swot`. There is no rule dispatcher to update when
    a new rule is added — just register it in the appropriate
    ``ALL_*`` tuple.
  * It does NOT call out to an LLM, a model, or any external
    service. Every line in the response is reproducible from
    the intelligence + score payloads.
  * It does NOT generate recommendations. The opportunities
    list is descriptive ("Export existing products"), not
    prescriptive ("Email supplier X by Friday").

Modules in this package:

  * ``base``              — result types (Archetype, Trait, Finding, DNA)
  * ``signal_extractor``  — flatten the two input payloads into a signal table
  * ``archetypes``        — 7 archetype classifiers
  * ``traits``            — 5 secondary-trait detectors
  * ``swot``              — strengths / weaknesses / opportunities / risks composer
  * ``confidence``        — confidence score formula
  * ``service``           — façade that wires everything together
"""

from app.services.dna.base import (
    Archetype,
    BusinessDNA,
    Finding,
    Rationale,
    SecondaryTrait,
)
from app.services.dna.service import BusinessDNAService

__all__ = [
    "Archetype",
    "BusinessDNA",
    "BusinessDNAService",
    "Finding",
    "Rationale",
    "SecondaryTrait",
]

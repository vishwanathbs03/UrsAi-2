"""Business Score Engine.

Generates deterministic, rule-based business scores from the
output of the Business Intelligence Engine (Sprint 2 Part 1).
The score layer is a pure transformation — no AI, no LLM, no
heuristics that aren't directly traceable to a breakdown key
from the intelligence analyzers.

Why two layers?
---------------

The intelligence engine already does the heavy lifting of reading
the Business Digital Twin, applying rubric weights, and producing
field-level breakdowns. Building a second parallel set of
field-reading rules in the score layer would mean two sources of
truth and double the test surface. Instead, the score layer:

  * reuses the analyzer scores for the 5 lifted scores
    (Overall, Export, Digital, Compliance, Growth) — the score
    is the same number, the level uses a finer 4-band system,
    and the explanation is written for the end user, not the
    wizard
  * composes signals from the analyzer breakdowns for the 3
    derived scores (Risk, Innovation, Sustainability) — these
    have no single source analyzer, so they pull specific
    breakdown items and weight them deterministically

Modules in this package:

  * ``base``        — shared result types
  * ``levels``      — 4-band scoring (Low / Medium / High / Excellent)
  * ``factors``     — ContributingFactor dataclass
  * ``scores_lifted``  — 5 calculators that lift an analyzer
  * ``scores_derived`` — 3 calculators that derive from multiple analyzers
  * ``service``     — façade that wires scores together
"""

from app.services.scoring.base import BusinessScore
from app.services.scoring.factors import ContributingFactor
from app.services.scoring.levels import level_for
from app.services.scoring.scores_derived import (
    InnovationScore,
    RiskScore,
    SustainabilityScore,
)
from app.services.scoring.scores_lifted import (
    ComplianceScore,
    DigitalScore,
    ExportScore,
    GrowthScore,
    OverallScore,
)
from app.services.scoring.service import BusinessScoreService

__all__ = [
    "BusinessScore",
    "ContributingFactor",
    "level_for",
    "BusinessScoreService",
    "OverallScore",
    "ExportScore",
    "DigitalScore",
    "ComplianceScore",
    "GrowthScore",
    "RiskScore",
    "InnovationScore",
    "SustainabilityScore",
]

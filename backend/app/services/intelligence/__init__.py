"""Business Intelligence Engine.

Generates structured, rule-based intelligence from the Business
Digital Twin. Deliberately does NOT use any AI, LLM, or external
model — every score is a deterministic function of the data the
user has entered. This makes the engine cheap to run, trivially
testable, and honest: a low score is never a hallucination.

The engine is composed of small, isolated analyzers (one per
"lens" on the business). Each analyzer exposes a uniform result
shape so the API response is consistent and the frontend can render
each section the same way.

Modules in this package:

  * ``base``        — shared result types
  * ``rules``       — tiny rule primitives (presence, recency, …)
  * ``analyzers``   — one class per lens (5 in total)
  * ``service``     — façade that wires analyzers together
"""

from app.services.intelligence.analyzers import (
    Analyzer,
    ComplianceReadinessAnalyzer,
    DigitalReadinessAnalyzer,
    ExportReadinessAnalyzer,
    GrowthReadinessAnalyzer,
    ProfileCompletenessAnalyzer,
)
from app.services.intelligence.base import AnalyzerResult, ScoreItem, level_for
from app.services.intelligence.service import IntelligenceService

__all__ = [
    "Analyzer",
    "AnalyzerResult",
    "ScoreItem",
    "level_for",
    "ProfileCompletenessAnalyzer",
    "ExportReadinessAnalyzer",
    "DigitalReadinessAnalyzer",
    "ComplianceReadinessAnalyzer",
    "GrowthReadinessAnalyzer",
    "IntelligenceService",
]

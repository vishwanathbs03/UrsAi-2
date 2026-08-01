"""Rule Engine — deterministic rule firings over the
intelligence + score + DNA layers.

The engine is composed of:

  * :mod:`app.services.rules.base`           — shared types
  * :mod:`app.services.rules.signal_extractor` — flatten the three payloads
  * :mod:`app.services.rules.rules_*`         — one module per category
  * :mod:`app.services.rules.registry`        — single iteration point
  * :mod:`app.services.rules.engine`          — façade + service

The engine is NOT a recommendation system, a chat, a RAG
pipeline, or an LLM call. Every line of the response is
reproducible from the three input payloads.
"""

from app.services.rules.base import (
    CATEGORIES,
    PRIORITIES,
    RuleDef,
    RuleFiring,
    RuleSignalMap,
)
from app.services.rules.engine import RuleEngine, RuleEngineService

__all__ = [
    "CATEGORIES",
    "PRIORITIES",
    "RuleDef",
    "RuleFiring",
    "RuleSignalMap",
    "RuleEngine",
    "RuleEngineService",
]

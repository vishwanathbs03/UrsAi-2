"""Public exports for the Recommendation Intelligence Engine.

The service façade is the only export the endpoint needs.
The helper modules are importable for unit tests but are
intentionally not re-exported here — they are private
implementation details of the engine.
"""

from app.services.recommendations.service import RecommendationService


__all__ = ["RecommendationService"]

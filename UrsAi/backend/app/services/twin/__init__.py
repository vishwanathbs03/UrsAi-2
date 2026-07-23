"""Public exports for the Business Digital Twin engine.

The service façade is the only export the endpoint
needs. The helper modules (aggregator, snapshot,
timeline, risk_matrix, opportunity_matrix, health)
are importable for unit tests but are intentionally
not re-exported here — they are private
implementation details of the engine.
"""

from app.services.twin.service import TwinService


__all__ = ["TwinService"]

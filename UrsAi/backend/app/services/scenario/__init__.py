"""Public exports for the Business Scenario Simulator.

The service façade is the only export the endpoint
needs. The helper modules (clone, mutations, delta,
impact) are importable for unit tests but are
intentionally not re-exported here — they are private
implementation details of the engine.
"""

from app.services.scenario.service import ScenarioService


__all__ = ["ScenarioService"]

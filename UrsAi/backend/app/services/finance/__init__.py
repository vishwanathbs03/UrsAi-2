"""Public exports for the Financial ROI
engine.

The service façade is the only export the
endpoint needs. The helper modules
(aggregator, roi, projections, valuation,
funding, exports, summary) are importable
for unit tests but are intentionally not
re-exported here — they are private
implementation details of the engine.
"""

from app.services.finance.service import FinanceService


__all__ = ["FinanceService"]

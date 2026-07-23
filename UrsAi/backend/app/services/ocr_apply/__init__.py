"""Public exports for the OCR Review &
Apply engine.

The service façade is the only
export the endpoint needs. The
helper modules (base, mapper,
validator, applier) are importable
for unit tests but are intentionally
not re-exported here — they are
private implementation details of
the engine.
"""

from app.services.ocr_apply.service import OCRApplyService


__all__ = ["OCRApplyService"]

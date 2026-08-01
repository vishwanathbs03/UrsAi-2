"""Public exports for the OCR ingestion engine.

The service façade is the only export the
endpoint needs. The helper modules (parser,
extractors, validators, mapper, confidence)
and the provider abstraction (base) are
importable for unit tests but are
intentionally not re-exported here — they
are private implementation details of the
engine.
"""

from app.services.ocr.service import OCRService


__all__ = ["OCRService"]

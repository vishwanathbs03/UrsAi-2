"""Application logging configuration."""

import logging
import sys
from typing import Optional

from app.config.settings import get_settings

_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def configure_logging(level: Optional[str] = None) -> None:
    """Configure root logging. Idempotent — safe to call multiple times."""
    settings = get_settings()
    log_level = (level or settings.log_level).upper()

    root = logging.getLogger()
    root.setLevel(log_level)

    # Remove pre-existing handlers (e.g. uvicorn defaults) so output stays clean.
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT))
    root.addHandler(handler)

    # Quiet down noisy third-party loggers.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger."""
    return logging.getLogger(name)

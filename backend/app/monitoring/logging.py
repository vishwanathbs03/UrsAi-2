"""Structured JSON logging for Atlas AI.

Sprint 8 Part 2 — Monitoring & Observability.

Every log line is a single JSON object. The schema is intentionally
narrow so a downstream log shipper (or a `jq` query on the host) can
parse it without guessing. The format is:

    {
      "timestamp": "2026-07-27T10:00:00.123Z",
      "level":     "INFO",
      "logger":    "app.api.v1.endpoints.decision",
      "message":   "request handled",
      "request_id": "5f9a...",
      "method":    "GET",
      "path":      "/api/v1/business/decision",
      "duration_ms": 42,
      "status":    200,
      "user_id":   17         // only when authenticated
    }

Fields the spec forbids are NEVER emitted. The structured-access log
format is also redacted by the ``RequestLogger`` so password / token /
cookie values cannot leak even if a handler accidentally passes them
in. OCR documents and uploaded file payloads are not logged at all;
only metadata (filename, size) if explicitly opted in by the caller.
"""

from __future__ import annotations

import json
import logging
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Mapping

from app.config.settings import get_settings


# --------------------------------------------------------------------------- #
# Redaction
# --------------------------------------------------------------------------- #

# Substrings that, if found in a log key, cause the value to be
# replaced with "[REDACTED]". Matches are case-insensitive and
# substring-based so common variants (e.g. "password_confirmation",
# "access_token", "auth_cookie") are all caught without the operator
# having to maintain a long list of exact matches.
_REDACT_KEYS = re.compile(
    r"(password|passwd|token|secret|api[_-]?key|cookie|session|authorization)",
    re.IGNORECASE,
)

# Substring patterns in free-text log messages that signal a literal
# value follows (e.g. "Bearer eyJ..."). The match consumes the value
# up to the next whitespace.
_REDACT_VALUE = re.compile(
    r"(?i)\b(?:password|passwd|token|secret|api[_-]?key|cookie|authorization)"
    r"\s*[:=]\s*\"?([^\s\",;}]+)?",
)


def _redact(obj: Any) -> Any:
    """Recursively redact secret-looking fields from a dict / list."""
    if isinstance(obj, Mapping):
        return {
            k: ("[REDACTED]" if _REDACT_KEYS.search(str(k)) else _redact(v))
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return [_redact(v) for v in obj]
    if isinstance(obj, str):
        return _REDACT_VALUE.sub(
            lambda m: f'{m.group(0).split(m.group(1))[0]}[REDACTED]',
            obj,
        )
    return obj


# --------------------------------------------------------------------------- #
# JSON formatter
# --------------------------------------------------------------------------- #

class JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line on stdout.

    Extra fields passed via ``logger.info("msg", extra={...})`` are
    merged into the JSON payload. Standard ``LogRecord`` attributes are
    surfaced under stable names (``timestamp``, ``level``, ``logger``,
    ``message``) and do not collide with the request-scoped fields
    emitted by the access logger.
    """

    # Fields the LogRecord populates that we do NOT want to serialise
    # (they duplicate or conflict with our explicit fields).
    _DROP_RECORD_KEYS = frozenset({
        "args", "msg", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno",
        "funcName", "created", "msecs", "relativeCreated", "thread",
        "threadName", "processName", "process", "name", "message",
        "asctime", "taskName",
    })

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc,
            ).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key in self._DROP_RECORD_KEYS or key.startswith("_"):
                continue
            payload[key] = _redact(value)
        # Serialise to a stable, compact JSON line.
        return json.dumps(payload, default=str, ensure_ascii=False)


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

_JSON_FORMATTER = JsonFormatter()

_ACCESS_LOGGER_NAME = "atlas.access"


def configure_structured_logging(level: str | None = None) -> None:
    """Install the JSON formatter on the root logger.

    Idempotent — calling twice does not duplicate handlers. Replaces
    the existing handler so calling this after ``app.config.logging``'s
    plain-text setup swaps the format without growing the handler list.
    """
    settings = get_settings()
    log_level = (level or settings.log_level).upper()

    root = logging.getLogger()
    root.setLevel(log_level)

    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(_JSON_FORMATTER)
    root.addHandler(handler)

    # Quiet down noisy third-party loggers (uvicorn access / httpx).
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_access_logger() -> logging.Logger:
    """Return the per-request access logger.

    The access logger is a named child of the root logger, so JSON
    output goes to the same handler but operators can filter the
    access stream independently in their log shipper.
    """
    return logging.getLogger(_ACCESS_LOGGER_NAME)


# --------------------------------------------------------------------------- #
# Per-request access log
# --------------------------------------------------------------------------- #


class RequestTimer:
    """Tiny helper that captures a monotonic start time and reports
    elapsed milliseconds at log time.

    Centralised here so the request-id middleware and the error
    middleware can both record the duration without duplicating the
    ``time.perf_counter`` call.
    """

    __slots__ = ("_start",)

    def __init__(self) -> None:
        self._start = time.perf_counter()

    def reset(self) -> None:
        self._start = time.perf_counter()

    def elapsed_ms(self) -> float:
        return (time.perf_counter() - self._start) * 1000.0

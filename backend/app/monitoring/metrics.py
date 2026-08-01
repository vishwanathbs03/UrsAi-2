"""Prometheus metrics registry for Atlas AI.

Sprint 8 Part 2 — Monitoring & Observability.

The registry is process-local (one in-process registry per gunicorn
worker); the Prometheus server aggregates across workers at scrape
time.

Metric naming follows the Prometheus convention:

  * ``atlas_<unit>_<suffix>`` where the unit is a single word
    (``http``, ``process``) and the suffix describes the shape
    (``requests_total``, ``request_duration_seconds``,
    ``exceptions_total``).
  * Counters end in ``_total``; histograms carry a ``_seconds`` suffix
    so the unit is self-documenting.
  * The ``endpoint`` label uses the URL path template (e.g.
    ``/api/v1/business/decision``), not the raw path, so high-cardinality
    URLs do not blow up the time-series database.
"""

from __future__ import annotations

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram

# A private registry so we can isolate our metrics from the default
# global registry. This makes testing simpler (you can inspect the
# registry directly) and avoids "duplicate timeseries" errors if the
# app is imported twice in the same process (e.g. by pytest).
REGISTRY = CollectorRegistry(auto_describe=True)


# --------------------------------------------------------------------------- #
# Request-level metrics
# --------------------------------------------------------------------------- #

REQUEST_TOTAL = Counter(
    "atlas_http_requests_total",
    "Total HTTP requests served by the backend.",
    labelnames=("method", "endpoint", "status"),
    registry=REGISTRY,
)

REQUEST_ACTIVE = Gauge(
    "atlas_http_requests_active",
    "In-flight HTTP requests currently being served.",
    labelnames=("method", "endpoint"),
    registry=REGISTRY,
)

REQUEST_DURATION = Histogram(
    "atlas_http_request_duration_seconds",
    "HTTP request handler duration in seconds.",
    labelnames=("method", "endpoint"),
    # Buckets cover sub-millisecond OCR/AI callbacks up to multi-second
    # LLM roundtrips. The bucket boundaries are powers of 2 with a
    # 5s upper edge so a 30s timeout is clearly visible.
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=REGISTRY,
)

ENDPOINT_COUNT = Counter(
    "atlas_http_endpoint_hits_total",
    "Total hits per endpoint (ignoring status code).",
    labelnames=("method", "endpoint"),
    registry=REGISTRY,
)

STATUS_COUNT = Counter(
    "atlas_http_status_codes_total",
    "Total responses grouped by HTTP status family (2xx, 4xx, 5xx).",
    labelnames=("method", "endpoint", "status"),
    registry=REGISTRY,
)

EXCEPTION_COUNT = Counter(
    "atlas_http_exceptions_total",
    "Total uncaught exceptions raised by request handlers.",
    labelnames=("method", "endpoint", "exception_type"),
    registry=REGISTRY,
)


# --------------------------------------------------------------------------- #
# Service health gauges (sampled by /health/ready, not per-request)
# --------------------------------------------------------------------------- #

DB_REACHABLE = Gauge(
    "atlas_db_reachable",
    "1 if the database is reachable on the most recent probe, 0 otherwise.",
    registry=REGISTRY,
)

KNOWLEDGE_LOADED = Gauge(
    "atlas_knowledge_loaded",
    "1 if the knowledge catalog is loaded into the in-process repository.",
    registry=REGISTRY,
)

AI_READY = Gauge(
    "atlas_ai_ready",
    "1 if the AI decision service initialised successfully.",
    registry=REGISTRY,
)

APP_UPTIME = Gauge(
    "atlas_app_uptime_seconds",
    "Seconds since the backend process started.",
    registry=REGISTRY,
)

BUILD_INFO = Gauge(
    "atlas_build_info",
    "Static 1 gauge carrying build / version labels.",
    labelnames=("version", "env"),
    registry=REGISTRY,
)

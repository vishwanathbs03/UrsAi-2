"""Prometheus metrics registry for Atlas AI.

Sprint 8 Part 2 — Monitoring & Observability.

This package is the single source of truth for every metric the backend
exposes on ``/metrics`` and every structured-log helper the middleware
uses. Public surface:

  * :mod:`app.monitoring.metrics`  — Prometheus collectors
  * :mod:`app.monitoring.logging`   — JSON formatter + request logger
  * :mod:`app.monitoring.middleware` — request-id + error middleware
  * :mod:`app.monitoring.health`    — ``/health``, ``/health/live``,
                                       ``/health/ready`` routes

The collectors are imported by ``app.monitoring.middleware`` and
``app.monitoring.health``; they are NOT imported transitively by
``app.main`` so the rest of the app can boot without Prometheus
installed (e.g. for a minimal CI smoke test).
"""

from __future__ import annotations

from app.monitoring import health, logging, metrics, middleware

__all__ = ["health", "logging", "metrics", "middleware"]

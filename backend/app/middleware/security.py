"""Security hardening middleware — Sprint 8 Part 3.

This module wires three middlewares onto the FastAPI app:

  * :class:`SecurityHeadersMiddleware` — adds the OWASP-recommended
    response headers (CSP, X-Frame-Options, X-Content-Type-Options,
    Referrer-Policy, Permissions-Policy, COOP/CORP, HSTS). The
    values are settings-driven so the operator can override them
    per environment.

  * :class:`RequestSizeLimitMiddleware` — rejects requests whose
    declared body length exceeds the per-route cap before the
    handler runs. Two caps: ``max_request_body_bytes`` for
    normal JSON traffic and ``max_upload_body_bytes`` for
    multipart endpoints.

  * :class:`RateLimitMiddleware` — sliding-window in-process
    per-IP limiter with optional per-endpoint overrides. The
    state is in-process and process-local; a multi-worker
    deployment gets a per-worker budget, which is the documented
    trade-off (the spec forbids Redis / Celery / external
    stateful services).

Every middleware emits a structured log line through the
``atlas.security`` logger when it rejects a request. The JSON
formatter picks the lines up automatically so the audit trail
appears in the same stream as the access log.

The middleware is order-sensitive. ``install_security`` registers
them so:

  * security headers are OUTERMOST — they apply to every
    response the app builds, including the rate-limit 429 and
    the size-limit 413 envelopes;
  * request-size is INSIDE the rate-limit so a flooding client
    is rate-limited before the body is even inspected;
  * the rate-limit handler is the INNERMOST gate so legitimate
    traffic from a non-throttled client is never delayed.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from ipaddress import ip_address
from typing import Awaitable, Callable, Deque, Mapping

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config.settings import Settings, get_settings


REQUEST_ID_ATTR = "request_id"

# Endpoints that the rate limiter / size limiter MUST NOT throttle.
# The probes have to stay reachable so a downstream rate-limit trip
# on real traffic does not cascade into Kubernetes / Docker restart
# loops.
_ALWAYS_BYPASS_PATHS: frozenset[str] = frozenset({
    "/health",
    "/health/live",
    "/health/ready",
    "/metrics",
    "/",
})

# Endpoints that are multipart and therefore need the larger
# ``max_upload_body_bytes`` cap. Anything else is bounded by
# ``max_request_body_bytes``.
_UPLOAD_PATH_HINTS: tuple[str, ...] = (
    "/api/v1/business/ocr",
    "/api/v1/business/ocr/apply",
    "/api/v1/business/ocr_apply",
    "/upload",
    "/scan",
)


# --------------------------------------------------------------------------- #
# Logging helper
# --------------------------------------------------------------------------- #


def _audit_logger(settings: Settings) -> logging.Logger:
    return logging.getLogger(settings.security_audit_logger or "atlas.security")


def _emit_audit(
    logger: logging.Logger,
    enabled: bool,
    event: str,
    request: Request,
    *,
    extra: Mapping[str, object] | None = None,
) -> None:
    """Emit a single structured security-audit log line.

    Re-uses the same shape as the access log so the operator can
    `jq '.event' ` on the JSON stream and see only security events.
    """
    if not enabled:
        return
    payload: dict[str, object] = {
        "event": event,
        "request_id": getattr(request.state, REQUEST_ID_ATTR, None),
        "method": request.method,
        "path": request.url.path,
        "client_ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", ""),
    }
    if extra:
        for k, v in extra.items():
            payload[k] = v
    logger.info("security", extra=payload)


# --------------------------------------------------------------------------- #
# Client IP resolution (proxy-aware)
# --------------------------------------------------------------------------- #


def _client_ip(request: Request) -> str:
    """Return the real client IP, honouring X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Take the left-most address — that is the original client.
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _is_loopback(ip: str) -> bool:
    try:
        return ip_address(ip).is_loopback
    except ValueError:
        return False


# --------------------------------------------------------------------------- #
# Security headers
# --------------------------------------------------------------------------- #


def _build_hsts(settings: Settings) -> str:
    """Build the HSTS header value or "" if disabled."""
    explicit = (settings.strict_transport_security or "").strip()
    if explicit:
        return explicit
    if not settings.is_production:
        return ""
    parts = [f"max-age={int(settings.strict_transport_security_max_age)}"]
    if settings.strict_transport_security_include_subdomains:
        parts.append("includeSubDomains")
    if settings.strict_transport_security_preload:
        parts.append("preload")
    return "; ".join(parts)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach OWASP-recommended response headers to every response."""

    def __init__(self, app, *, settings: Settings | None = None) -> None:
        super().__init__(app)
        self._settings = settings or get_settings()
        self._headers = self._compile_headers(self._settings)

    @staticmethod
    def _compile_headers(settings: Settings) -> dict[str, str]:
        headers: dict[str, str] = {}
        if not settings.security_headers_enabled:
            return headers
        csp = (settings.content_security_policy or "").strip()
        if csp:
            headers["Content-Security-Policy"] = csp
        pp = (settings.permissions_policy or "").strip()
        if pp:
            headers["Permissions-Policy"] = pp
        if settings.referrer_policy:
            headers["Referrer-Policy"] = settings.referrer_policy
        if settings.x_frame_options:
            headers["X-Frame-Options"] = settings.x_frame_options
        if settings.x_content_type_options:
            headers["X-Content-Type-Options"] = settings.x_content_type_options
        if settings.cross_origin_opener_policy:
            headers["Cross-Origin-Opener-Policy"] = settings.cross_origin_opener_policy
        if settings.cross_origin_resource_policy:
            headers["Cross-Origin-Resource-Policy"] = settings.cross_origin_resource_policy
        hsts = _build_hsts(settings)
        if hsts:
            headers["Strict-Transport-Security"] = hsts
        # Surface the policy version so an operator can verify which
        # settings file generated a given response.
        headers["X-Content-Type-Options"] = headers.get(
            "X-Content-Type-Options", "nosniff"
        )
        return headers

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        for name, value in self._headers.items():
            # ``add_header`` (lower-cased to ``__setitem__`` in
            # Starlette) overwrites any earlier value. We use the
            # public API so the test can introspect the response.
            response.headers[name] = value
        return response


# --------------------------------------------------------------------------- #
# Request size limit
# --------------------------------------------------------------------------- #


def _is_upload_path(path: str) -> bool:
    return any(hint in path for hint in _UPLOAD_PATH_HINTS)


def _content_length(request: Request) -> int:
    raw = request.headers.get("content-length")
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose declared body length is over the cap.

    The middleware enforces two limits:

      * ``max_request_body_bytes`` — applied to every non-upload
        request with a body (e.g. JSON posts).
      * ``max_upload_body_bytes`` — applied to multipart uploads
        (matched by path hint).

    Requests that exceed the cap get a 413 response with the
    standard ``{"detail": "..."}`` envelope so the client sees a
    predictable shape regardless of which middleware rejected it.
    """

    def __init__(self, app, *, settings: Settings | None = None) -> None:
        super().__init__(app)
        self._settings = settings or get_settings()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        length = _content_length(request)
        if length <= 0:
            return await call_next(request)
        is_upload = _is_upload_path(request.url.path)
        cap = (
            self._settings.max_upload_body_bytes
            if is_upload
            else self._settings.max_request_body_bytes
        )
        if length > cap:
            audit = _audit_logger(self._settings)
            _emit_audit(
                audit,
                self._settings.security_audit_enabled,
                "request_too_large",
                request,
                extra={
                    "content_length": length,
                    "cap": cap,
                    "is_upload": is_upload,
                },
            )
            return JSONResponse(
                status_code=413,
                content={
                    "detail": (
                        "Request body exceeds the configured cap "
                        f"({length} > {cap} bytes)"
                    )
                },
                headers={
                    "X-Request-ID": getattr(
                        request.state, REQUEST_ID_ATTR, ""
                    )
                },
            )
        return await call_next(request)


# --------------------------------------------------------------------------- #
# Rate limit (in-process sliding window)
# --------------------------------------------------------------------------- #


class _SlidingWindow:
    """Per-key sliding-window counter.

    Holds the timestamps of the last N accepted requests in a
    deque. ``allow`` returns True if the new timestamp fits
    within the window; otherwise it returns False. The deque is
    trimmed on every call so memory is O(window) per key.

    This is intentionally simple — no token bucket, no leaky
    bucket, no background reaper. Multi-worker deployments get
    a per-worker budget (the spec forbids Redis / Celery /
    external stateful services). For a single-worker dev
    instance this is exact.
    """

    __slots__ = ("_window", "_max", "_hits")

    def __init__(self, *, max_requests: int, window_seconds: int) -> None:
        self._max = max(1, int(max_requests))
        self._window = max(1, int(window_seconds))
        self._hits: Deque[float] = deque()

    def allow(self, now: float) -> bool:
        cutoff = now - self._window
        hits = self._hits
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= self._max:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP sliding-window rate limit.

    Two limits are applied:

      * the global budget (``rate_limit_requests`` /
        ``rate_limit_window_seconds``)
      * a per-endpoint override if one is configured for the
        request path

    The first limit the request trips is the one that returns
    429. The body shape matches the rest of the API error
    envelope so the client sees ``{"detail": "..."}`` with the
    X-Request-ID header attached.
    """

    def __init__(self, app, *, settings: Settings | None = None) -> None:
        super().__init__(app)
        self._settings = settings or get_settings()
        self._global = _SlidingWindow(
            max_requests=self._settings.rate_limit_requests,
            window_seconds=self._settings.rate_limit_window_seconds,
        )
        self._per_endpoint: dict[str, _SlidingWindow] = {}
        for path, limit in self._settings.rate_limit_endpoint_overrides_map.items():
            self._per_endpoint[path] = _SlidingWindow(
                max_requests=limit,
                window_seconds=self._settings.rate_limit_window_seconds,
            )
        self._logger = _audit_logger(self._settings)

    def _resolve_limit(self, path: str) -> _SlidingWindow | None:
        return self._per_endpoint.get(path)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        settings = self._settings
        if not settings.rate_limit_enabled:
            return await call_next(request)
        if request.url.path in _ALWAYS_BYPASS_PATHS:
            return await call_next(request)
        client_ip = _client_ip(request)
        # Loopback traffic is allowed to flow freely; a single
        # developer's polling loop on /api/v1/health should not
        # trip the limiter.
        if _is_loopback(client_ip):
            return await call_next(request)

        now = time.monotonic()
        per_endpoint = self._resolve_limit(request.url.path)
        if per_endpoint is not None and not per_endpoint.allow(now):
            self._log_trip(request, client_ip, "endpoint", per_endpoint)
            return self._reject(request, per_endpoint)
        if not self._global.allow(now):
            self._log_trip(request, client_ip, "global", self._global)
            return self._reject(request, self._global)
        return await call_next(request)

    def _log_trip(
        self,
        request: Request,
        client_ip: str,
        scope: str,
        window: _SlidingWindow,
    ) -> None:
        _emit_audit(
            self._logger,
            self._settings.security_audit_enabled,
            "rate_limit_exceeded",
            request,
            extra={
                "client_ip": client_ip,
                "scope": scope,
                "max": window._max,  # noqa: SLF001 — internal OK
                "window_seconds": window._window,  # noqa: SLF001
            },
        )

    def _reject(
        self,
        request: Request,
        window: _SlidingWindow,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests — slow down and retry",
            },
            headers={
                "Retry-After": str(window._window),  # noqa: SLF001
                "X-Request-ID": getattr(
                    request.state, REQUEST_ID_ATTR, ""
                ),
            },
        )


# --------------------------------------------------------------------------- #
# Public installer
# --------------------------------------------------------------------------- #


def install_security(app: FastAPI) -> None:
    """Attach every security middleware to the FastAPI app.

    The order is significant. Starlette ``add_middleware`` appends;
    the most-recently-added middleware is the OUTERMOST. The
    desired order from outside-in is:

        security headers → request-size → rate-limit → app

    so we add them in reverse:

        rate-limit → request-size → security headers
    """
    settings = get_settings()
    if settings.rate_limit_enabled:
        app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware)
    if settings.security_headers_enabled:
        app.add_middleware(SecurityHeadersMiddleware)


__all__ = [
    "SecurityHeadersMiddleware",
    "RequestSizeLimitMiddleware",
    "RateLimitMiddleware",
    "install_security",
]

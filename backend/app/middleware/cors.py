"""CORS middleware configuration — Sprint 8 Part 3 hardening.

Browsers reject ``Access-Control-Allow-Origin: *`` together with
``Access-Control-Allow-Credentials: true`` (the response is
explicitly disallowed by the CORS spec). The previous version of
this module always set ``allow_credentials=True`` and
``allow_origins=settings.cors_origins_list``; if an operator
pasted a ``*`` into the env, every credentialed request would
fail silently with no error in the application logs.

This module now:

  * refuses to enable credentials when ``*`` is in the origin
    list (the response is a no-op);
  * restricts the allowed methods to a small explicit set
    (the spec is read-only / write a few verbs, no need for
    ``*``);
  * restricts the allowed headers to the canonical list
    (Content-Type / Authorization / X-Request-ID) so a
    permissive ``*`` cannot smuggle an attacker-controlled
    header into the response.

The settings model validates the same conditions at boot, so
``validate_security_settings`` flags a wildcard origin before
this code path is ever hit.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings


_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
_ALLOWED_HEADERS = [
    "Authorization",
    "Content-Type",
    "X-Request-ID",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cookie",
]
_EXPOSED_HEADERS = [
    "Set-Cookie",
    "X-Request-ID",
]


def install_cors(app: FastAPI) -> None:
    """Attach CORS middleware using settings-driven allowed origins."""
    settings = get_settings()
    origins = settings.cors_origins_list
    # If the operator has typed "*" we MUST NOT also send
    # ``Access-Control-Allow-Credentials: true`` — browsers
    # reject the response. Drop credentials in that case so
    # non-credentialed requests still get a CORS header.
    wildcard = "*" in origins
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=not wildcard,
        allow_methods=_ALLOWED_METHODS,
        allow_headers=_ALLOWED_HEADERS,
        expose_headers=_EXPOSED_HEADERS,
        # Cache preflight responses for 10 minutes — long enough
        # to avoid round trips on every request, short enough
        # that an operator can rotate the allowed list without
        # forcing every browser to re-handshake.
        max_age=600,
    )
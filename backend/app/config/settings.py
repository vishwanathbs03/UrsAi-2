"""Application configuration loader.

Centralizes environment-driven settings using pydantic-settings.
Loaded once at startup and shared across the app via get_settings().
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Atlas AI"
    app_env: str = "development"
    app_debug: bool = True
    app_version: str = "1.0.0"
    # Sprint 9 Part 2 — read the canonical VERSION file at the repo
    # root on first settings construction so the running container
    # always reports the same version as the release tag. The
    # operator can still override with APP_VERSION.
    _resolved_from_version_file: bool = False

    @field_validator("app_version", mode="before")
    @classmethod
    def _read_version_file(cls, v: object) -> object:
        # If the operator set APP_VERSION, honour it.
        if isinstance(v, str) and v.strip():
            return v
        # Otherwise, attempt to read the repo-root VERSION file.
        from pathlib import Path
        here = Path(__file__).resolve()
        for ancestor in [here.parent, *here.parents]:
            candidate = ancestor / "VERSION"
            if candidate.is_file():
                try:
                    return candidate.read_text(encoding="utf-8").strip()
                except OSError:
                    pass
        # Fall back to the typed default ("1.0.0").
        return "1.0.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Logging
    log_level: str = "INFO"

    # Database
    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/atlas_ai"
    )
    database_echo: bool = False

    # AI provider layer (Sprint 7 Part 2).
    # AI_PROVIDER selects the provider to use at runtime:
    #   "ollama"     - real Ollama HTTP provider (requires OLLAMA_BASE_URL
    #                  reachable); falls back to deterministic locally when
    #                  the upstream is unreachable
    #   "placeholder" / "disabled" / any other value
    #                - no real provider; the layer still works because the
    #                  factory returns the deterministic fallback
    ai_provider: str = "placeholder"
    ai_api_key: str = ""

    # Ollama-specific. Both default to the Ollama-documented values.
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    # Per-request timeout, seconds. Ollama cold-start on a small CPU box
    # can easily exceed 30s for the first call; 60s is a pragmatic
    # compromise between "give the model room" and "do not block the API
    # forever". Override per environment if you have a GPU.
    ai_request_timeout_seconds: float = 60.0

    # Authentication (Sprint 1 Part 3)
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_httponly: bool = True

    # ------------------------------------------------------------------ #
    # Sprint 8 Part 3 — Security hardening.
    #
    # Every value below has a safe default so a developer who only sets
    # `APP_ENV=production` still gets a hardened surface. Production
    # overlays in deployment/env/*.example set the stricter values.
    # ------------------------------------------------------------------ #

    # Trusted proxy hops. nginx sits in front of the app and forwards
    # X-Forwarded-For. We trust the first N hops (one per proxy in the
    # chain) so the rate limiter can key on the real client IP.
    trusted_proxy_hops: int = 1

    # Rate limiting. The security middleware applies a sliding-window
    # per-IP limit. The defaults are conservative — production overlays
    # can raise them. ``rate_limit_enabled`` lets a developer disable
    # the limiter in tests.
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60

    # Per-endpoint tighter cap. OCR and other expensive endpoints get
    # their own budget so a single client cannot exhaust the global
    # budget by hammering uploads. Empty list = no per-endpoint caps.
    rate_limit_endpoint_overrides: str = (
        "/api/v1/business/ocr:10,/api/v1/business/ocr/apply:10,"
        "/api/v1/auth/login:10,/api/v1/auth/register:5"
    )

    # Request size limits. nginx matches the body size, so this is
    # the second line of defence — anything nginx misses (e.g.
    # direct-to-backend traffic in dev) still gets capped.
    max_request_body_bytes: int = 1_048_576          # 1 MiB JSON
    max_upload_body_bytes: int = 26_214_400         # 25 MiB multipart

    # Security headers. The middleware adds these on every response;
    # nginx also sets them so the policy is enforced at both layers
    # (defence in depth). The defaults below match the OWASP Secure
    # Headers Project recommendations.
    security_headers_enabled: bool = True
    content_security_policy: str = (
        "default-src 'self'; "
        "img-src 'self' data: blob: https://fastapi.tiangolo.com; "
        "font-src 'self' data:; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    permissions_policy: str = (
        "camera=(), microphone=(), geolocation=(), "
        "payment=(), usb=(), magnetometer=(), gyroscope=(), "
        "accelerometer=(), interest-cohort=()"
    )
    referrer_policy: str = "strict-origin-when-cross-origin"
    x_frame_options: str = "DENY"
    x_content_type_options: str = "nosniff"
    cross_origin_opener_policy: str = "same-origin"
    cross_origin_resource_policy: str = "same-origin"
    # HSTS only when the app is actually behind TLS. Off in
    # development so the local http://127.0.0.1:8000 keeps working.
    strict_transport_security: str = ""
    # HSTS preload list needs a 1-year min-age + includeSubDomains +
    # preload. We expose them separately so the operator can opt in.
    strict_transport_security_max_age: int = 31_536_000
    strict_transport_security_include_subdomains: bool = True
    strict_transport_security_preload: bool = False

    # Security audit log channel. The middleware emits a structured
    # log line for every security-relevant event (rate-limit trip,
    # oversized body, blocked origin, suspicious user agent). The
    # JSON formatter picks them up automatically — we just give the
    # logger a stable name so operators can filter on it.
    security_audit_logger: str = "atlas.security"
    security_audit_enabled: bool = True

    # Cookie hardening knobs (consumed by app.middleware.security in
    # addition to the auth endpoint's existing config).
    cookie_path: str = "/"
    cookie_max_age_seconds: int = 3_600

    # ------------------------------------------------------------------ #
    # Sprint 8 Part 4 — Performance optimization.
    #
    # All values have safe defaults; production overlays raise the
    # connection pool size to match the gunicorn worker count.
    # ------------------------------------------------------------------ #

    # Response compression. GZipMiddleware (Starlette) compresses
    # every response whose body is larger than ``gzip_minimum_size``
    # AND whose Content-Type matches one of the listed patterns.
    # nginx is the public-side compressor; this is the second line
    # of defence for direct-to-backend traffic (dev / tests).
    gzip_enabled: bool = True
    gzip_minimum_size: int = 1024
    gzip_compress_level: int = 5

    # Connection pooling. The production overlay sets
    # db_pool_size = gunicorn workers * gunicorn threads and
    # db_pool_max_overflow = db_pool_size so the pool absorbs
    # short bursts without churning. db_pool_pre_ping kills
    # stale connections that an upstream load-balancer has
    # silently dropped.
    db_pool_size: int = 5
    db_pool_max_overflow: int = 10
    db_pool_pre_ping: bool = True
    db_pool_recycle_seconds: int = 1800
    db_pool_timeout_seconds: int = 30
    db_echo: bool = False

    # Static configuration cache TTL (seconds). The Settings
    # class is already an lru_cache singleton, so this knob
    # only matters for things we explicitly choose NOT to
    # cache (e.g. JWT decode config). The 0 default means
    # "do not bust the cache"; >0 schedules a periodic refresh.
    static_config_cache_ttl_seconds: int = 0

    # ETag / cache headers for /health. The endpoint returns
    # counters that change on every request, so by default we
    # tell intermediaries "do not cache". The middleware
    # exposes the knob so an operator can opt-in to a 1-second
    # cache on the dashboard page if it makes sense.
    health_response_cache_control: str = "no-store, max-age=0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _normalize_cors(cls, value):
        """Accept either a string or an already-parsed list."""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return ",".join(value)
        return value

    @field_validator("rate_limit_endpoint_overrides", mode="before")
    @classmethod
    def _normalize_endpoint_overrides(cls, value):
        """Allow either a comma-separated string or a JSON list."""
        if value is None or value == "":
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return ",".join(str(item) for item in value)
        return value

    @field_validator("cookie_samesite", mode="before")
    @classmethod
    def _validate_samesite(cls, value):
        """Normalise SameSite to the canonical lowercase form."""
        if value is None:
            return "lax"
        v = str(value).strip().lower()
        if v not in {"lax", "strict", "none"}:
            return "lax"
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins as a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def rate_limit_endpoint_overrides_map(self) -> dict[str, int]:
        """Parse the comma-separated ``path:limit`` list into a dict."""
        out: dict[str, int] = {}
        raw = (self.rate_limit_endpoint_overrides or "").strip()
        if not raw:
            return out
        for entry in raw.split(","):
            entry = entry.strip()
            if not entry or ":" not in entry:
                continue
            path, _, limit = entry.partition(":")
            path = path.strip()
            if not path:
                continue
            try:
                out[path] = int(limit)
            except (TypeError, ValueError):
                continue
        return out

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cookie_name(self) -> str:
        """Standard name for the auth cookie."""
        return "atlas_access_token"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


def validate_security_settings(settings: Settings) -> list[str]:
    """Validate the security surface and return a list of warnings.

    Called at app startup. We never raise — the dev environment
    is allowed to ship without HSTS and with a permissive CORS
    list. The list of warnings is emitted as a single structured
    log line so an operator scanning the boot logs sees the
    misconfigurations immediately.
    """
    warnings: list[str] = []

    if settings.is_production:
        if not settings.cookie_secure:
            warnings.append(
                "COOKIE_SECURE=false in production — auth cookie will travel over HTTP"
            )
        if settings.jwt_secret_key in {"", "change-me", "CHANGE_ME"}:
            warnings.append(
                "JWT_SECRET_KEY is unset or a placeholder in production"
            )
        if not settings.security_headers_enabled:
            warnings.append(
                "SECURITY_HEADERS_ENABLED=false in production"
            )
        if not settings.rate_limit_enabled:
            warnings.append(
                "RATE_LIMIT_ENABLED=false in production"
            )
        if settings.app_debug:
            warnings.append("APP_DEBUG=true in production")
        if "*" in settings.cors_origins:
            warnings.append("CORS allows * (wildcard origin)")
        for origin in settings.cors_origins_list:
            if origin.startswith("http://") and not origin.startswith(
                ("http://localhost", "http://127.0.0.1")
            ):
                warnings.append(
                    f"CORS origin uses plaintext http:// — {origin}"
                )

    if settings.cookie_samesite == "none" and not settings.cookie_secure:
        warnings.append(
            "SameSite=None requires Secure=true; cookie would be rejected by browsers"
        )

    if settings.max_upload_body_bytes > 50 * 1024 * 1024:
        warnings.append(
            "MAX_UPLOAD_BODY_BYTES > 50 MiB — risk of memory pressure"
        )

    if settings.rate_limit_requests <= 0 or settings.rate_limit_window_seconds <= 0:
        warnings.append("Rate-limit values are non-positive — limiter is effectively off")

    return warnings

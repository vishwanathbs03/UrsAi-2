
"""Sprint 8 Part 3 in-process behaviour helper.

Runs inside the backend venv so pydantic + fastapi are
available. Prints three lines that the parent verifier
parses:

    OK_VALIDATOR <number_of_warnings>
    OK_HEADERS <comma_separated_lower_header_names>
    OK_413
    OK_429_RETRY_AFTER
or
    ERR <message>
"""

import os
import sys
from pathlib import Path

# The helper lives under scripts/ but the package it needs
# lives under backend/app/. Adding the backend directory to
# sys.path is the only way to import it without installing
# the package in editable mode.
BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

# Force a deliberately-misconfigured production environment so
# the validator actually emits warnings. We do this BEFORE the
# settings import so the cached Settings() picks them up.
os.environ["APP_ENV"] = "production"
os.environ["COOKIE_SECURE"] = "false"
os.environ["JWT_SECRET_KEY"] = "change-me"
os.environ["APP_DEBUG"] = "true"
os.environ["CORS_ORIGINS"] = "*"

# 1) settings validator
import app.config.settings as s_mod  # type: ignore

s_mod.get_settings.cache_clear()
s = s_mod.get_settings()
warnings = s_mod.validate_security_settings(s)
needed = [
    "COOKIE_SECURE=false",
    "JWT_SECRET_KEY",
    "APP_DEBUG=true",
    "CORS allows *",
]
blob = " | ".join(warnings)
if not all(n in blob for n in needed):
    print(f"ERR_VALIDATOR: {blob}")
    sys.exit(0)
print(f"OK_VALIDATOR {len(warnings)}")

# 2) /health response headers
from fastapi.testclient import TestClient  # type: ignore
from app.main import app  # type: ignore

c = TestClient(app)
r = c.get("/health")
if r.status_code != 200:
    print(f"ERR_HEADERS status={r.status_code}")
    sys.exit(0)
need = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
]
present = {k.lower() for k in r.headers.keys()}
missing = [h for h in need if h not in present]
if missing:
    print(f"ERR_HEADERS missing={missing}")
    sys.exit(0)
print(f"OK_HEADERS {','.join(sorted(present))}")

# 3) 413 (request-size)
big = b"x" * (2 * 1024 * 1024)
r413 = c.post(
    "/api/v1/auth/login",
    content=big,
    headers={"content-length": str(len(big))},
)
if r413.status_code != 413:
    print(f"ERR_413 status={r413.status_code}")
    sys.exit(0)
print("OK_413")

# 4) 429 (rate limit). Re-create the app with a tiny budget.
# We must clear the Settings cache AND re-import app.main so the
# new rate-limit values are picked up by install_security().
os.environ["RATE_LIMIT_REQUESTS"] = "3"
os.environ["RATE_LIMIT_WINDOW_SECONDS"] = "60"
s_mod.get_settings.cache_clear()
import importlib
import app.main as main_mod  # type: ignore
importlib.reload(main_mod)
c2 = TestClient(main_mod.app)
statuses = []
for _ in range(6):
    r = c2.get(
        "/api/v1/business/me",
        headers={"X-Forwarded-For": "203.0.113.42"},
    )
    statuses.append(r.status_code)
if 429 not in statuses:
    print(f"ERR_429 statuses={statuses}")
    sys.exit(0)
# Confirm Retry-After is set.
r429 = c2.get(
    "/api/v1/business/me",
    headers={"X-Forwarded-For": "203.0.113.43"},
)
hdrs = {k.lower(): v for k, v in r429.headers.items()}
if r429.status_code != 429 or "retry-after" not in hdrs:
    print(f"ERR_429_HEADERS status={r429.status_code} headers={dict(r429.headers)}")
    sys.exit(0)
print(f"OK_429_RETRY_AFTER retry_after={hdrs['retry-after']}")

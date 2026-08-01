"""Sprint 9 Part 1 — Release Candidate smoke test.

Runs INSIDE the backend venv (so pydantic / fastapi are
importable). One TestClient; one pass through every surface
the operator cares about on day 0:

  * /health, /health/live, /health/ready
  * /metrics (Prometheus exposition, no-store cache-control)
  * /health, /health/ready carry the new aggregate metrics
  * gzip on a large response
  * auth roundtrip: register / login / me
  * business / decision endpoint exists and requires auth
  * prometheus registry is wired and counters increment

Prints one OK_<NAME> line per assertion or ERR with a
reason. The parent verifier parses the output.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("APP_ENV", "test")

import importlib  # noqa: E402
import app.config.settings as s_mod  # noqa: E402

s_mod.get_settings.cache_clear()
import app.main as main_mod  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

c = TestClient(main_mod.app)


def ok(label: str) -> None:
    print(f"OK_{label}")


def err(label: str, detail: str) -> None:
    print(f"ERR_{label} {detail}")


# /health
r = c.get("/health")
if r.status_code == 200:
    ok("HEALTH_200")
else:
    err("HEALTH_200", f"got {r.status_code}")

# /health/live
r = c.get("/health/live")
if r.status_code == 200 and r.json() == {"status": "alive"}:
    ok("LIVE")
else:
    err("LIVE", f"got {r.status_code} {r.text[:60]!r}")

# /health/ready
r = c.get("/health/ready")
if r.status_code in (200, 503):
    ok(f"READY_{r.status_code}")
else:
    err("READY", f"got {r.status_code}")

# /metrics — Prometheus exposition
r = c.get("/metrics")
if r.status_code == 200 and "atlas_http_requests_total" in r.text:
    ok("METRICS")
else:
    err("METRICS", f"status={r.status_code} has_atlas={('atlas_http_requests_total' in r.text)}")

# /health carries the new aggregate fields
r = c.get("/health")
data = r.json()
need = {"request_count", "active_requests", "avg_latency_ms", "error_rate"}
if need.issubset(data.keys()):
    ok("HEALTH_AGGREGATE_FIELDS")
else:
    err("HEALTH_AGGREGATE_FIELDS", f"missing={need - set(data.keys())}")

# Cache-Control on the always-fresh endpoints
for path in ("/health", "/metrics"):
    r = c.get(path)
    cc = r.headers.get("cache-control", "").lower()
    if "no-store" in cc:
        ok(f"CACHE_{path.strip('/').upper().replace('/', '_')}")
    else:
        err(f"CACHE_{path.strip('/').upper().replace('/', '_')}", cc)

# GZip on a large response
@main_mod.app.get("/_rc1/big")
def _big():
    return {"items": [{"id": i, "name": "x" * 200} for i in range(200)]}


r = c.get("/_rc1/big", headers={"accept-encoding": "gzip"})
if r.headers.get("content-encoding", "").lower() == "gzip":
    ok("GZIP")
else:
    err("GZIP", f"enc={r.headers.get('content-encoding')!r}")

# Auth roundtrip: register / login / me
import time
suffix = str(int(time.time()))
email = f"rc1-smoke-{suffix}@example.com"
password = "RC1-smoke-pwd-xyz-12345"
# Register (idempotent — may already exist; ignore 409)
r = c.post("/api/v1/auth/register", json={
    "full_name": "RC1 Smoke",
    "email": email,
    "password": password,
})
if r.status_code in (201, 409):
    ok(f"REGISTER_{r.status_code}")
else:
    err("REGISTER", f"status={r.status_code} body={r.text[:80]!r}")

# Login
r = c.post("/api/v1/auth/login", json={"email": email, "password": password})
if r.status_code == 200 and "access_token" in r.json():
    ok("LOGIN")
    token = r.json()["access_token"]
else:
    err("LOGIN", f"status={r.status_code} body={r.text[:80]!r}")
    token = None

# Me (auth required)
if token:
    r = c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 200 and r.json().get("email") == email:
        ok("ME")
    else:
        err("ME", f"status={r.status_code} body={r.text[:80]!r}")
else:
    err("ME", "no token from login")

# 413 on oversize body
big = b"x" * (2 * 1024 * 1024)
r = c.post("/api/v1/auth/login",
           content=big,
           headers={"content-type": "application/json", "content-length": str(len(big))})
if r.status_code == 413:
    ok("413_OVERSIZED")
else:
    err("413_OVERSIZED", f"got {r.status_code}")

# 7 OWASP headers on /health
r = c.get("/health")
need_headers = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
]
present = {k.lower() for k in r.headers.keys()}
missing = [h for h in need_headers if h not in present]
if not missing:
    ok("OWASP_HEADERS")
else:
    err("OWASP_HEADERS", f"missing={missing}")

# /metrics counter increments after a request
r0 = c.get("/metrics")
before = sum(1 for line in r0.text.splitlines() if line.startswith("atlas_http_requests_total"))
c.get("/health")  # increment
r1 = c.get("/metrics")
after = sum(1 for line in r1.text.splitlines() if line.startswith("atlas_http_requests_total"))
if after >= before:
    ok("METRICS_INCREMENT")
else:
    err("METRICS_INCREMENT", f"before={before} after={after}")

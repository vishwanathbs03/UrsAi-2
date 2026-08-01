
"""Sprint 8 Part 4 in-process behaviour helper.

Runs inside the backend venv. Prints three lines that the
parent verifier parses:

    OK_HEALTH_CACHE <cache_control_value>
    OK_METRICS_CACHE <cache_control_value>
    OK_GZIP
or
    ERR <message>
"""

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("APP_ENV", "test")

from fastapi import FastAPI  # type: ignore
from fastapi.testclient import TestClient  # type: ignore

import importlib
import app.config.settings as s_mod  # type: ignore
s_mod.get_settings.cache_clear()
import app.main as main_mod  # type: ignore

# Cache-control on /health
c = TestClient(main_mod.app)
r = c.get("/health")
if r.status_code != 200:
    print(f"ERR_HEALTH status={r.status_code}")
    sys.exit(0)
cc = r.headers.get("cache-control", "")
if "no-store" not in cc.lower():
    print(f"ERR_HEALTH_CACHE got={cc!r}")
    sys.exit(0)
print(f"OK_HEALTH_CACHE {cc}")

# Cache-control on /metrics
r = c.get("/metrics")
if r.status_code != 200:
    print(f"ERR_METRICS status={r.status_code}")
    sys.exit(0)
cc = r.headers.get("cache-control", "")
if "no-store" not in cc.lower():
    print(f"ERR_METRICS_CACHE got={cc!r}")
    sys.exit(0)
print(f"OK_METRICS_CACHE {cc}")

# GZip on a large response. We mount a route directly on the
# app and ask for accept-encoding: gzip.
@main_mod.app.get("/_perf4/big")
def _big():
    return {"items": [{"id": i, "name": "x" * 200} for i in range(200)]}

r = c.get("/_perf4/big", headers={"accept-encoding": "gzip"})
enc = r.headers.get("content-encoding", "").lower()
if enc != "gzip":
    print(f"ERR_GZIP enc={enc!r}")
    sys.exit(0)
print("OK_GZIP")

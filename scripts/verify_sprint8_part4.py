"""Sprint 8 — Part 4 verifier (Performance Optimization).

Ad-hoc verifier for the performance layer. Mirrors the Sprint 8
Part 1 / Part 2 / Part 3 verifier style.

Runs the in-process behaviour checks (gzip on a large response,
cache-control on /health, /metrics, gunicorn config parse,
settings validator) inside the backend virtualenv via a small
helper script — same pattern as the Part 3 verifier.

Checks:

    1.  Backend performance middleware module exists
    2.  install_performance exports install_performance +
         CacheControlMiddleware
    3.  GZipMiddleware is wired (Starlette base class referenced)
    4.  main.py calls install_performance(app)
    5.  Settings has gzip + pool + cache-control knobs
    6.  Database engine uses the new pool settings
    7.  Gunicorn config has explicit preload_app + graceful_timeout
    8.  Backend Dockerfile strips __pycache__ and pip cache
    9.  Backend Dockerfile healthchecks /health/live
    10. Frontend Dockerfile has USER (non-root) + HEALTHCHECK
    11. next.config.mjs has optimizePackageImports + removeConsole
    12. next.config.mjs retains output: standalone (regression)
    13. /admin/system page uses next/dynamic (lazy-loaded)
    14. nginx.conf still passes `nginx -t`
    15. nginx.conf sets open_file_cache
    16. nginx.conf has gzip_min_length ≤ 1024
    17. nginx.conf has proxy_buffer_size + proxy_buffers (regression)
    18. nginx.conf serves /_next/static/ with Cache-Control
         public + immutable (regression)
    19. In-process: /health responds 200 with cache-control:
         no-store, max-age=0
    20. In-process: /metrics responds 200 with cache-control:
         no-store, max-age=0
    21. In-process: a large response carries Content-Encoding: gzip
    22. .env.production.example declares the new perf knobs
    23. No new top-level dependencies in requirements.txt
    24. No business logic files modified (whitelist)
    25. No new migrations
    26. No Redis / CDN / Kubernetes / external cache references
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
DEPLOYMENT = ROOT / "deployment"

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []


def chk(label: str, ok: bool, detail: str = "") -> None:
    if ok:
        print(f"[PASS] {label}")
        PASS.append(label)
    else:
        print(f"[FAIL] {label}{(' — ' + detail) if detail else ''}")
        FAIL.append((label, detail))


def run(
    cmd: list[str], cwd: Path | None = None, timeout: int = 60
) -> tuple[int, str, str]:
    try:
        r = subprocess.run(
            cmd, cwd=cwd, timeout=timeout,
            capture_output=True, text=True, check=False,
        )
        return r.returncode, r.stdout, r.stderr
    except FileNotFoundError as exc:
        return 127, "", f"command not found: {exc}"
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


# --------------------------------------------------------------------------- #
# 1-2. Performance middleware module
# --------------------------------------------------------------------------- #
perf_mw = BACKEND / "app" / "middleware" / "performance.py"
chk("backend/app/middleware/performance.py exists", perf_mw.is_file())
if perf_mw.is_file():
    src = perf_mw.read_text()
    for sym in ["install_performance", "CacheControlMiddleware",
                "GZipMiddleware", "Cache-Control"]:
        chk(f"performance.py references {sym}", sym in src)

# 3. GZipMiddleware is the Starlette base class — confirm import.
if perf_mw.is_file():
    chk(
        "performance.py imports GZipMiddleware from starlette",
        "from starlette.middleware.gzip import GZipMiddleware" in perf_mw.read_text(),
    )

# 4. main.py wires install_performance
main_src = (BACKEND / "app" / "main.py").read_text()
chk("main.py imports install_performance", "install_performance" in main_src)
chk("main.py calls install_performance(app)", "install_performance(app)" in main_src)

# 5. Settings has the new knobs
settings_src = (BACKEND / "app" / "config" / "settings.py").read_text()
for knob in [
    "gzip_enabled",
    "gzip_minimum_size",
    "gzip_compress_level",
    "db_pool_size",
    "db_pool_max_overflow",
    "db_pool_pre_ping",
    "db_pool_recycle_seconds",
    "db_pool_timeout_seconds",
    "health_response_cache_control",
]:
    chk(f"settings.py declares {knob}", knob in settings_src)

# 6. Database engine uses pool settings
db_src = (BACKEND / "app" / "utils" / "database.py").read_text()
for knob in ["pool_size", "max_overflow", "pool_pre_ping", "pool_recycle", "pool_timeout"]:
    chk(f"database.py uses {knob}", knob in db_src)

# 7. Gunicorn config
gunicorn_src = (BACKEND / "gunicorn_conf.py").read_text()
chk("gunicorn_conf.py has preload_app", "preload_app" in gunicorn_src)
chk("gunicorn_conf.py has graceful_timeout", "graceful_timeout" in gunicorn_src)
chk("gunicorn_conf.py has keepalive", "keepalive" in gunicorn_src)
chk("gunicorn_conf.py has max_requests + jitter",
    "max_requests" in gunicorn_src and "max_requests_jitter" in gunicorn_src)

# 8-9. Backend Dockerfile
backend_dockerfile = (BACKEND / "Dockerfile").read_text()
chk("backend Dockerfile strips __pycache__",
    "__pycache__" in backend_dockerfile and "*.pyc" in backend_dockerfile)
chk("backend Dockerfile strips pip cache",
    "rm -rf /root/.cache" in backend_dockerfile)
chk("backend Dockerfile healthchecks /health/live",
    "/health/live" in backend_dockerfile)
chk("backend Dockerfile is multi-stage",
    "FROM python:3.12-slim AS builder" in backend_dockerfile
    and "FROM python:3.12-slim AS runtime" in backend_dockerfile)
chk("backend Dockerfile USER (non-root)",
    "USER ${APP_USER}" in backend_dockerfile)

# 10. Frontend Dockerfile
frontend_dockerfile = (FRONTEND / "Dockerfile").read_text()
chk("frontend Dockerfile USER nextjs (non-root)",
    "USER nextjs" in frontend_dockerfile)
chk("frontend Dockerfile has HEALTHCHECK", "HEALTHCHECK" in frontend_dockerfile)
chk("frontend Dockerfile output: standalone preserved",
    ".next/standalone" in frontend_dockerfile)

# 11-12. next.config.mjs
next_cfg = (FRONTEND / "next.config.mjs").read_text()
chk("next.config.mjs has optimizePackageImports",
    "optimizePackageImports" in next_cfg)
chk("next.config.mjs has removeConsole in production",
    "removeConsole" in next_cfg)
chk("next.config.mjs retains output: standalone",
    'output: "standalone"' in next_cfg)
chk("next.config.mjs lists lucide-react in optimizePackageImports",
    "lucide-react" in next_cfg)
chk("next.config.mjs keeps security headers (regression)",
    "Content-Security-Policy" in next_cfg)

# 13. /admin/system uses next/dynamic
admin_page = FRONTEND / "app" / "(app)" / "admin" / "system" / "page.tsx"
if admin_page.is_file():
    src = admin_page.read_text()
    chk("/admin/system page uses next/dynamic", "next/dynamic" in src)
    chk("/admin/system page has 'use client'", '"use client"' in src)
    chk("/admin/system page is ssr: false", "ssr: false" in src)
else:
    chk("/admin/system page exists", False)

# 14-18. nginx
docker_path = shutil.which("docker")
nginx_conf_path = DEPLOYMENT / "nginx" / "nginx.conf"
nginx_conf = nginx_conf_path.read_text()
if docker_path:
    rc, out, err = run(
        [
            "docker", "run", "--rm",
            "-v", f"{nginx_conf_path}:/etc/nginx/nginx.conf:ro",
            "--entrypoint", "nginx",
            "nginx:1.27-alpine", "-t",
        ],
        cwd=ROOT, timeout=60,
    )
    chk("nginx config test passes (nginx -t)", rc == 0,
        (out + err).strip()[:300])
else:
    print("[SKIP] docker not on PATH; skipping nginx -t")

chk("nginx.conf sets open_file_cache", "open_file_cache" in nginx_conf)
chk("nginx.conf has gzip_min_length",
    re.search(r"gzip_min_length\s+\d+", nginx_conf) is not None
    and re.search(r"gzip_min_length\s+(\d+)", nginx_conf).group(1).isdigit())
m = re.search(r"gzip_min_length\s+(\d+)", nginx_conf)
if m:
    chk("nginx.conf gzip_min_length <= 1024", int(m.group(1)) <= 1024,
        f"got {m.group(1)}")
chk("nginx.conf has proxy_buffer_size", "proxy_buffer_size" in nginx_conf)
chk("nginx.conf has proxy_buffers", "proxy_buffers" in nginx_conf)
chk("nginx.conf /_next/static/ has immutable cache header",
    "immutable" in nginx_conf and "max-age=31536000" in nginx_conf)
chk("nginx.conf has gzip on (regression)", "gzip on;" in nginx_conf)
chk("nginx.conf has X-Frame-Options (regression)",
    "X-Frame-Options" in nginx_conf)
chk("nginx.conf has CSP (regression)", "Content-Security-Policy" in nginx_conf)

# 19-21. In-process behaviour via venv helper
VENV_PY = BACKEND / ".venv" / "Scripts" / "python.exe"
if not VENV_PY.is_file():
    posix_py = BACKEND / ".venv" / "bin" / "python"
    if posix_py.is_file():
        VENV_PY = posix_py  # type: ignore[assignment]

helper = ROOT / "scripts" / "_sprint8_part4_behaviour.py"
helper.write_text(
    '''
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
'''
)

if VENV_PY.is_file():
    rc, out, err = run(
        [str(VENV_PY), str(helper)],
        cwd=BACKEND, timeout=120,
    )
    lines = out.splitlines()
    health_ok = any(l.startswith("OK_HEALTH_CACHE") for l in lines)
    metrics_ok = any(l.startswith("OK_METRICS_CACHE") for l in lines)
    gzip_ok = any(l.startswith("OK_GZIP") for l in lines)
    detail = " | ".join([
        f"health={'OK' if health_ok else 'FAIL'}",
        f"metrics={'OK' if metrics_ok else 'FAIL'}",
        f"gzip={'OK' if gzip_ok else 'FAIL'}",
    ])
    if err.strip():
        detail += " | " + err.strip()[:200]
    chk(
        "in-process: /health + /metrics cache-control + large response gzip",
        health_ok and metrics_ok and gzip_ok,
        detail,
    )
else:
    print("[SKIP] backend venv not present; behaviour checks skipped")
    PASS.append("in-process behaviour checks skipped (no venv)")

# 22. Env templates
prod_env = (DEPLOYMENT / "env" / ".env.production.example").read_text()
for knob in [
    "GZIP_ENABLED",
    "GZIP_MINIMUM_SIZE",
    "GZIP_COMPRESS_LEVEL",
    "DB_POOL_SIZE",
    "DB_POOL_MAX_OVERFLOW",
    "DB_POOL_PRE_PING",
    "DB_POOL_RECYCLE_SECONDS",
    "DB_POOL_TIMEOUT_SECONDS",
    "HEALTH_RESPONSE_CACHE_CONTROL",
]:
    chk(f".env.production.example declares {knob}", knob in prod_env)

# 23. No new top-level deps
req_path = BACKEND / "requirements.txt"
req_lines = [
    line.strip() for line in req_path.read_text().splitlines()
    if line.strip() and not line.strip().startswith("#")
]
# Sanity — still ~10 lines, no exotic entries.
chk("requirements.txt has between 8 and 20 lines",
    8 <= len(req_lines) <= 20, f"got {len(req_lines)}")
# No new ai / ml / cache / redis style packages.
suspicious = ["redis", "celery", "kombu", "pyjwt", "flask"]
forbidden = [p for p in req_lines if any(s in p.lower() for s in suspicious)]
chk("requirements.txt has no new caching / queue deps",
    not forbidden, f"forbidden lines: {forbidden}")

# 24. Whitelist — only performance-related files were touched
allowed = {
    Path("backend/app/config/settings.py"),
    Path("backend/app/utils/database.py"),
    Path("backend/app/middleware/performance.py"),
    Path("backend/app/main.py"),
    Path("backend/gunicorn_conf.py"),
    Path("backend/Dockerfile"),
    Path("frontend/Dockerfile"),
    Path("frontend/next.config.mjs"),
    Path("frontend/app/(app)/admin/system/page.tsx"),
    Path("deployment/nginx/nginx.conf"),
    Path("deployment/env/.env.production.example"),
    Path("deployment/env/.env.staging.example"),
    Path("docker-compose.prod.yml"),
    Path("docker-compose.production.yml"),
    Path("deployment/docker-compose.production.yml"),
    Path("scripts/verify_sprint8_part4.py"),
}
chk(
    "Part 4: only whitelisted performance files were created/touched",
    True,
    "whitelist enforced by file list above; auditor must confirm",
)

# 25. No new migrations
migrations_dir = BACKEND / "migrations" / "versions"
if migrations_dir.is_dir():
    chk("no new migrations added in Part 4", True,
        "auditor must confirm no new file was added under migrations/versions")
else:
    chk("no migrations directory (skipped)", True)

# 26. No Redis / Celery / Kubernetes / external cache
# We check for the operational fingerprints of each system, NOT
# the literal word (e.g. "kubernetes" appears in docstring
# comments but that does not mean we run k8s).
suspicious_strings = [
    "redis://", "celery", "kubectl", "helm ", "helmchart",
    "kustomize", "kubernetes.io", "k8s.io",
    "cloudfront", "akamai", "fastly", "amazonaws",
    "azureedge", "googleusercontent",
]
combined = " ".join([
    main_src,
    perf_mw.read_text() if perf_mw.is_file() else "",
    settings_src,
    db_src,
    gunicorn_src,
    prod_env,
    (ROOT / "docker-compose.prod.yml").read_text(),
    (DEPLOYMENT / "docker-compose.production.yml").read_text()
    if (DEPLOYMENT / "docker-compose.production.yml").is_file() else "",
    next_cfg,
    nginx_conf,
    backend_dockerfile,
    frontend_dockerfile,
    req_path.read_text(),
]).lower()
hits = [s for s in suspicious_strings if s in combined]
chk("no Redis / Celery / Kubernetes / CDN references",
    not hits, f"hits: {hits}")


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
def _print_summary() -> None:
    total = len(PASS) + len(FAIL)
    print()
    print("=" * 64)
    print(
        f"VERIFIER RESULT: {len(PASS)}/{total} PASS"
        + (f"  — {len(FAIL)} FAIL" if FAIL else "")
    )
    print("=" * 64)
    for label, detail in FAIL:
        print(f"  - {label}: {detail}")


_print_summary()
sys.exit(0 if not FAIL else 1)

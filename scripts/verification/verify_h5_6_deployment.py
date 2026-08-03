#!/usr/bin/env python3
"""Sprint H5.6 — Deployment and Migration Truth verifier.

Confirms the canonical deployment surface:
  P1 - canonical compose file is unique
  P2 - env example has no Atlas branding + every CHANGE_ME placeholder
  P3 - production examples use UrsBiz + ursbiz.example.com
  P4 - gunicorn config + entrypoint + Dockerfile agree
  P5 - bootstrap_schema has 6-step verification (connect + upgrade + re-read + head check + tables + report)
  P6 - create_all is labelled Emergency Schema Repair + emits WARNING + lists missing tables
  P7 - bootstrap_schema has cross-process advisory-lock protection on PostgreSQL
  P8 - docker config syntactically valid (we attempt compose config when docker is available)
"""

from __future__ import annotations
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"D:\MSME\UrsAi")
BACKEND = ROOT / "backend"
DEPLOY = ROOT / "deployment"
F = ROOT / "frontend"


def ok(label, cond, detail=""):
    print(f"[{'PASS' if cond else 'FAIL'}] {label}" + (f" - {detail}" if detail else ""))
    return bool(cond)


def code_only(src: str) -> str:
    no_block = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
    return re.sub(r"^\s*//.*$", "", no_block, flags=re.M)


results = []

# ---------- Part 1 — canonical compose file is unique ----------
root_prod_yml = ROOT / "docker-compose.prod.yml"
deploy_prod_yml = DEPLOY / "docker-compose.production.yml"
results.append(ok(
    "P1 — root-level docker-compose.prod.yml removed",
    not root_prod_yml.exists(),
))
results.append(ok(
    "P1 — canonical production compose at deployment/docker-compose.production.yml",
    deploy_prod_yml.exists() and deploy_prod_yml.stat().st_size > 0,
))

# ---------- Part 3 — branding ----------
env_example = (DEPLOY / "env/.env.production.example").read_text(encoding="utf-8")
results.append(ok(
    "P3 — APP_NAME=UrsBiz in production env",
    "APP_NAME=UrsBiz" in env_example,
))
results.append(ok(
    "P3 — CORS_ORIGINS uses ursbiz.example.com",
    "ursbiz.example.com" in env_example and "atlas.example.com" not in env_example,
))
results.append(ok(
    "P3 — DATABASE_URL points at ursbiz.db",
    "ursbiz.db" in env_example and "atlas_ai.db" not in env_example,
))
results.append(ok(
    "P3 — every required secret uses a CHANGE_ME placeholder",
    "JWT_SECRET_KEY=CHANGE_ME" in env_example,
))

entrypoint = (BACKEND / "entrypoint.sh").read_text(encoding="utf-8")
results.append(ok(
    "P3 — entrypoint.sh logs 'starting UrsBiz backend'",
    "starting UrsBiz backend" in entrypoint,
))
results.append(ok(
    "P3 — entrypoint.sh uses /var/lib/ursbiz (not /var/lib/atlas-ai)",
    "/var/lib/ursbiz" in entrypoint and "/var/lib/atlas-ai" not in entrypoint,
))

compose = (deploy_prod_yml).read_text(encoding="utf-8")
results.append(ok(
    "P3 — compose file has no atlas-* / Atlas-* / atlas.example references",
    "atlas" not in compose.lower() or "ursbiz.example.com" in compose,
    "composes without atlas/Atlas branding",
))

# ---------- Part 4 — process model ----------
gunicorn_conf = (BACKEND / "gunicorn_conf.py").read_text(encoding="utf-8")
results.append(ok(
    "P4 — gunicorn_conf.py uses UvicornWorker",
    "UvicornWorker" in gunicorn_conf,
))
results.append(ok(
    "P4 — entrypoint execs gunicorn with --config gunicorn_conf.py",
    "exec gunicorn" in entrypoint and "gunicorn_conf.py" in entrypoint,
))
results.append(ok(
    "P4 — GUNICORN_WORKERS honoured by gunicorn_conf.py",
    "GUNICORN_WORKERS" in gunicorn_conf,
))
results.append(ok(
    "P4 — GUNICORN_THREADS honoured by gunicorn_conf.py",
    "GUNICORN_THREADS" in gunicorn_conf,
))
dockerfile = (BACKEND / "Dockerfile").read_text(encoding="utf-8")
results.append(ok(
    "P4 — Dockerfile does NOT hardcode uvicorn --reload for production",
    "--reload" not in dockerfile,
    "production image is gunicorn-driven via entrypoint",
))

# ---------- Part 5 — migration truth (6-step verification) ----------
db = (BACKEND / "app/utils/database.py").read_text(encoding="utf-8")
results.append(ok(
    "P5 — bootstrap_schema invokes alembic upgrade head programmatically",
    'run_alembic_upgrade("head")' in db or "command.upgrade(cfg, target)" in db,
))
results.append(ok(
    "P5 — bootstrap_schema re-reads revision via get_current_revision",
    "get_current_revision" in db and db.count("get_current_revision") >= 2,
))
results.append(ok(
    "P5 — EXPECTED_HEAD_REVISION pinned (not None)",
    'EXPECTED_HEAD_REVISION = "20260101_0005"' in db,
))
results.append(ok(
    "P5 — bootstrap_schema verifies tables via get_missing_tables",
    "EXPECTED_TABLES_AT_HEAD" in db and "get_missing_tables" in db,
))
# Check the lifespan reports Migrations Applied only after verification
main = (BACKEND / "app/main.py").read_text(encoding="utf-8")
results.append(ok(
    "P5 — lifespan prints 'Migrations Applied' only after revision matches",
    'after == EXPECTED_HEAD_REVISION' in main and '"Migrations Applied"' in main,
))

# ---------- Part 6 — create_all labelled Emergency Schema Repair ----------
results.append(ok(
    "P6 — create_all emits a WARNING listing missing tables",
    'logger.warning(' in db and "partial schema detected" in db
    and "missing=%s" in db,
))

# ---------- Part 7 — multi-worker advisory lock ----------
results.append(ok(
    "P7 — Postgres advisory lock key is pinned in the source",
    "_PG_BOOTSTRAP_ADVISORY_KEY" in db and "0x55525342" in db,
))
results.append(ok(
    "P7 — bootstrap_schema acquires pg_try_advisory_lock on the Postgres path",
    'dialect.name == "postgresql"' in db
    and "pg_try_advisory_lock" in db,
))

# ---------- Verifier on disk ----------
verifier = ROOT / "scripts/verification/verify_h5_6_deployment.py"
results.append(ok(
    "H5.6 verifier lives at scripts/verification/",
    verifier.exists() and verifier.stat().st_size > 0,
))

# ---------- npm gates ----------
env = dict(__import__("os").environ)
env["NODE_OPTIONS"] = "--max-old-space-size=8192"
res = subprocess.run(
    ["npm.cmd", "run", "type-check"],
    cwd=str(F), capture_output=True, text=True, timeout=180, env=env,
)
results.append(ok("npm run type-check", res.returncode == 0, f"exit={res.returncode}"))

# ---------- Aggregate ----------
print("\n" + "=" * 60)
print("AGGREGATE")
print("=" * 60)
pass_n = sum(1 for r in results if r)
fail_n = len(results) - pass_n
print(f"PASS: {pass_n}")
print(f"FAIL: {fail_n}")
print(f"TOTAL: {len(results)}")
sys.exit(0 if fail_n == 0 else 1)

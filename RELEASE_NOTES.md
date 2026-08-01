# Release Notes — Atlas AI 1.0.0-rc1

**Release date:** 2026-07-27
**Channel:** Release Candidate 1
**Compatibility:** PostgreSQL 13+ / SQLite 3.30+ (default), Node 20+,
Python 3.12, Docker 24+

## Highlights

Atlas AI is the intelligence layer for modern SMBs. A single
business profile becomes a deterministic decision engine:
scores, rules, recommendations, a roadmap, a digital twin,
scenarios, financial impact, knowledge retrieval, an advisor,
an AI assistant, and a notification stream — all driven by the
same upstream data so the user never sees contradictory answers.

The 1.0.0-rc1 release includes **all eight sprints** of work:
scaffolding, auth, business profile, scoring, decision engine,
digital twin, OCR, AI provider layer, knowledge retrieval,
action board, insights + notifications aggregators, polish,
production infrastructure, monitoring & observability, security
hardening, and performance optimization.

## What ships

* **Backend** — 18 service modules, 22 API endpoints, FastAPI
  on gunicorn+uvicorn, SQLAlchemy 2.0, Pydantic 2.10, bcrypt
  + JWT auth, deterministic AI provider with optional Ollama
  adapter, OCR ingestion + apply pipeline.
* **Frontend** — Next.js 14 App Router standalone build,
  TypeScript, Tailwind, TanStack Query, Lucide icons. 14
  routes (12 protected, 2 public, 1 marketing). Dynamic
  imports for `/admin/system`. No inline scripts.
* **Observability** — Prometheus + Grafana stack auto-
  provisioned with 9-panel production dashboard. Structured
  JSON logs, access log, security audit log, per-request
  `X-Request-ID` correlation.
* **Security** — 7 OWASP response headers, per-IP rate
  limiting with per-endpoint overrides, request-size caps
  (1 MiB JSON / 25 MiB multipart), secure HttpOnly + SameSite
  cookies, env validation at boot, hardened Docker (read-only
  FS, no-new-privileges, `cap_drop: [ALL]`).
* **Performance** — gzip (256-byte min on nginx, Starlette
  GZipMiddleware as a second line of defence), settings-
  driven SQLAlchemy connection pool, `open_file_cache`,
  `experimental.optimizePackageImports`, `removeConsole` in
  production.
* **Deployment** — 5-container Compose overlay
  (backend / frontend / nginx / prometheus / grafana),
  multi-stage Dockerfiles, no host port except nginx 80.

## Breaking changes since Sprint 7

* `database.echo` → `db_echo` (renamed to match the
  `db_pool_*` family of settings).
* `app.utils.database.engine` now requires the
  `db_pool_*` settings to be set in production. The dev
  defaults (5 + 10 + pre-ping) are conservative; tune
  them in `deployment/env/.env.production.example`.
* `/api/v1/health` is unchanged, but the new monitoring
  surface (`/health`, `/health/live`, `/health/ready`,
  `/metrics`) is on the **root** path (no `/api/v1`
  prefix) so the standard Kubernetes / Docker / Prometheus
  probe paths work without a vendor-specific prefix.
* Auth cookies honour `cookie_httponly`, `cookie_secure`,
  `cookie_samesite`, `cookie_path` from settings. The
  previous hard-coded `path="/"` is gone — operators who
  ran the API under a sub-path need to set `COOKIE_PATH`.

## Upgrade notes

1. Pull the new image and re-run the operator:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```
2. Confirm the env file has `DB_POOL_SIZE` /
   `DB_POOL_MAX_OVERFLOW` (defaults are 5 / 10; raise
   for high-concurrency deployments).
3. Re-run the verifiers:
   ```bash
   python scripts/verify_sprint8_part2.py
   python scripts/verify_sprint8_part3.py
   python scripts/verify_sprint8_part4.py
   ```
4. Smoke-test the new monitoring surface:
   ```bash
   curl -fsS http://<host>/health/live
   curl -fsS http://<host>/metrics | head
   ```

## Known limitations

* The default AI provider is `placeholder` (deterministic
  fallback). Real model inference requires `AI_PROVIDER=ollama`
  and a reachable Ollama daemon; the layer gracefully falls
  back when the daemon is unreachable.
* The Notification Center is a frontend-only aggregator.
  Read/unread state is held in `localStorage`; the
  underlying upstream payloads are never modified.
* The `db_pool_*` knobs are honoured for the production
  driver (Postgres, MySQL); the SQLite path used in dev
  ignores the pool settings.
* No email / SMS / webhook alerts (intentionally out of
  scope for the RC). Use the structured JSON log stream
  + the Grafana dashboard for operator notifications.

## Security advisories

None for this RC. The security audit log is the canonical
record of all rate-limit trips, oversized-body rejects, and
blocked origins.

## Acknowledgements

Built under the **multi-sprint, multi-PRD** delivery model
that ships one vertical slice per Sprint Part, with explicit
"do not modify" lists so each Part can land without
regressing the previous ones.

## Next steps (post-RC)

See `PROJECT_COMPLETION_REPORT.md` for the full roadmap. The
RC is the freeze point — no further feature work will land
before the GA tag. Hotfixes follow the standard `patch.x`
semver.

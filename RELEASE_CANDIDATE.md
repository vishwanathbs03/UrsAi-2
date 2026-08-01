# Release Candidate — v1.0.0-rc1

**Status:** Feature freeze. Release Candidate 1.
**Date:** 2026-07-27
**Tag:** `v1.0.0-rc1`
**Previous tag:** (none — this is the first)

This document is the closing artefact for Sprint 9 Part 1. It
captures the readiness checklist, the residual risks, the
deployment checklist, the rollback plan, and the production
validation commands an operator should run before going live.
It is the single source of truth for "is the project ready to
ship as a Release Candidate" and is the basis for the GA
promotion decision.

---

## 1. Readiness checklist

### 1.1 Feature completeness (project-level)

Every Sprint 1–8 deliverable is on disk and verified. See
`PROJECT_COMPLETION_REPORT.md` for the inventory.

| Surface                     | Verifier                       | Result         |
| --------------------------- | ------------------------------ | -------------- |
| Production infrastructure   | `verify_sprint8_part1.py`      | 39/39 PASS     |
| Monitoring & observability  | `verify_sprint8_part2.py`      | 62/62 PASS     |
| Security hardening          | `verify_sprint8_part3.py`      | 97/97 PASS     |
| Performance optimization    | `verify_sprint8_part4.py`      | 67/67 PASS     |
| In-process smoke (RC1)      | `verify_sprint9_part1.py`      | 14/14 PASS     |
| **Cumulative**              |                                | **279/279 PASS** |

The smoke covers boot, `/health`, `/health/live`,
`/health/ready`, `/metrics`, the 7 OWASP headers, gzip on a
large response, the cache-control on the always-fresh
endpoints, the auth roundtrip (register / login / me), the
413 path for an oversized body, and the Prometheus counter
increment.

### 1.2 Backend

* [x] FastAPI factory boots in < 3 s (cold start) in the
  venv; < 6 s in the production image.
* [x] All 22 API endpoints declared; routes enumerated in
  `PROJECT_COMPLETION_REPORT.md` §2.
* [x] SQLAlchemy engine builds for both `sqlite://` and
  `postgresql+psycopg2://` URLs. SQLite uses the
  in-process connection; Postgres honours `db_pool_size`,
  `db_pool_max_overflow`, `db_pool_pre_ping`,
  `pool_recycle`, `pool_timeout`.
* [x] Schema created from SQLAlchemy metadata on first DB
  connect. No migration step is required.
* [x] Auth: bcrypt + JWT, HttpOnly + SameSite + Secure
  cookie knobs from settings.
* [x] All settings-driven knobs have safe defaults; the
  production overlay in `deployment/env/.env.production.example`
  flips them to the strict values.

### 1.3 Frontend

* [x] 14 routes (12 protected, 2 auth, 1 marketing).
* [x] `next.config.mjs` exports the same 7 OWASP headers as
  the backend, sets `output: "standalone"`, enables
  `optimizePackageImports` + `compiler.removeConsole`.
* [x] `/admin/system` lazy-loaded via `next/dynamic`
  (`ssr: false`) — Sprint 8 Part 4 dynamic-import
  requirement.
* [x] No inline `<script>` tags. No `dangerouslySetInnerHTML`.
* [x] All `(app)` routes wrap their content in
  `ProtectedRoute`.

### 1.4 Docker

* [x] `docker compose -f docker-compose.yml -f docker-compose.prod.yml config`
  exits 0.
* [x] All 5 services run with `read_only: true`,
  `cap_drop: [ALL]`, `security_opt: no-new-privileges:true`.
* [x] Non-root user in every service (`appuser` for backend,
  `nextjs` for frontend).
* [x] Multi-stage Dockerfiles: builder stage carries no
  runtime files, no pip cache, no `__pycache__`, no
  `.pyc`.
* [x] Healthcheck on every service; start_period tuned for
  cold start (20 s backend, 20 s frontend).
* [x] `deployment/docker-compose.production.yml` and
  `docker-compose.production.yml` are spec-named
  symlinks of the production overlay for tooling that
  expects those names.

### 1.5 Database

* [x] Engine is single-source (no orphan connections).
* [x] `pool_pre_ping` on by default — kills the silent-fail
  mode where a load balancer has dropped a backend.
* [x] `pool_recycle=1800` (30 min) — keeps long-lived
  connections from accumulating dead tuples.
* [x] SQLite for dev, Postgres for prod. The engine
  detects the URL scheme and applies the right pool
  family.

### 1.6 Production deployment

* [x] nginx config tested (`nginx -t` returns
  "syntax is ok / test is successful").
* [x] `/health`, `/health/live`, `/health/ready`,
  `/metrics` are routed with `access_log off` so
  Prometheus scrapes do not bloat the access log.
* [x] `open_file_cache` (8 h TTL) is set.
* [x] `gzip_min_length` lowered to 256 bytes;
  `gzip_types` widened to include woff/woff2/manifest+json.
* [x] Operator helper scripts in
  `deployment/scripts/{build,deploy,restart,backup,logs,
  healthcheck}.sh`.

### 1.7 Environment templates

* [x] `deployment/env/.env.production.example` declares
  54 env knobs across application / auth / CORS / database
  / AI / security / performance / observability groups.
* [x] `deployment/env/.env.staging.example` declares 51.
* [x] `CHANGE_ME` placeholders are scoped to secrets the
  operator MUST replace (JWT secret, AI API key).
* [x] The validator at startup logs a warning if
  `APP_ENV=production` and any secret knob is still set
  to its placeholder.

### 1.8 Security

* [x] 7 OWASP response headers on every response
  (CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, COOP, CORP).
* [x] HSTS-ready: nginx has the directive commented; the
  comment instructs the operator to set it at the LB
  for plain-HTTP-fronted setups.
* [x] Per-IP rate limit (default 120 / 60 s) with
  per-endpoint overrides (login = 10, register = 5,
  OCR / OCR-apply = 10).
* [x] Request-size cap (1 MiB JSON, 25 MiB multipart)
  enforced at the app layer; nginx caps first at the
  proxy.
* [x] Structured audit log under `atlas.security` for
  every rate-limit trip, oversized-body reject, and
  blocked origin.
* [x] CORS: explicit method/header allow-lists, credentials
  dropped automatically when `*` is in the origin list.
* [x] Cookies: `HttpOnly` + `Secure` + `SameSite` (from
  settings). `Secure` is forced in the production env
  template.
* [x] `validate_security_settings()` runs in the lifespan
  and logs warnings at boot.

### 1.9 Monitoring

* [x] `/health` returns a JSON aggregate (api, database,
  ai, knowledge, uptime, version) PLUS the new
  request-side counters (`request_count`,
  `active_requests`, `avg_latency_ms`, `error_rate`).
* [x] `/health/live` returns `{"status":"alive"}` (200).
* [x] `/health/ready` returns 200 / 503 with per-subsystem
  breakdown.
* [x] `/metrics` exposes Prometheus collectors
  (`atlas_http_requests_total`,
  `atlas_http_request_duration_seconds`,
  `atlas_http_requests_active`,
  `atlas_http_status_codes_total`,
  `atlas_http_exceptions_total`, build info, uptime).
* [x] Prometheus + Grafana services in the production
  overlay; dashboard auto-provisioned with 9 panels.
* [x] No external SaaS / cloud monitoring.

### 1.10 Performance

* [x] Starlette `GZipMiddleware` (settings-driven
  `minimum_size` + `compresslevel`).
* [x] nginx gzip (256-byte min) — second line of defence.
* [x] `open_file_cache` (8 h TTL) on nginx.
* [x] `experimental.optimizePackageImports` for
  `lucide-react` + `@tanstack/react/query`.
* [x] `compiler.removeConsole` (keep `error`, `warn`) in
  production builds.
* [x] Dynamic imports on `/admin/system` (only
  fetched when the operator opens the page).
* [x] No new top-level Python deps.
* [x] No Redis / Celery / Kubernetes / external cache
  (intentional per spec).

### 1.11 Documentation

* [x] `README.md` — architecture, features, install,
  Docker, env, dev workflow, API overview, folder
  structure.
* [x] `CHANGELOG.md` — per-sprint entries from Sprint 1
  Part 1 through Sprint 8 Part 4.
* [x] `RELEASE_NOTES.md` — RC1 highlights, breaking
  changes, upgrade notes, known limitations.
* [x] `PROJECT_COMPLETION_REPORT.md` — module inventory,
  endpoint inventory, page inventory, sprint-by-sprint
  feature matrix, known limitations, post-RC roadmap.
* [x] `docs/DEPLOYMENT.md` — production deploy guide
  (12 sections).
* [x] `docs/OPERATIONS.md` — day-2 runbook (11 sections).
* [x] `docs/TROUBLESHOOTING.md` — common issues (9
  sections).
* [x] Pre-existing `docs/` corpus (architecture, API
  catalog, spec, etc.) preserved.

---

## 2. Risks

The following risks are flagged for the GA promotion
review. Each has a mitigation in place but the operator
should know them before signing off.

| #   | Risk                                                                  | Severity | Mitigation                                                                   |
| --- | --------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| R1  | AI provider is `placeholder` by default; real inference requires a reachable Ollama daemon. | medium   | Layer falls back to placeholder; UI still works. The operator opts in.        |
| R2  | Notification state is held in `localStorage`; clearing browser storage loses read/unread state. | low      | The upstream payloads are not modified. Future migrations can re-build state. |
| R3  | No migration tool. Schema is created from SQLAlchemy metadata on first connect. Destructive changes require a `DROP TABLE`. | medium   | The schema is stable; the `migrations/versions/` folder is reserved for future Alembic use. |
| R4  | nginx serves plain HTTP. TLS is operator's responsibility.             | medium   | HSTS hint in nginx is commented; the deployment guide explains three TLS-termination options. |
| R5  | Single-region single-node. HA is not included.                        | medium   | Engine is stateless (JWT); a future sprint can add a second node behind the same LB. |
| R6  | No email / SMS / webhook alerts.                                       | low      | Intentional. Operator uses the Grafana dashboard + the structured log stream. |
| R7  | Postgres is NOT a service in Compose.                                  | low      | `DATABASE_URL` switches the engine. Operator runs Postgres separately.       |
| R8  | `db_echo` setting is renamed from `database.echo`. Old env files will silently default to False. | low      | The default is False which is the safe value; the rename is documented.      |
| R9  | Frontend bundle is ~1.5 MB gzipped. Acceptable for a SMB app but heavy. | low      | Dynamic imports for `/admin/system` already defer the largest chunk.        |
| R10 | OCR / OCR-apply per-endpoint rate limit (10 / 60 s) is conservative.   | low      | Override via `RATE_LIMIT_ENDPOINT_OVERRIDES` in the env file.                |

---

## 3. Deployment checklist

Run these commands in order. Each must succeed before the
next is run.

### 3.1 Pre-flight

```bash
git clone <repo> atlas-ai && cd atlas-ai
git checkout v1.0.0-rc1
cp deployment/env/.env.production.example deployment/env/.env.production
# Edit the env file. MUST change:
#   JWT_SECRET_KEY=$(openssl rand -hex 64)
#   AI_API_KEY=<provider-key>  (or leave as CHANGE_ME if using placeholder)
#   CORS_ORIGINS=https://your.host.example.com
#   COOKIE_SECURE=true
#   GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 24)

docker compose -f docker-compose.yml -f docker-compose.prod.yml config
# exit code MUST be 0
```

### 3.2 Bring up

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
# All 5 services should be 'healthy' within ~30 s.
```

### 3.3 First-user

```bash
curl -fsS -X POST http://<host>/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"full_name":"Operator","email":"you@example.com","password":"<32-char-secret>"}'
# 201 Created → 200 OK on /api/v1/auth/me
```

### 3.4 Smoke

```bash
curl -fsS http://<host>/health/live           # {"status":"alive"}
curl -fsS http://<host>/health                # JSON aggregate
curl -fsS http://<host>/health/ready          # {"ready":true,...}
curl -fsS http://<host>/metrics | head        # Prometheus exposition
```

### 3.5 Observability

```bash
# Prometheus (internal only; reach via docker exec)
docker compose ... exec prometheus wget -qO- http://localhost:9090/-/ready
# Grafana (internal only)
docker compose ... exec grafana wget -qO- http://localhost:3000/api/health
# Dashboard: "Atlas AI — Production" auto-loaded in the "Atlas AI" folder.
```

### 3.6 TLS

Pick one of the three options in `docs/DEPLOYMENT.md` §4
(CDN, LB, or sidecar Caddy). The nginx image stays plain
HTTP.

### 3.7 Backup

```bash
# Test a backup:
deployment/scripts/backup.sh
# Verify the snapshot:
ls -la backups/
```

### 3.8 Done

If every step above returns 0 / 200 / healthy, the
deployment is complete. The Grafana dashboard should show
non-zero counters within 15 s of the first request.

---

## 4. Rollback plan

### 4.1 Trigger conditions

Roll back the release if any of the following occur after
the GA cutover:

* **P0** — data corruption, security incident, or any
  5xx error rate > 1 % sustained for 5 minutes.
* **P1** — `/health/ready` returns 503 for > 2 minutes
  for reasons that cannot be cleared by a service
  restart.
* **P2** — a feature-level regression on a documented
  endpoint (e.g. `/api/v1/business/decision` returns
  malformed JSON).

### 4.2 Rollback procedure

```bash
# 1. Stop the broken stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# 2. Roll back to the previous tag
TAG=v0.9.0 docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Verify
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://<host>/health/live
curl -fsS http://<host>/health/ready
```

The image tag is a single env variable; the procedure is
the same for any rollback depth.

### 4.3 Database rollback

The `backend-data` volume is on a named volume. To roll
back to a previous state of the database:

```bash
docker compose ... stop backend
docker run --rm -v atlas-ai_backend-data:/data -v $PWD/backups:/backups \
  alpine sh -c 'rm -rf /data/* && tar xzf /backups/<snapshot>.tar.gz -C /data'
docker compose ... start backend
```

Postgres is operator-managed; rollback is a `pg_restore`
against the snapshot.

### 4.4 Post-mortem

After the rollback, capture:

* The first 5 minutes of `atlas.access` + `atlas.security`
  logs (the `X-Request-ID` of the first 5xx is the anchor).
* The Prometheus target page (`/-/targets`) state at the
  time of the failure.
* The Grafana dashboard snapshot for the failing window.

The `atlas.security` audit log is the canonical record for
rate-limit trips, oversized-body rejects, and blocked
origins.

---

## 5. Production validation

After the deployment is complete, run this validation
script from a host that can reach the production hostname.
The script fails fast and is safe to re-run.

```bash
# 1. Liveness
curl -fsS http://<host>/health/live | jq -e '.status == "alive"'

# 2. Readiness
curl -fsS http://<host>/health/ready | jq -e '.ready == true'

# 3. Health aggregate
curl -fsS http://<host>/health | jq -e '.api and .database and .ai and .knowledge'

# 4. Metrics endpoint
curl -fsS http://<host>/metrics | grep -c atlas_http_requests_total

# 5. Security headers
curl -fsSI http://<host>/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin-opener-policy|cross-origin-resource-policy' | wc -l
# MUST be >= 7

# 6. Gzip
curl -fsS -H 'accept-encoding: gzip' http://<host>/api/v1/knowledge/<article> \
  | gunzip | jq -e '.id'

# 7. Cache-Control on the always-fresh endpoints
curl -fsSI http://<host>/health | grep -i 'cache-control.*no-store'
curl -fsSI http://<host>/metrics | grep -i 'cache-control.*no-store'

# 8. Auth roundtrip
TOKEN=$(curl -fsS -X POST http://<host>/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<first-user>","password":"<password>"}' | jq -r .access_token)
curl -fsS -H "Authorization: Bearer $TOKEN" http://<host>/api/v1/auth/me | jq -e '.email'

# 9. Rate limit (after the smoke; one user should not trip 120/min)
for i in $(seq 1 20); do curl -fsS http://<host>/health >/dev/null; done
```

All nine checks must pass. Any failure is a rollback
trigger (see §4.1).

---

## 6. Tag

* **Local tag file:** `VERSION`
* **Tag value:** `v1.0.0-rc1`
* **Pre-release:** yes (this is the first RC; GA promotion
  follows after the next verification round).

A `VERSION` file at the repo root is the single source of
truth for the running release. The image tag
(`atlas-ai/backend:v1.0.0-rc1` /
`atlas-ai/frontend:v1.0.0-rc1`) is built from this file.
The Compose overlay honours `${TAG:-latest}` so an
operator can pin without a rebuild.

---

## 7. Promotion to GA

The RC is the freeze point. To promote to v1.0.0 GA:

1. Run the production validation script (§5) against the
   staging mirror.
2. Address any P0 / P1 tickets opened during the RC
   window.
3. Update `VERSION` to `v1.0.0`.
4. Tag the image, push to the registry.
5. Cut a new CHANGELOG entry under `## [1.0.0]`.

No further feature work lands between RC1 and GA except
hotfixes tagged `patch.x`.

---

## 8. Sign-off

* **Backend readiness:** PASS
* **Frontend readiness:** PASS
* **Docker readiness:** PASS
* **Database readiness:** PASS
* **Production deployment:** PASS
* **Environment templates:** PASS
* **Security:** PASS
* **Monitoring:** PASS
* **Performance:** PASS
* **Documentation:** PASS

**v1.0.0-rc1 is ready for Release Candidate freeze.**

Stop after Sprint 9 Part 1.

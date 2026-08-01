# Changelog

All notable changes to Atlas AI are recorded here. Versions
follow semantic versioning; the project is currently at
**v1.0.0** (General Availability).

## [v1.0.0] — 2026-07-27

General Availability release. The v1.0.0-rc1 freeze was
promoted to GA after a clean Sprint 9 Part 2 verification
run (zero regressions across the full verifier suite).

### Sprint 9 Part 2 — Production Release

* `FINAL_PROJECT_REPORT.md` — closing artefact with
  architecture, per-area statistics (backend: 33,587 LOC
  / 18 services / 22 endpoints; frontend: 23,126 LOC /
  15 pages / 12 protected routes), documentation index,
  completed roadmap, lessons learned, future
  enhancements.
* `CONTRIBUTING.md` — contribution policy, branch
  conventions, dev environment setup, code style (Python
  / TypeScript / YAML), PR checklist, commit-message
  format, release process, issue-triage policy.
* `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1.
* `LICENSE` — MIT.
* `README.md` — updated for v1.0 (replaces the v1.0.0-rc1
  intro and the "Release readiness" section with a
  "Release" section that points at the new artefacts).
* `scripts/verify_sprint9_part2.py` — final verifier
  covering all GA deliverables + regression of the
  five prior Sprint 8 / Sprint 9 verifiers.
* `VERSION` — `v1.0.0`.

### Sprint 9 Part 1 — Release Candidate freeze

* `RELEASE_CANDIDATE.md` — readiness checklist, 10-item
  risk register, deployment checklist, rollback plan,
  production validation script.
* `VERSION` — `v1.0.0-rc1` (subsequently promoted).
* `scripts/verify_sprint9_part1.py` + in-process smoke
  helper.

The first Release Candidate. Every Sprint 1–8 deliverable is
included. No new features between Sprint 8 Part 4 and Part 5
(Part 5 is documentation-only).

### Sprint 8 Part 4 — Performance Optimization

* Backend: `app.middleware.performance` with `GZipMiddleware`
  (settings-driven `minimum_size` / `compresslevel`) +
  `CacheControlMiddleware` that stamps
  `Cache-Control: no-store, max-age=0` on `/health`,
  `/health/live`, `/health/ready`, `/metrics`.
* Backend: SQLAlchemy engine now honours `db_pool_size`,
  `db_pool_max_overflow`, `db_pool_pre_ping`, `pool_recycle`,
  `pool_timeout` for non-SQLite URLs.
* Frontend: `/admin/system` page lazy-loaded via
  `next/dynamic` (`ssr: false`).
* Frontend: `experimental.optimizePackageImports`
  (`lucide-react`, `@tanstack/react-query`) +
  `compiler.removeConsole` in production.
* nginx: `open_file_cache`, lowered `gzip_min_length`
  (1024 → 256), wider `gzip_types` (woff/woff2/manifest+json,
  x-ndjson).
* Backend Dockerfile: strips `__pycache__` / `*.pyc` and pip
  cache before `COPY --from=builder`.
* Verifier: `scripts/verify_sprint8_part4.py` (67 checks).

### Sprint 8 Part 3 — Security Hardening

* Backend: `app.middleware.security` with
  `SecurityHeadersMiddleware` (CSP, COOP, CORP, HSTS, X-Frame-
  Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy), `RequestSizeLimitMiddleware`
  (1 MiB JSON / 25 MiB multipart),
  `RateLimitMiddleware` (per-IP sliding window + per-endpoint
  overrides), structured audit log under
  `atlas.security`.
* Backend: `validate_security_settings()` runs in the
  lifespan and logs warnings at boot.
* CORS: explicit allow-methods / allow-headers; credentials
  dropped automatically when `*` is in the origin list.
* Auth: cookies honour `cookie_httponly`, `cookie_secure`,
  `cookie_samesite`, `cookie_path`.
* Frontend: `next.config.mjs` exports the same header set
  through `headers()`.
* Docker: all 5 services run `read_only: true`,
  `cap_drop: [ALL]`, `security_opt: no-new-privileges:true`.
* nginx: full OWASP header set (CSP, COOP, CORP, HSTS
  hint, Permissions-Policy, Referrer-Policy).
* Verifier: `scripts/verify_sprint8_part3.py` (97 checks).

### Sprint 8 Part 2 — Monitoring & Observability

* Backend: `app.monitoring` package with Prometheus
  collectors (`atlas_http_requests_total`,
  `atlas_http_requests_active`,
  `atlas_http_request_duration_seconds`,
  `atlas_http_status_codes_total`,
  `atlas_http_exceptions_total`, health gauges,
  build info, uptime).
* Backend: middleware stack — `RequestIdMiddleware`
  (X-Request-ID + propagation), `AccessLogMiddleware`
  (JSON access log), `ErrorHandlerMiddleware` (uniform
  500 envelope + exception counter).
* Backend: `app.monitoring.logging` — JSON formatter
  with redaction of `password`, `token`, `cookie`,
  `authorization`, etc.
* Backend: `/health`, `/health/live`, `/health/ready`,
  `/metrics` endpoints. `/health` now also returns
  `request_count`, `active_requests`, `avg_latency_ms`,
  `error_rate` for the operator dashboard.
* Frontend: `/admin/system` (Sprint 8 Part 2 deliverable)
  reads `/health` and renders a read-only operator view
  with auto-refresh every 15 s.
* Deployment: Prometheus + Grafana services added to the
  production overlay; dashboard auto-provisioned with
  9 panels (Requests/sec, Error %, Latency, Active
  Requests, Requests/sec stacked, Latency percentiles,
  AI endpoint latency, OCR endpoint latency, Health
  endpoint status).
* Verifier: `scripts/verify_sprint8_part2.py` (62 checks).

### Sprint 8 Part 1 — Production Infrastructure

* Multi-stage Dockerfiles for backend and frontend.
* `gunicorn_conf.py` with `UvicornWorker`, `preload_app`,
  worker recycling, graceful timeout.
* `entrypoint.sh` with pre-import validation.
* nginx reverse proxy with `/api/`, `/docs/`, `/ws/`,
  `/_next/static/`, security headers, gzip, OCR upload
  sizing.
* `deployment/scripts/{build,deploy,restart,backup,logs,
  healthcheck}.sh` operator helpers.
* Verifier: `scripts/verify_sprint8_part1.py`.

### Sprint 7 Parts 1–5

* **Part 1** — Sprint 1 polish, regression fix pass.
* **Part 2** — AI provider layer (`placeholder` / `ollama`).
* **Part 3** — Conversations Center + decision 404-tolerant
  read-only aggregator.
* **Part 4** — Knowledge Center (read-only retrieval over
  the seeded catalog of 14 articles).
* **Part 5** — Predictive Analytics + Advisor.

### Sprint 6 Parts 1–4

* **Part 1** — vertical slice: business → decision.
* **Part 2** — vertical slice: action board.
* **Part 3** — Insights Center (aggregator over
  decision / rules / recommendations / roadmap / twin).
* **Part 4** — Notifications Center (frontend-only
  read/unread state, no backend notification storage).

### Sprint 5 (Polish & UX)

* Dashboard, Business, Action Board, Reports polish.

### Sprint 4 Parts 1–3

* **Part 1** — vertical slice: business profile.
* **Part 2** — vertical slice: action board.
* **Part 3** — dashboard + action board polish (UX).

### Sprint 3 (TDD series)

* Tests, fixtures, end-to-end contract suite.

### Sprint 2 (Business / Decision / Twin)

* Core domain models, decision engine, digital twin.

### Sprint 1 Parts 1–3

* **Part 1** — scaffolding, FastAPI factory, settings.
* **Part 2** — auth (JWT + cookies) + first user table.
* **Part 3** — business profile + OCR + scoring.

# Troubleshooting

This is the catalogue of common issues an operator will hit
while running Atlas AI 1.0.0-rc1, with concrete fixes for
each. Issues are grouped by surface area; the most common
ones are at the top.

## 1. Boot / startup

### 1.1 `backend` exits with `pydantic` validation error

```
pydantic_settings.errors.SettingsError: JWT_SECRET_KEY
  Field required
```

**Cause:** the env file is missing or `JWT_SECRET_KEY` is
empty.
**Fix:** `echo "JWT_SECRET_KEY=$(openssl rand -hex 64)" >>
deployment/env/.env.production`. Re-run.

### 1.2 `backend` exits with `cannot import app`

**Cause:** the `app/` directory is missing or the working
directory inside the container is wrong.
**Fix:** the image sets `WORKDIR=/app`; if you `docker exec`
make sure you're at the right path. The image's
`entrypoint.sh` runs `python -c "import app"` before
gunicorn starts so this fails fast.

### 1.3 `nginx` exits with `nginx: [emerg] unknown directive`

**Cause:** the `nginx.conf` was edited and a syntax error
landed in the file. The image's `HEALTHCHECK` should
catch this but it can race with a fast `up -d`.
**Fix:** `docker run --rm -v
$PW/deployment/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
--entrypoint nginx nginx:1.27-alpine -t` returns the
offending line. Fix and `docker compose ... up -d nginx`.

## 2. Health / readiness

### 2.1 `/health/ready` returns 503

The body lists which subsystem is degraded:

```json
{"ready":false,"database":true,"knowledge":false,"ai":true,
 "details":{"database":"ok","knowledge":"empty","ai":"ok"}}
```

`knowledge: "empty"` means the JSON catalog did not load
(typically a missing or zero-byte `knowledge_catalog.json`
inside the image). `database: "..."` carries the underlying
error (e.g. "OperationalError: unable to open database file").

**Fixes:**

* `docker compose ... exec backend ls -l
  /var/lib/atlas-ai/atlas_ai.db` — file exists?
* `docker compose ... exec backend sqlite3
  /var/lib/atlas-ai/atlas_ai.db ".tables"` — schema loaded?
* Check the `backend-data` volume: if it was created with
  the wrong UID, the named volume is owned by `root` and
  the non-root `appuser` cannot write. `docker compose ...
  exec backend chown -R appuser:appuser /var/lib/atlas-ai`
  fixes it (but the right fix is to delete the volume and
  let Compose recreate it with the right UID).

### 2.2 `/health/live` returns 200 but every request 502s

The liveness probe is too lenient — it returns 200 as long
as the process is alive. A 502 means the **upstream**
(nginx → backend) is failing.
**Fix:** `docker compose ... logs nginx` for the upstream
error. The common cause is the backend container crashed
without the orchestrator noticing; restart it explicitly
with `docker compose ... restart backend`.

## 3. Authentication

### 3.1 `POST /api/v1/auth/login` returns 429

The login endpoint is on the per-endpoint rate-limit
override (10 / 60 s). The default is conservative; raise it
in the env file:

```env
RATE_LIMIT_ENDPOINT_OVERRIDES=/api/v1/business/ocr:10,/api/v1/business/ocr/apply:10,/api/v1/auth/login:30,/api/v1/auth/register:5
```

### 3.2 Cookie is set but the user is "unauthenticated"

**Cause:** the cookie is `Secure` but the page is on
plain HTTP. Browsers drop `Secure` cookies over HTTP.
**Fix:** either enable TLS (recommended) or set
`COOKIE_SECURE=false` in the env file (dev only).

### 3.3 CORS preflight returns 403

`Access-Control-Allow-Origin` is not echoed. The most common
cause is the browser is sending an `Origin` header that
isn't in `CORS_ORIGINS`. The CORS middleware drops
credentials when `*` is in the origin list, so a
credentialed request from a wildcard origin is denied
(by design). Add the actual origin to the list and restart.

## 4. OCR

### 4.1 `POST /api/v1/business/ocr` returns 415

The filename extension is not in the allow-list (PDF / PNG /
JPG / JPEG). The error body names the offending filename.
**Fix:** the upload must end in one of those extensions; the
content-type header is checked as a secondary signal.

### 4.2 `POST /api/v1/business/ocr` returns 413

The upload is larger than `MAX_UPLOAD_BODY_BYTES` (default
25 MiB). The error body names the cap and the actual size.
**Fix:** either resize the image / re-export the PDF or
raise the cap in the env file. nginx also has
`client_max_body_size 25m`; both must be raised in lockstep
(nginx caps first, so the env cap is the second line of
defence).

### 4.3 `POST /api/v1/business/ocr` returns 404

The user has no business profile yet. The OCR endpoint
deliberately short-circuits to save a 25 MB upload on a
user who cannot apply the result anyway. **Fix:** create
the business profile first.

## 5. Performance

### 5.1 First request is slow

The 14-article knowledge catalog is loaded on first import
and stays in process memory. Subsequent requests are
sub-millisecond. If the first request is consistently
> 1 s, check `docker compose ... logs backend` for
startup errors (a missing dependency forces a retry).

### 5.2 Backend is CPU-bound

`docker compose ... stats` shows backend at > 80 % CPU
sustained. Two common causes:

1. **Ollama is in-process** — the layer calls out to an
   Ollama daemon over HTTP, but a slow downstream inflates
   `REQUEST_DURATION`. Switch the model, or switch back
   to `AI_PROVIDER=placeholder` while you investigate.
2. **Gunicorn workers under-provisioned** — raise
   `GUNICORN_WORKERS` (see `OPERATIONS.md` §5).

### 5.3 Frontend bundle is too large

Run `npm run build` and look at the `.next/analyze/`
output. The likely culprits are deep barrel imports from
`lucide-react` (the `optimizePackageImports` config
already mitigates this) or a third-party lib that pulls in
`moment` / `lodash`. The first is fixed by listing the
package in `optimizePackageImports`; the second is fixed
by removing the dependency.

## 6. Observability

### 6.1 Grafana dashboard is empty

Prometheus has not scraped yet. Wait 15 s. The
`deployment/prometheus/prometheus.yml` file is the
single source of truth for the scrape config; a misconfig
shows up in `docker compose ... logs prometheus`.

### 6.2 `atlas.security` audit log is empty

The audit logger is named in `app/middleware/security.py`
as `atlas.security`. If the JSON formatter is not installed
(atlas.security messages come out as plain text) the log
stream is still present, just not in the JSON shape other
loggers expect. Confirm `app.monitoring.logging.configure_structured_logging`
ran at boot by greping the startup log for
`"logger": "atlas.security"`.

### 6.3 Prometheus target is DOWN

`http://<host>:9090/targets` shows the backend target with
`health: down`. The most common cause is the backend
container is not on the `atlas-net` network (a misconfigured
Compose override removed it). `docker network inspect atlas-net`
should show all 5 services attached.

## 7. Docker / disk

### 7.1 Disk is full

`backend-data` and `prometheus-data` are the two volumes
that grow over time. `deployment/scripts/backup.sh` keeps
the snapshot retention at 7 days. The Prometheus TSDB has
a 15-day retention set in the command line
(`--storage.tsdb.retention.time=15d`). Adjust both as
needed.

### 7.2 Container is `unhealthy`

`docker compose ... ps` shows `unhealthy` for one of the
services. The most common cause is the start_period (20 s)
was too short for a cold start. The default is tuned for
the production overlay; a dev machine with a slow disk may
need `start_period: 60s` in the override.

## 8. Verifier

### 8.1 `verify_sprint8_part3.py` reports "ModuleNotFoundError: pydantic"

The verifier runs the in-process behaviour helper inside
the backend venv at `backend/.venv/Scripts/python.exe`. If
the venv was never created, the behaviour checks are
skipped (the static checks still pass). To enable them:

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

### 8.2 `verify_sprint8_part4.py` reports a stale FAIL

The verifier's whitelist is enforced by file path; a
rebase that renames a file shows up as a "modified business
logic" failure. Update the whitelist in the verifier and
re-run.

## 9. Where to get help

* `docs/OPERATIONS.md` — day-2 runbook.
* `docs/DEPLOYMENT.md` — production deploy walkthrough.
* `docs/ARCHITECTURE.md` (in `docs/`) — system architecture.
* `docs/API_CATALOG.md` (in `docs/`) — endpoint contract.
* `PROJECT_COMPLETION_REPORT.md` — module / endpoint / page
  inventory + known limitations.

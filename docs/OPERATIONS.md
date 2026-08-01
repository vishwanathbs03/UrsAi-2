# Operations Runbook

This is the day-2 runbook for Atlas AI 1.0.0-rc1. It covers
the common operator actions: deploy, restart, scale, debug,
recover, and rotate secrets. The patterns here assume the
production Compose overlay described in `DEPLOYMENT.md`.

## 1. Daily checks

* **Health** — `curl -fsS http://<host>/health/live` returns
  `{"status":"alive"}` and 200. If it returns 5xx, restart
  the backend (see §4).
* **Readiness** — `curl -fsS http://<host>/health/ready`
  returns 200. A 503 means the database, knowledge catalog,
  or AI engine is degraded. The response body lists the
  per-subsystem status.
* **Errors** — `curl -sS http://<host>/metrics | grep
  atlas_http_exceptions_total` should be flat or trending
  down. A spike means a code path is failing; check the
  `atlas.errors` log stream for the stack trace.
* **Latency** — the Grafana dashboard's p95 panel should
  sit under 250 ms in steady state. > 1 s sustained means
  the backend is overloaded (scale workers) or a downstream
  is slow (DB / Ollama).
* **Disk** — `backend-data` (SQLite) and `prometheus-data`
  (TSDB) both grow over time. `backup.sh` plus the
  `prometheus.tsdb.retention.time=15d` flag keep them
  bounded.

## 2. Logs

The backend emits three JSON streams:

| Logger                | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `atlas.access`        | one line per request (request_id, method, path, status, duration_ms, user_id) |
| `atlas.security`      | one line per security event (rate-limit trip, oversized body, blocked origin) |
| `<python logger>`     | application log (config / startup / business events) |

Filter examples (assuming `jq` is available):

```bash
# All 5xx in the last hour
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend \
  | grep atlas.access | jq -c 'select(.status >= 500)'

# All rate-limit trips
docker compose ... logs backend \
  | jq -c 'select(.event == "rate_limit_exceeded")'

# Trace a single request by id
docker compose ... logs backend | grep '5f9a3c2e...'
```

The `X-Request-ID` response header is the same id; an
operator who can read the browser dev-tools can grep their
own session.

## 3. Deploy / update

```bash
# Pull the new image
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull backend

# Recreate just the backend (zero-downtime, gunicorn
# graceful_timeout = 30 s)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps backend

# Watch the rollout
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

`--no-deps` stops Compose from also recreating the
upstream/downstream services. Use it for any single-service
roll.

## 4. Restart a single service

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

Or use the operator helper:

```bash
deployment/scripts/restart.sh backend
```

The script wraps Compose with a pre-flight health check so a
restart that immediately fails is flagged instead of silently
looping.

## 5. Scale the backend

The backend service is fixed at 4 workers in the production
overlay. To raise it, edit the overlay:

```yaml
backend:
  environment:
    GUNICORN_WORKERS: "8"
```

Then `docker compose ... up -d backend`. The image's
`entrypoint.sh` reads `GUNICORN_WORKERS` and passes it to
gunicorn; no rebuild is required.

Match the DB pool: `DB_POOL_SIZE` ×
`DB_POOL_MAX_OVERFLOW` should be ≥ 2 × `GUNICORN_WORKERS`
so a connection is always available.

## 6. Rotate secrets

JWT secret rotation invalidates every existing session. Do
it during a maintenance window:

```bash
NEW_JWT=$(openssl rand -hex 64)
# Update deployment/env/.env.production
sed -i "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$NEW_JWT/" deployment/env/.env.production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend
```

Users will be forced to log in again. Cookie path /
secure flag / SameSite can be rotated independently
(`COOKIE_PATH`, `COOKIE_SECURE`, `COOKIE_SAMESITE`).

## 7. Database maintenance

* **SQLite** — `sqlite3 /var/lib/atlas-ai/atlas_ai.db
  "VACUUM;"` from inside the container. Run during a quiet
  window; takes a couple of seconds.
* **Postgres** — `VACUUM ANALYZE` from a cron job. The
  engine's `pool_recycle=1800` keeps long-lived connections
  from accumulating dead tuples.
* **Backups** — `deployment/scripts/backup.sh` is the
  canonical path. Snapshot retention is 7 days by default;
  adjust in the script.

## 8. Health / metrics / dashboards

| Surface       | URL                    | Internal / external   |
| ------------- | ---------------------- | --------------------- |
| `/health`     | `http://<host>/health` | external (read-only)  |
| `/metrics`    | `http://<host>/metrics`| internal only         |
| Prometheus    | `http://<host>:9090`   | internal only         |
| Grafana       | `http://<host>:3000`   | internal only         |

If an operator needs to reach the internal services, use:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec prometheus wget -qO- http://localhost:9090/-/ready
```

## 9. Common failure modes

* **Backend crashloop** — usually a bad env var. Run
  `docker compose ... logs backend | tail -50` and look
  for the `pydantic` validation error.
* **Readiness = 503** — check `/health` for the per-
  subsystem breakdown. The most common cause is the SQLite
  file becoming unwritable (disk full, permission issue
  on the named volume).
* **Slow first request** — cold start loads the
  14-article knowledge catalog. Subsequent requests are
  fast. The first scrape of the day is slow for the same
  reason.
* **Grafana dashboard empty** — Prometheus has not scraped
  yet. Wait 15 s for the first scrape interval, or hit
  `http://<host>:9090/targets` to confirm the backend
  target is up.

## 10. Operator helpers

`deployment/scripts/` ships six helpers:

| Script          | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `build.sh`      | rebuild + tag a single image                       |
| `deploy.sh`     | rolling deploy of the full stack                   |
| `restart.sh`    | restart a single service with health-gate          |
| `backup.sh`     | snapshot the persistent volumes                    |
| `logs.sh`       | tail a single service's logs with filter           |
| `healthcheck.sh`| run the verifier suite against a running stack     |

Each script accepts `--help` and uses `set -eu` so a
partial failure fails fast.

## 11. Audit log retention

The `atlas.security` audit log is shipped to stdout, where
the log driver (`json-file` with `max-size=10m`,
`max-file=3`) keeps the last 30 MB per container. If the
operator needs longer retention, point the backend at a
remote log shipper (filebeat, fluentbit, etc.) by changing
the `logging.driver` in the Compose overlay.

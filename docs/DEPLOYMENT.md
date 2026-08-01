# Deployment Guide

This is the operator-facing deployment guide for Atlas AI
1.0.0-rc1. It covers a single-node production deploy, a
staging mirror, and a TLS-terminated setup.

## 1. Prerequisites

* **Docker** 24+ with the Compose v2 plugin.
* A reachable **DNS A/AAAA record** for the public hostname.
* An **Ollama** daemon if you intend to use a real LLM
  provider (optional; `placeholder` is the default).
* (Recommended) A **TLS terminator** in front of nginx
  (Cloudflare, an ALB, a sidecar Caddy, etc.) — the nginx
  image only listens on plain HTTP.

## 2. Pre-flight

```bash
git clone <repo> atlas-ai && cd atlas-ai
cp deployment/env/.env.production.example deployment/env/.env.production
# Edit the file. The must-change values:
#   JWT_SECRET_KEY=$(openssl rand -hex 64)
#   AI_API_KEY=<provider-key>  (or leave as CHANGE_ME if using placeholder)
#   CORS_ORIGINS=https://your.host.example.com
#   COOKIE_SECURE=true
#   GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 24)
```

Validate the file before bringing anything up:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

A non-zero exit code means a YAML or env-typing error;
inspect the message and fix.

## 3. Boot

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

`ps` should show all 5 services (`backend`, `frontend`,
`nginx`, `prometheus`, `grafana`) in `healthy` state within
~30 s.

## 4. TLS termination

The nginx image serves plain HTTP on port 80. In production
we recommend one of:

1. **Cloudflare / CDN** in front of the host — terminate TLS
   there, allow only HTTPS-originated traffic to reach the
   nginx container, enable HSTS at the CDN.
2. **AWS ALB / GCP LB** — terminate TLS at the load balancer,
   forward on port 80 to the nginx container.
3. **Sidecar Caddy** — add a `caddy` service that
   auto-provisions Let's Encrypt certs and forwards on
   `127.0.0.1:80`. (Out of scope for this RC; tracked in
   the future roadmap.)

The HSTS hint in `deployment/nginx/nginx.conf` is left
commented because HSTS over plain HTTP is a no-op and an
operator-fronted setup is the recommended posture.

## 5. Database

The default backend uses an on-disk SQLite file at
`/var/lib/atlas-ai/atlas_ai.db` inside the container. The
named volume `backend-data` persists the file across
container restarts. For horizontal scaling switch to
PostgreSQL:

```bash
DATABASE_URL=postgresql+psycopg2://user:pass@db:5432/atlas
```

The engine honours `db_pool_size` / `db_pool_max_overflow` /
`db_pool_pre_ping` / `pool_recycle` for the Postgres path;
SQLite ignores the pool settings.

## 6. Backups

`deployment/scripts/backup.sh` snapshots the backend-data
volume to a timestamped `.tar.gz`. The default retention is
7 days. Run from cron or systemd:

```cron
0 3 * * * /opt/atlas-ai/deployment/scripts/backup.sh
```

For Postgres, use `pg_dump` against the upstream DB and ship
the result to the same backup target.

## 7. Observability

* **Prometheus** — `http://<host>:9090` (internal only;
  reach via `docker exec` or an operator tunnel).
* **Grafana** — `http://<host>:3000` (internal only). Login
  with `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from
  the env file. The "Atlas AI — Production" dashboard is
  auto-provisioned under the "Atlas AI" folder.
* **Logs** — `docker compose logs -f` or your log
  shipper. The backend emits structured JSON; every request
  carries a `X-Request-ID` you can grep on.

## 8. Rate limits

Default per-IP budgets (per minute):

| Endpoint                          | Budget |
| --------------------------------- | ------ |
| Global                            | 120    |
| `POST /api/v1/business/ocr`       | 10     |
| `POST /api/v1/business/ocr/apply` | 10     |
| `POST /api/v1/auth/login`         | 10     |
| `POST /api/v1/auth/register`      | 5      |

Override via `RATE_LIMIT_REQUESTS` /
`RATE_LIMIT_WINDOW_SECONDS` /
`RATE_LIMIT_ENDPOINT_OVERRIDES` in the env file. Loopback
traffic is always allowed to flow freely (a single
developer's polling loop should not trip the limiter).

## 9. Container hardening

Every service runs with:

* `read_only: true` (writes only via tmpfs mounts)
* `cap_drop: [ALL]` (no Linux capabilities)
* `security_opt: ["no-new-privileges:true"]` (no setuid
  escalation)
* Non-root user (`appuser` for backend, `nextjs` for
  frontend)

If a future feature needs a capability (e.g. NET_BIND_SERVICE
for port 80 in-container), add it to the service's
`cap_add` list explicitly — never rely on the default.

## 10. Rollback

```bash
TAG=v0.9.0 docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The `TAG` env variable selects the image tag; combined with
the `:latest` default it allows point-in-time rollback
without rebuilding.

## 11. Health probes

| Path             | When to use                                          |
| ---------------- | ---------------------------------------------------- |
| `/health/live`   | Kubernetes `livenessProbe` / Docker `HEALTHCHECK`    |
| `/health/ready`  | Kubernetes `readinessProbe` / load-balancer routing  |
| `/health`        | Operator dashboard, Grafana scrape                   |
| `/metrics`       | Prometheus scrape                                    |

All four return 200 (or 503 for `/health/ready` when
readiness fails).

## 12. Disaster recovery

* The on-disk SQLite file is the only persistent state.
  Restore from a `backup.sh` snapshot by re-creating the
  `backend-data` volume and dropping the file in.
* Prometheus's TSDB is on a named volume; if the metrics
  history is lost, the dashboard starts blank and re-fills
  from the next scrape.
* Grafana's provisioning is read-only; a fresh container
  re-creates the dashboard from `deployment/grafana/`.
  Dashboards the operator created in the UI are in the
  `grafana-data` volume — back it up separately.

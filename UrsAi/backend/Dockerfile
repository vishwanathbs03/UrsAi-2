# =============================================================================
# Backend — production multi-stage build.
#
# Stage 1: builder  — install Python deps into a venv
# Stage 2: runtime  — slim image with the venv, gunicorn, and the app
#
# The runtime image has no compilers, no pip cache, no .pyc noise. It runs as
# an unprivileged user and exposes a /healthcheck-ready port for the reverse
# proxy. Application code is mounted in last so the build cache survives
# code-only changes (deps layer only invalidates when requirements.txt
# changes).
# =============================================================================

# --- builder -------------------------------------------------------------- #
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build-time deps first so this layer caches well.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

# Build a venv so the runtime image can copy it without re-resolving.
COPY requirements.txt ./
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip wheel \
 && /opt/venv/bin/pip install -r requirements.txt \
 && /opt/venv/bin/pip install "gunicorn==23.0.0"

# --- runtime -------------------------------------------------------------- #
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:${PATH}" \
    APP_HOME=/app \
    APP_USER=appuser

# Runtime-only system deps. psycopg2-binary wheels include libpq so we do
# NOT need libpq-dev here; same for bcrypt / pillow. We only add tini for
# proper signal handling under gunicorn.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*

# Pull the venv over from the builder.
COPY --from=builder /opt/venv /opt/venv

# Create the unprivileged runtime user. The app directory must be writable
# by this user so SQLite / log files work in the running container.
RUN groupadd --system ${APP_USER} \
 && useradd --system --gid ${APP_USER} --create-home --shell /usr/sbin/nologin ${APP_USER} \
 && mkdir -p ${APP_HOME} /var/log/atlas-ai /var/lib/atlas-ai \
 && chown -R ${APP_USER}:${APP_USER} ${APP_HOME} /var/log/atlas-ai /var/lib/atlas-ai

WORKDIR ${APP_HOME}
USER ${APP_USER}

# Copy the application source last so dependency layers cache.
COPY --chown=${APP_USER}:${APP_USER} app ./app
COPY --chown=${APP_USER}:${APP_USER} requirements.txt ./
COPY --chown=${APP_USER}:${APP_USER} gunicorn_conf.py ./
COPY --chown=${APP_USER}:${APP_USER} entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# The FastAPI app object is `app:app` in app/main.py.
ENV APP_MODULE=app.main:app \
    GUNICORN_WORKERS=2 \
    GUNICORN_THREADS=2 \
    GUNICORN_TIMEOUT=60 \
    GUNICORN_KEEPALIVE=5 \
    APP_HOST=0.0.0.0 \
    APP_PORT=8000 \
    LOG_LEVEL=INFO

EXPOSE 8000

# tini gives us PID 1 + proper SIGTERM forwarding so gunicorn shuts down
# cleanly when `docker stop` is invoked. The entrypoint sets up the SQLite
# path / migration step (idempotent) before exec'ing gunicorn.
ENTRYPOINT ["/usr/bin/tini", "--", "./entrypoint.sh"]

# Container-level liveness probe. The compose file overrides the URL
# with the in-container path; the same command works for `docker run`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${APP_PORT}/api/v1/health" || exit 1

CMD ["gunicorn"]

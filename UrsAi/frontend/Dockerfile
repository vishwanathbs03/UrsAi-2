# =============================================================================
# Frontend — production multi-stage build.
#
# Stage 1: deps      — install npm deps (cache-friendly)
# Stage 2: builder   — copy source + .next build into a slim runner
# Stage 3: runtime   — copy only the standalone output + public + static
#
# The runtime image is a small node:alpine with just the standalone
# server, static assets, and a non-root user. Total image size is
# ~150 MB versus the ~700 MB a full `node_modules` would cost.
# =============================================================================

# --- deps ----------------------------------------------------------------- #
FROM node:20-alpine AS deps

WORKDIR /app

# Install only the lockfile so this layer caches across source-only
# changes. `npm ci` is the deterministic, lockfile-only installer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- builder -------------------------------------------------------------- #
FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment. The frontend reads `apiBaseUrl` from process.env
# at server start; passing it here ensures the standalone bundle resolves
# the production backend URL (the in-container DNS name "backend"). The
# `NEXT_PUBLIC_*` variants are exposed to the browser bundle at build
# time; we use both so SSR + browser agree.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# next build writes a `.next/standalone` folder that contains only the
# files needed to run the app at runtime. The full source tree is
# excluded so we ship the minimum.
RUN npm run build

# --- runtime -------------------------------------------------------------- #
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as a non-root user so the container can be locked down with
# `read_only: true` and minimal capabilities.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Static assets (favicon, OG images, etc.) — Next copies them into
# `public/` and the standalone server reads from there.
COPY --from=builder /app/public ./public

# The standalone output includes a `server.js` entry point and a
# self-traced `node_modules` folder. We also need the `.next/static`
# directory that the standalone server references at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Container-level liveness probe. The reverse proxy also probes `/`, so
# the same command works for `docker run` outside compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]

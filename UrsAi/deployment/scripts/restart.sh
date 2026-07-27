#!/usr/bin/env bash
# =============================================================================
# restart.sh — rolling restart of the running services.
#
# Usage:
#   deployment/scripts/restart.sh             # restart everything
#   deployment/scripts/restart.sh backend     # restart one service
#
# Uses `docker compose restart` which is non-rolling (the named
# container is stopped then started). For a zero-downtime rolling
# restart, use `docker compose up -d --no-deps <service>` which uses
# the same image but recreates the container.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
    TARGETS=(backend frontend nginx)
fi

docker compose -f "${ROOT_DIR}/docker-compose.yml" restart "${TARGETS[@]}"

echo "[restart] done: ${TARGETS[*]}"

#!/usr/bin/env bash
# =============================================================================
# logs.sh — tail logs for the running stack.
#
# Usage:
#   deployment/scripts/logs.sh                # tail everything
#   deployment/scripts/logs.sh backend        # tail one service
#   deployment/scripts/logs.sh backend nginx  # tail a subset
#
# Pass -f / --follow implicitly; the script also accepts TAIL=200 to
# bound the initial buffer (default 100).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TAIL="${TAIL:-100}"
SERVICES=("$@")
EXTRA_FLAGS=(--tail "${TAIL}" --follow)

docker compose -f "${ROOT_DIR}/docker-compose.yml" logs "${EXTRA_FLAGS[@]}" "${SERVICES[@]}"

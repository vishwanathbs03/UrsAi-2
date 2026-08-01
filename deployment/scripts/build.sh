#!/usr/bin/env bash
# =============================================================================
# build.sh — build the production images.
#
# Usage:
#   deployment/scripts/build.sh              # build everything
#   deployment/scripts/build.sh backend      # build one service
#
# Tags default to <service>:dev. Override with TAG=1.2.3 to bake a
# versioned tag. The script forwards --no-cache when BUILD_NO_CACHE=1.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
PROD_FILE="${ROOT_DIR}/docker-compose.prod.yml"

TAG="${TAG:-dev}"
TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
    TARGETS=(backend frontend)
fi

NO_CACHE_FLAG=()
if [ "${BUILD_NO_CACHE:-0}" = "1" ]; then
    NO_CACHE_FLAG=(--no-cache)
fi

echo "[build] tag=${TAG} targets=${TARGETS[*]}"

for svc in "${TARGETS[@]}"; do
    case "${svc}" in
        backend|frontend)
            echo "[build] building ${svc}:${TAG}"
            docker build \
                ${NO_CACHE_FLAG[@]:+"${NO_CACHE_FLAG[@]}"} \
                -f "${ROOT_DIR}/${svc}/Dockerfile" \
                -t "atlas-ai/${svc}:${TAG}" \
                "${ROOT_DIR}/${svc}"
            ;;
        *)
            echo "[build] unknown service: ${svc}" >&2
            exit 1
            ;;
    esac
done

echo "[build] done"

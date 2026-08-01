#!/usr/bin/env bash
# =============================================================================
# deploy.sh — deploy the stack.
#
# Usage:
#   deployment/scripts/deploy.sh             # staging (base compose)
#   deployment/scripts/deploy.sh prod        # production overlay
#
# This script is intentionally thin — it does the same thing an
# operator would type by hand. A real CI/CD pipeline would replace it
# with a GitHub Actions / GitLab CI / Argo workflow; the brief is
# explicit that no CI/CD is in scope.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TARGET="${1:-staging}"

case "${TARGET}" in
    staging|dev|local)
        echo "[deploy] target=staging (docker-compose.yml)"
        docker compose -f "${ROOT_DIR}/docker-compose.yml" \
                      --env-file "${ROOT_DIR}/deployment/env/.env.staging.example" \
                      up -d --build
        ;;
    prod|production)
        echo "[deploy] target=production (docker-compose.yml + docker-compose.prod.yml)"
        docker compose -f "${ROOT_DIR}/docker-compose.yml" \
                      -f "${ROOT_DIR}/docker-compose.prod.yml" \
                      --env-file "${ROOT_DIR}/deployment/env/.env.production.example" \
                      up -d --build
        ;;
    *)
        echo "[deploy] unknown target: ${TARGET} (use staging|prod)" >&2
        exit 1
        ;;
esac

echo "[deploy] done"

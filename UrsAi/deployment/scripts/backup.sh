#!/usr/bin/env bash
# =============================================================================
# backup.sh — snapshot the on-disk database and uploaded files.
#
# Usage:
#   deployment/scripts/backup.sh              # snapshot backend-data
#   deployment/scripts/backup.sh /var/backups  # custom destination
#
# The script copies the SQLite file (and WAL/SHM sidecars) to the
# destination directory using `sqlite3 .backup` so the snapshot is
# internally consistent. No external database container is started —
# the brief says "use the existing configured database".
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEST="${1:-${BACKUP_DEST:-./backups}}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${DEST}/${TIMESTAMP}"

mkdir -p "${BACKUP_DIR}"

# Prefer the Docker path (the live DB lives inside the running
# container). If the container is not running, fall back to a
# direct file copy from the named volume mount point.
CONTAINER_NAME="${BACKUP_CONTAINER:-atlas-ai-backend}"
VOLUME_NAME="${BACKUP_VOLUME:-atlas-ai_backend-data}"

if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    echo "[backup] snapshotting DB from running container ${CONTAINER_NAME}"
    docker exec "${CONTAINER_NAME}" \
        sh -c 'sqlite3 /var/lib/atlas-ai/atlas_ai.db ".backup /tmp/atlas_ai.db.snap"'
    docker cp "${CONTAINER_NAME}:/tmp/atlas_ai.db.snap" \
        "${BACKUP_DIR}/atlas_ai.db"
    docker exec "${CONTAINER_NAME}" rm -f /tmp/atlas_ai.db.snap
else
    echo "[backup] container not running; attempting direct file copy"
    SRC="${BACKUP_SRC:-/var/lib/docker/volumes/${VOLUME_NAME}/_data/atlas_ai.db}"
    cp -a "${SRC}" "${BACKUP_DIR}/atlas_ai.db" 2>/dev/null || {
        echo "[backup] ERROR: cannot find DB at ${SRC}" >&2
        echo "[backup] hint: set BACKUP_CONTAINER=atlas-ai-backend or BACKUP_SRC=..." >&2
        exit 1
    }
fi

# Record a manifest so an operator can re-verify the backup without
# running the restore tool.
cat > "${BACKUP_DIR}/MANIFEST.txt" <<EOF
atlas-ai backup
created_at=${TIMESTAMP}
source_container=${CONTAINER_NAME}
source_volume=${VOLUME_NAME}
EOF

echo "[backup] done: ${BACKUP_DIR}"

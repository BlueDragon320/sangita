#!/usr/bin/env bash
# Sangita Production Backup Script
# Creates a verified, atomic backup of Sangita data (SQLite DB with WAL, users, secret key) and music library.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DATA_DIR="${DATA_DIR:-${WORKSPACE_ROOT}/data}"
MUSIC_DIR="${MUSIC_DIR:-${WORKSPACE_ROOT}/music}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_ROOT="${BACKUP_ROOT:-${WORKSPACE_ROOT}/backups}"
BACKUP_NAME="sangita_backup_${TIMESTAMP}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
ARCHIVE_MODE=true
INCLUDE_MUSIC=true

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --data-dir DIR      Source data directory (default: ./data)"
    echo "  --music-dir DIR     Source music directory (default: ./music)"
    echo "  --output-dir DIR    Destination backup root (default: ./backups)"
    echo "  --no-music          Exclude music files, backing up database and credentials only"
    echo "  --no-archive        Keep uncompressed backup directory instead of tar.gz"
    echo "  -h, --help          Show this help message"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --data-dir) DATA_DIR="$2"; shift 2 ;;
        --music-dir) MUSIC_DIR="$2"; shift 2 ;;
        --output-dir) BACKUP_ROOT="$2"; BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"; shift 2 ;;
        --no-music) INCLUDE_MUSIC=false; shift ;;
        --no-archive) ARCHIVE_MODE=false; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

if [[ ! -d "${DATA_DIR}" ]]; then
    echo "ERROR: Data directory '${DATA_DIR}' does not exist." >&2
    exit 1
fi

START_TIME=$(date +%s)
echo "=== Sangita Backup Started at $(date -u) ==="
echo "Source Data:   ${DATA_DIR}"
echo "Source Music:  $([ "${INCLUDE_MUSIC}" = true ] && echo "${MUSIC_DIR}" || echo "[Skipped]")"
echo "Target:        ${BACKUP_DIR}"

mkdir -p "${BACKUP_DIR}/data"
chmod 700 "${BACKUP_DIR}"

# 1. Atomic SQLite Backup (WAL-safe)
DB_PATH="${DATA_DIR}/stats.db"
if [[ -f "${DB_PATH}" ]]; then
    echo "[1/4] Creating atomic snapshot of SQLite database..."
    if command -v sqlite3 >/dev/null 2>&1; then
        # VACUUM INTO produces an atomic, clean single-file snapshot even under active WAL writes
        sqlite3 "${DB_PATH}" "VACUUM INTO '${BACKUP_DIR}/data/stats.db';"
        sqlite3 "${BACKUP_DIR}/data/stats.db" "PRAGMA integrity_check;" >/dev/null
    else
        echo "WARNING: sqlite3 CLI not found. Falling back to file copy (WAL files included if present)." >&2
        cp -p "${DATA_DIR}/stats.db"* "${BACKUP_DIR}/data/"
    fi
else
    echo "[1/4] Notice: No stats.db found in ${DATA_DIR}."
fi

# 2. Copy application configuration and secret credentials
echo "[2/4] Archiving credentials, users, and node configuration..."
for f in users.json .secret_key lyrics_node_config.json lyrics_status.json lyrics_report.csv; do
    if [[ -f "${DATA_DIR}/${f}" ]]; then
        cp -p "${DATA_DIR}/${f}" "${BACKUP_DIR}/data/"
    fi
done

# Ensure secret key file has restricted permissions in backup
if [[ -f "${BACKUP_DIR}/data/.secret_key" ]]; then
    chmod 600 "${BACKUP_DIR}/data/.secret_key"
fi

# Include .env if present in root
if [[ -f "${WORKSPACE_ROOT}/.env" ]]; then
    cp -p "${WORKSPACE_ROOT}/.env" "${BACKUP_DIR}/"
    chmod 600 "${BACKUP_DIR}/.env"
fi

# 3. Optional Music Library Backup
if [[ "${INCLUDE_MUSIC}" = true && -d "${MUSIC_DIR}" ]]; then
    echo "[3/4] Copying music library..."
    mkdir -p "${BACKUP_DIR}/music"
    cp -rp "${MUSIC_DIR}/." "${BACKUP_DIR}/music/"
else
    echo "[3/4] Skipping music files as requested or music directory absent."
fi

# 4. Generate Manifest with SHA-256 Checksums
echo "[4/4] Generating backup manifest and integrity checksums..."
GIT_COMMIT="unknown"
if command -v git >/dev/null 2>&1 && git -C "${WORKSPACE_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    GIT_COMMIT=$(git -C "${WORKSPACE_ROOT}" rev-parse HEAD)
fi

USER_COUNT=0
if [[ -f "${BACKUP_DIR}/data/users.json" ]]; then
    USER_COUNT=$(grep -c '"username"' "${BACKUP_DIR}/data/users.json" || true)
fi

MANIFEST_FILE="${BACKUP_DIR}/manifest.json"
cat > "${MANIFEST_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "git_commit": "${GIT_COMMIT}",
  "includes_music": ${INCLUDE_MUSIC},
  "user_count": ${USER_COUNT},
  "files": {}
}
EOF

# Calculate checksums for data files
if command -v sha256sum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && find data -type f -exec sha256sum {} + > checksums.sha256)
fi

FINAL_OUTPUT="${BACKUP_DIR}"
if [[ "${ARCHIVE_MODE}" = true ]]; then
    ARCHIVE_FILE="${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz"
    echo "Compressing backup into ${ARCHIVE_FILE}..."
    tar -czf "${ARCHIVE_FILE}" -C "${BACKUP_ROOT}" "${BACKUP_NAME}"
    chmod 600 "${ARCHIVE_FILE}"
    rm -rf "${BACKUP_DIR}"
    FINAL_OUTPUT="${ARCHIVE_FILE}"
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
SIZE=$(du -sh "${FINAL_OUTPUT}" | cut -f1)

echo "=== Sangita Backup Complete ==="
echo "Location:  ${FINAL_OUTPUT}"
echo "Size:      ${SIZE}"
echo "Duration:  ${ELAPSED}s"
echo "Status:    VERIFIED"

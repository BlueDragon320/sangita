#!/usr/bin/env bash
# Sangita Production Restore Script
# Restores Sangita configuration, SQLite database, credentials, and music library from verified backup.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_SOURCE=""
TARGET_DIR="${WORKSPACE_ROOT}"
RESTORE_MUSIC=true
DRY_RUN=false

usage() {
    echo "Usage: $0 --backup <backup-file.tar.gz or dir> [options]"
    echo ""
    echo "Options:"
    echo "  --backup PATH       Path to .tar.gz archive or extracted backup directory (required)"
    echo "  --target DIR        Destination installation root (default: current workspace)"
    echo "  --no-music          Do not restore music files even if present in backup"
    echo "  --dry-run           Verify backup integrity without modifying target files"
    echo "  -h, --help          Show this help message"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup) BACKUP_SOURCE="$2"; shift 2 ;;
        --target) TARGET_DIR="$2"; shift 2 ;;
        --no-music) RESTORE_MUSIC=false; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

if [[ -z "${BACKUP_SOURCE}" ]]; then
    echo "ERROR: --backup PATH is required." >&2
    usage
fi

if [[ ! -e "${BACKUP_SOURCE}" ]]; then
    echo "ERROR: Backup source '${BACKUP_SOURCE}' does not exist." >&2
    exit 1
fi

START_TIME=$(date +%s)
echo "=== Sangita Restore Started at $(date -u) ==="
echo "Source:  ${BACKUP_SOURCE}"
echo "Target:  ${TARGET_DIR}"
echo "Dry Run: ${DRY_RUN}"

TMP_EXTRACT=""
CLEANUP_TMP=false
SRC_DIR="${BACKUP_SOURCE}"

if [[ -f "${BACKUP_SOURCE}" && "${BACKUP_SOURCE}" =~ \.tar\.gz$ ]]; then
    TMP_EXTRACT=$(mktemp -d -t sangita_restore_XXXXXX)
    CLEANUP_TMP=true
    echo "Extracting archive to temporary directory..."
    tar -xzf "${BACKUP_SOURCE}" -C "${TMP_EXTRACT}"
    # Identify extracted root folder
    EXTRACTED_SUBDIR=$(find "${TMP_EXTRACT}" -mindepth 1 -maxdepth 1 -type d | head -n 1)
    if [[ -n "${EXTRACTED_SUBDIR}" ]]; then
        SRC_DIR="${EXTRACTED_SUBDIR}"
    else
        SRC_DIR="${TMP_EXTRACT}"
    fi
fi

cleanup() {
    if [[ "${CLEANUP_TMP}" = true && -d "${TMP_EXTRACT}" ]]; then
        rm -rf "${TMP_EXTRACT}"
    fi
}
trap cleanup EXIT

# 1. Verify Manifest and Checksums
echo "[1/4] Verifying backup integrity..."
if [[ -f "${SRC_DIR}/manifest.json" ]]; then
    echo "Manifest found: $(cat "${SRC_DIR}/manifest.json")"
else
    echo "WARNING: manifest.json missing in backup directory."
fi

if [[ -f "${SRC_DIR}/checksums.sha256" ]] && command -v sha256sum >/dev/null 2>&1; then
    echo "Checking file checksums..."
    (cd "${SRC_DIR}" && sha256sum --check --status checksums.sha256) || {
        echo "ERROR: Backup checksum verification failed! Files may be corrupt." >&2
        exit 1
    }
    echo "Checksums verified successfully."
fi

# 2. Database Pre-check
if [[ -f "${SRC_DIR}/data/stats.db" ]] && command -v sqlite3 >/dev/null 2>&1; then
    INTEGRITY=$(sqlite3 "${SRC_DIR}/data/stats.db" "PRAGMA integrity_check;")
    if [[ "${INTEGRITY}" != "ok" ]]; then
        echo "ERROR: Backup SQLite database integrity check failed: ${INTEGRITY}" >&2
        exit 1
    fi
    echo "Database integrity check: OK"
fi

if [[ "${DRY_RUN}" = true ]]; then
    echo "Dry-run complete. Backup is valid. No changes made to ${TARGET_DIR}."
    exit 0
fi

# 3. Restore Data Directory
echo "[2/4] Restoring data directory..."
mkdir -p "${TARGET_DIR}/data"
chmod 755 "${TARGET_DIR}/data"

# Copy all files from backup data
if [[ -d "${SRC_DIR}/data" ]]; then
    cp -rp "${SRC_DIR}/data/." "${TARGET_DIR}/data/"
fi

# Restore .env if present in backup and not already in target
if [[ -f "${SRC_DIR}/.env" && ! -f "${TARGET_DIR}/.env" ]]; then
    cp -p "${SRC_DIR}/.env" "${TARGET_DIR}/.env"
    chmod 600 "${TARGET_DIR}/.env"
fi

# Strict security permissions for sensitive files
if [[ -f "${TARGET_DIR}/data/.secret_key" ]]; then
    chmod 600 "${TARGET_DIR}/data/.secret_key"
    echo "Permissions for .secret_key set to 0600 (owner only)."
fi

# 4. Restore Music Library
if [[ "${RESTORE_MUSIC}" = true && -d "${SRC_DIR}/music" ]]; then
    echo "[3/4] Restoring music library..."
    mkdir -p "${TARGET_DIR}/music"
    cp -rp "${SRC_DIR}/music/." "${TARGET_DIR}/music/"
else
    echo "[3/4] Skipping music restoration."
fi

# 5. Verification of Restored Target
echo "[4/4] Verifying restored installation..."
if [[ -f "${TARGET_DIR}/data/stats.db" ]] && command -v sqlite3 >/dev/null 2>&1; then
    TARGET_INTEGRITY=$(sqlite3 "${TARGET_DIR}/data/stats.db" "PRAGMA integrity_check;")
    if [[ "${TARGET_INTEGRITY}" != "ok" ]]; then
        echo "ERROR: Restored database integrity verification failed: ${TARGET_INTEGRITY}" >&2
        exit 1
    fi
    USER_ROW_COUNT=$(sqlite3 "${TARGET_DIR}/data/stats.db" "SELECT count(*) FROM user_totals;" 2>/dev/null || echo "0")
    echo "Restored database verified. user_totals count: ${USER_ROW_COUNT}"
fi

if [[ -f "${TARGET_DIR}/data/users.json" ]]; then
    echo "users.json restored successfully."
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "=== Sangita Restore Completed in ${ELAPSED}s ==="
echo "Target: ${TARGET_DIR}"
echo "Status: READY"

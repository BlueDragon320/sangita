#!/usr/bin/env bash
# Automated end-to-end verification of backup and restore scripts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TEST_ROOT=$(mktemp -d -t sangita_test_bkp_XXXXXX)
trap 'rm -rf "${TEST_ROOT}"' EXIT

SRC_ENV="${TEST_ROOT}/source_env"
RESTORE_ENV="${TEST_ROOT}/restore_env"
BACKUP_STORE="${TEST_ROOT}/backups"

mkdir -p "${SRC_ENV}/data" "${SRC_ENV}/music" "${RESTORE_ENV}" "${BACKUP_STORE}"

echo "1. Creating mock source environment in ${SRC_ENV}..."
# Create test secret key
echo "super_secret_test_key_32_bytes_long_here" > "${SRC_ENV}/data/.secret_key"
chmod 600 "${SRC_ENV}/data/.secret_key"

# Create mock users.json
cat > "${SRC_ENV}/data/users.json" << 'EOF'
{
  "testuser": {
    "username": "testuser",
    "password_hash": "dummyhash",
    "role": "user",
    "rules": {"allowed_playlists": ["*"]}
  }
}
EOF

# Create mock SQLite database with WAL mode and test records
sqlite3 "${SRC_ENV}/data/stats.db" << 'EOF'
PRAGMA journal_mode=wal;
CREATE TABLE user_totals (username TEXT PRIMARY KEY, total_seconds INTEGER, total_bytes INTEGER);
INSERT INTO user_totals VALUES ('testuser', 12345, 987654);
CREATE TABLE playlists (id TEXT PRIMARY KEY, name TEXT);
INSERT INTO playlists VALUES ('pl-1', 'Road Trip Classics');
EOF

# Add a mock track
echo "ID3_dummy_audio_bytes" > "${SRC_ENV}/music/test_song.mp3"

echo "2. Running backup script..."
"${WORKSPACE_ROOT}/scripts/backup.sh" \
    --data-dir "${SRC_ENV}/data" \
    --music-dir "${SRC_ENV}/music" \
    --output-dir "${BACKUP_STORE}"

BACKUP_ARCHIVE=$(find "${BACKUP_STORE}" -name "*.tar.gz" | head -n 1)
if [[ -z "${BACKUP_ARCHIVE}" || ! -f "${BACKUP_ARCHIVE}" ]]; then
    echo "ERROR: Backup archive was not created." >&2
    exit 1
fi
echo "Backup archive created: ${BACKUP_ARCHIVE}"

echo "3. Running restore dry-run..."
"${WORKSPACE_ROOT}/scripts/restore.sh" \
    --backup "${BACKUP_ARCHIVE}" \
    --target "${RESTORE_ENV}" \
    --dry-run

echo "4. Running full restore into ${RESTORE_ENV}..."
"${WORKSPACE_ROOT}/scripts/restore.sh" \
    --backup "${BACKUP_ARCHIVE}" \
    --target "${RESTORE_ENV}"

echo "5. Verifying restored data..."
# Verify .secret_key content and permissions
if [[ ! -f "${RESTORE_ENV}/data/.secret_key" ]]; then
    echo "ERROR: .secret_key not restored!" >&2
    exit 1
fi
SECRET_PERMS=$(stat -c "%a" "${RESTORE_ENV}/data/.secret_key")
if [[ "${SECRET_PERMS}" != "600" ]]; then
    echo "ERROR: .secret_key permissions are ${SECRET_PERMS}, expected 600!" >&2
    exit 1
fi

# Verify users.json
if ! grep -q '"testuser"' "${RESTORE_ENV}/data/users.json"; then
    echo "ERROR: users.json testuser missing!" >&2
    exit 1
fi

# Verify SQLite DB records
RECORD_COUNT=$(sqlite3 "${RESTORE_ENV}/data/stats.db" "SELECT count(*) FROM user_totals WHERE username='testuser';")
if [[ "${RECORD_COUNT}" -ne 1 ]]; then
    echo "ERROR: Database record count is ${RECORD_COUNT}, expected 1!" >&2
    exit 1
fi

# Verify music file
if [[ ! -f "${RESTORE_ENV}/music/test_song.mp3" ]]; then
    echo "ERROR: Music file was not restored!" >&2
    exit 1
fi

echo "=== Backup & Restore Verification Succeeded 100% ==="

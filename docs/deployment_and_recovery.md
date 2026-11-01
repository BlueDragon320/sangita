# Sangita Deployment, Operations, and Disaster Recovery Guide

## 1. System Topology & Architecture

Sangita consists of four coordinated containerized microservices behind a high-performance Nginx reverse proxy:

```
                  +-----------------------------------+
                  |   Client (Browser / Android App)  |
                  +-----------------+-----------------+
                                    |
                            (Port 5000 / HTTPS)
                                    v
                          +-------------------+
                          |    nginx:alpine   | (Reverse Proxy & Static Router)
                          +---------+---------+
                                    |
          +-------------------------+-------------------------+
          | (HTTP API & Assets)                               | (/socket.io/ & /sync/ WS)
          v                                                   v
+--------------------+                              +--------------------+
|  sangita-backend   |                              |  sangita-sync-svr  |
|  (Flask/Gunicorn)  |                              |   (Node.js / WS)   |
+---------+----------+                              +---------+----------+
          |                                                   |
          |                                                   v
          |                                         +--------------------+
          |                                         |    Redis Cache     |
          |                                         |  (PubSub & Handoff)|
          |                                         +--------------------+
          v
  Persistent Volumes:
  - `data/`  (SQLite stats.db, users.json, .secret_key, node config)
  - `music/` (Read-only audio catalog: mp3, flac, m4a, opus)
```

### Optional GPU Worker
- **Local PC Lyrics API**: Runs directly on a workstation with GPU acceleration (`faster-whisper`, CUDA 12) for automated offline audio-to-lrc transcription. Connected via token-authenticated LAN HTTP.

---

## 2. Persistent Volumes & Disk Requirements

| Volume Path | Host Mount | Purpose | Storage Characteristics |
|---|---|---|---|
| `/app/data` | `./data` | User credentials, SQLite (`stats.db`), signing keys, node configs | Low latency SSD; ~10 MB - 100 MB depending on log retention |
| `/app/music` | `./music` | Local audio catalog organized by folders/playlists | Storage volume; scales with library size (typically 10 GB - 1 TB) |
| `/data` (Redis) | `./redis-data` | Redis AOF append-only log for cross-device sync | Fast disk; ~10 MB |

---

## 3. Secrets Management & Rotation

### Secrets
1. **`SECRET_KEY`**: 32+ byte cryptographic random secret used for:
   - Signing and validating user JWT authentication tokens.
   - Synchronizing authentication between `sangita-backend` and `sangita-sync-server`.
   - Stored in `./data/.secret_key` with strict `0600` permissions.
2. **`SANGITA_PASS`**: Master password for initial administrator bootstrapping. Never committed to version control.

### Safe Secret Key Rotation Procedure
1. Generate a new cryptographically secure 64-character hex key:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))" > ./data/.secret_key.new
   chmod 600 ./data/.secret_key.new
   ```
2. Atomically replace `.secret_key`:
   ```bash
   mv ./data/.secret_key.new ./data/.secret_key
   ```
3. Update `.env` with the new value if mirrored:
   ```bash
   sed -i 's/^SECRET_KEY=.*/SECRET_KEY=<new_key>/' .env
   ```
4. Restart services gracefully:
   ```bash
   docker compose restart sangita sync-server
   ```
> [!NOTE]
> Rotating `SECRET_KEY` invalidates active user JWT sessions, requiring clients to re-authenticate. Existing passwords, playlists, favorites, and library metadata remain 100% unaffected.

---

## 4. Backup & Disaster Recovery Procedures

### Creating Backups
The automated backup script creates an atomic, WAL-consistent snapshot without stopping running services:

```bash
# Full backup (Database, credentials, configs, and music)
./scripts/backup.sh

# Data-only backup (Database, credentials, and configs - fast, lightweight)
./scripts/backup.sh --no-music --output-dir /var/backups/sangita
```

### Restoring Backups
```bash
# 1. Test restore without applying changes (dry run)
./scripts/restore.sh --backup /var/backups/sangita/sangita_backup_20261101.tar.gz --dry-run

# 2. Perform live restore to target directory
./scripts/restore.sh --backup /var/backups/sangita/sangita_backup_20261101.tar.gz --target /opt/sangita
```

### Verification After Restore
1. Verify SQLite integrity:
   ```bash
   sqlite3 ./data/stats.db "PRAGMA integrity_check;"
   ```
2. Check `.secret_key` permissions:
   ```bash
   ls -la ./data/.secret_key # Must be -rw------- (0600)
   ```
3. Restart containers and verify HTTP health:
   ```bash
   docker compose up -d
   curl -s http://localhost:5000/api/health
   ```

---

## 5. Account Recovery

If the admin password is lost:
1. Generate a replacement password hash using Python:
   ```bash
   python3 -c "import hashlib; print(hashlib.sha256('NewStrongPassword123'.encode()).hexdigest())"
   ```
2. Edit `./data/users.json` to update the admin hash:
   ```json
   "admin": {
     "username": "admin",
     "password_hash": "<generated_sha256_hash>",
     "role": "admin",
     "rules": {"allowed_playlists": ["*"]}
   }
   ```
3. Changes take effect immediately without restarting the backend.

---

## 6. Network Security & Local-Network Policy

- **Reverse Proxy**: Nginx terminates client requests on port 5000 (or HTTPS 443 with TLS certificates).
- **Public Traffic**: Should always be served over HTTPS when accessed beyond a trusted LAN.
- **Android App**: Enforces strict HTTPS for untrusted external domains while allowing trusted cleartext HTTP exclusively for local subnets (`192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, `10.0.2.2`, `localhost`).

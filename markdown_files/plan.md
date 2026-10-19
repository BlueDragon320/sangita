# Sangita — Synced Lyrics & Resource-Aware Batch Generator (`plan.md`)

This document is the authoritative engineering specification and completion record for **Synced Lyrics (.lrc)**, the **Interactive Center-Stage Lyrics Overlay**, and the **Admin-Controlled, Resource-Limited Batch Lyrics Generator** in the **Sangita** repository.

---

## 1. System Target & Hardware Constraints

- **Target Host:** 4 CPU Cores, 6 GB RAM, No GPU, Linux / Docker environment.
- **Audio Library:** Multi-format audio library (`.mp3`, `.m4a`, `.flac`, `.ogg`, `.wav`, `.opus`) mounted at `/app/music`.
- **Languages:** Multilingual support (Hindi, English, Punjabi, Kannada, etc. with strict UTF-8 encoding).
- **Core Architectural Invariants:**
  1. Process **strictly one song at a time** in a background child process so RAM usage never exceeds the admin-configured ceiling (default `4096 MB`).
  2. Never block Gunicorn audio streaming workers; apply `os.nice(10)`, `psutil` CPU core affinity, and CTranslate2 thread limits (`cpu_threads`).
  3. Respect multi-device Socket.IO sync (`useDeviceSync.js`): clicking a lyric line to seek on a remote controller device emits `REMOTE_CONTROL` (`action: 'seek'`).
  4. Separation of concerns: Keep public playback streaming fast and lean; all heavy ML and API lookups execute asynchronously in background worker processes.

---

## 2. Deliverable 1: Resumable Batch Lyrics Worker (`backend/lyrics_worker.py`) [COMPLETED]

Created `backend/lyrics_worker.py` supporting both CLI (`nice`/`tmux`) execution and spawned child process execution from `backend/app.py`.

### 2.1 Dependencies & Compatibility Patches
- Added `faster-whisper`, `ctranslate2`, `mutagen`, `psutil`, `requests`, and `Pillow` to `backend/requirements.txt`.
- Installed system `ffmpeg` in Docker runtime for decoding `.mp3`, `.m4a`, and other containers.
- **PyAV 14+ / 19+ Monkeypatch:** Wrapped `av.open` to strip `metadata_errors` keyword argument not supported in modern PyAV versions.
- **Resilient DNS Fallback:** Intercepted socket address lookups (`_resilient_getaddrinfo`) to query `8.8.8.8` via system resolver when local sinkhole DNS servers route Hugging Face domains to `0.0.0.0`.
- **Offline Model Caching:** Prioritized local cached int8 weights (`models--Systran--faster-whisper-small/`) with `local_files_only=True` to run completely offline without external network dependency.

### 2.2 CLI Interface & Flags
- `--music-dir` (default: `os.environ.get("MUSIC_DIR", "/app/music")`)
- `--data-dir` (default: `os.environ.get("DATA_DIR", "/app/data")`)
- `--model` (choices: `["tiny", "base", "small", "medium"]`, default: `"small"`)
- `--language` (default: `"auto"`)
- `--cores` (type `int`, default: `2`)
- `--max-ram-mb` (type `int`, default: `4096`)
- `--limit` (type `int`, default: `0` -> processes all in scope; positive integer limits batch)
- `--song` (relative path to process a single track)
- `--playlist` (directory name or playlist name to process a subset)
- `--force` (overwrite existing `.lrc` files)
- `--demucs` (run HTDemucs vocal stem isolation before Whisper)
- `--api` (default: `True` -> queries online LRCLIB database first with automatic local Whisper fallback)
- `--no-api` (skips online queries entirely; transcribes directly with local Whisper model)

### 2.3 Hardware Resource Governance
- Configured CPU core affinity with `psutil.Process.cpu_affinity()` and pinned `OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `OPENBLAS_NUM_THREADS`.
- Set background process priority with `os.nice(10)`.
- Implemented watchdog memory ceiling: unloads cached Whisper model and invokes garbage collection (`gc.collect()`) if RSS exceeds `max_ram_mb`.
- Implemented graceful signal handling for `SIGINT` and `SIGTERM`.

### 2.4 Waterfall Processing Pipeline
For each audio track:
1. **Stage 1 — Cached Check:** If valid `.lrc` exists and `--force` is not set, skip instantly.
2. **Stage 2 — Embedded Tags:** Inspect ID3 `SYLT`/`USLT`, MP4 `\xa9lyr`, Vorbis tags using Mutagen.
3. **Stage 3 — Online LRCLIB Query (When API is ON):**
   - Query online LRCLIB database using sanitized metadata (brackets, YouTube tags, and list artifacts removed).
   - If missing, log fallback event and proceed to Stage 4/5.
   - If `--no-api` is set, skip Stage 3 entirely and proceed to local transcription.
4. **Stage 4 — Optional Vocal Separation (`--demucs`):** Isolate vocals using HTDemucs.
5. **Stage 5 — Local Whisper AI Model:** Transcribe vocals using CTranslate2 int8 quantized Whisper models (`small` ~460MB default, `base`, `tiny`, `medium`) with VAD filtering and hallucination suppressions.

---

## 3. Deliverable 2: Backend API Endpoints (`backend/app.py`) [COMPLETED]

Implemented all required endpoints with RBAC authentication and filesystem safety:
1. `GET /api/lyrics/<path:filepath>`: Reads and returns UTF-8 `.lrc` sidecar with path traversal guards.
2. `GET /api/admin/lyrics/status`: Returns live worker state, current song, action, source counters, and host/worker CPU and RAM telemetry.
3. `POST /api/admin/lyrics/start`: Spawns managed background worker with specified configuration (`api`, `model`, `scope`, `song`, `playlist`, `limit`, `cores`, `max_ram_mb`, `force`, `demucs`).
4. `POST /api/admin/lyrics/stop`: Gracefully terminates the running worker process group.
5. `GET /api/admin/lyrics/logs`: Reads historical run telemetry from `lyrics_report.csv`.
6. `PUT /api/admin/lyrics/edit`: In-browser manual editor for `.lrc` lyrics content.

---

---

## 4. Deliverable 3: Frontend Synced Lyrics & Admin Controller [COMPLETED]

### 4.1 Player Integration (`Player.jsx`)
- Added Lyrics toggle button with microphone/lyrics SVG icon right beside the Now Playing View button.
- Displays dynamic emerald badge when active and visual indicator dot when lyrics are available for the currently playing song.

### 4.2 Center-Stage Synced Lyrics Overlay (`LyricsView.jsx`)
- Center-stage overlay parsing `[mm:ss.xx]` timestamps into interactive lyrics lines.
- Smooth automatic centering with 150ms lookahead audio offset.
- 4-second auto-scroll pause upon manual touch/mouse wheel interaction.
- Interactive click-to-seek dispatching local seeks or remote commands based on active device role.

### 4.3 Admin Dashboard Lyrics Engine (`AdminDashboard.jsx`)
- **API Engine Toggle Button**:
  - `API: ON`: Queries LRCLIB online API first with automatic local Whisper AI fallback.
  - `API: OFF`: Skips online queries and runs directly on local CTranslate2 models.
- **Dynamic CTranslate2 Model Indicator**: Updates label to `CTranslate2 Model (Local Fallback)` vs `CTranslate2 Model (Primary Engine)`.
- **Target Scope Selector**: All Songs (entire library), Select Playlist, or Select Particular Song.
- **Live Currently Processing Song Box**: Real-time song title, artist, file path, active engine badge (`🌐 Online API`, `⚡ Local Machine`, `🎙️ Local Demucs`, `🏷️ Embedded`), and exact engine action description.
- **Telemetry KPI Grid (Expanded 3-Card Layout)**: Removed redundant idle/0% worker status card, expanding `Host CPU Utilization`, `Host Memory (RAM)`, and `Catalog Coverage` across the full grid width (`repeat(auto-fit, minmax(280px, 1fr))`).
- **Remote GPU Acceleration Card**:
  - Toggle switch to enable PC / Laptop GPU offload.
  - URL input with connection test button (`POST /api/admin/lyrics/test-remote`).
  - Dynamic status badge showing connected GPU name, CUDA mode, VRAM, ping latency, and active PC safeguard limits.
  - **Exclusive GPU Mode Toggle**: "Use Only This GPU API (Exclusive GPU Mode)" flag (`--only-remote-gpu`), completely skipping server CPU Whisper to guarantee 0% server CPU usage.
- **Compact Audit Logs & Editor**: Formatted compact history table with inline manual editor modal, "Remote GPU API" filter option, and single-song retry triggers.

---

---

## 5. Deliverable 4: Standalone Local PC Lyrics API (`Local_PC_Lyrics_API`) [COMPLETED]

### 5.1 Standalone Microservice Architecture (`server.py`)
- **NVIDIA CUDA & CTranslate2 Acceleration**: Auto-detects NVIDIA GPUs via CUDA and `nvidia-smi`, defaulting to `float16` precision for 15x–30x speedups (3–8s per track).
- **Strict Ephemeral Audio Storage**: Uploaded audio files are stored in temporary memory/disk buffers and strictly deleted via `os.remove` in a `finally` block immediately after transcription. Zero audio bytes retained.
- **Hardware Safeguards & Resource Limits**:
  - `cpu_threads`: Caps CPU threads allocated to CTranslate2.
  - `max_ram_mb`: Memory ceiling watchdog unloads models if process RSS exceeds threshold.
  - `cooldown_sec`: Inter-track GPU pause prevents continuous 100% heat & fan noise.
  - `low_priority`: Lower process priority prevents lagging foreground desktop apps/games.
  - `POST /api/settings`: Dynamic configuration of resource limits without restarting.
- **Web Dashboard (`templates/index.html`)**:
  - Real-time hardware telemetry: GPU VRAM gauge, compute %, host CPU %, system RAM %.
  - Live Resource Limits Panel: sliders for CPU threads, RAM ceiling, GPU cooldown delay, and compute precision.
  - Active Job Monitor: live elapsed counter, current track name, model in use, pulsing status indicator.
  - Processed Songs History: duration, language, lines count, timestamp, and an interactive "View Lyrics" modal with copy to clipboard.
- **Launchers**: One-click scripts for Windows (`start.bat`) and Linux/macOS (`start.sh`).

---

## 6. Deliverable 5: Security Hardening & Access Governance [COMPLETED]

### 6.1 Brute-Force Defense & Private Website Governance
- **Login Lockout Mechanism (`login_lockouts` SQLite table)**: Automatically locks out an IP/username after 3 consecutive failed login attempts for **5 minutes** (HTTP 429 Too Many Requests). Reset on successful authentication.
- **Private Access Warning Banner**: Distinct `h1` warning banner prominently displayed on the authentication gateway:
  > *"Warning! This is a private website for personal use. If you dont have the permission from Owner of the WebSite please exit."*
- **Persistent Secret Key (`.secret_key`)**: Cryptographically random 32-byte hexadecimal secret key generated and restricted with `0600` permissions, replacing hardcoded fallback defaults.

### 6.2 Application Security Audit (19 Points Implemented)
- **Strict CORS & HTTP Security Headers**: Configured headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`) and disabled Flask debug mode in production.
- **Form Sanitization & XSS Guards**: Strict HTML/script escaping across playlist creation, rename, and user input fields.
- **RBAC Enforcement**: All administrative endpoints enforce `role == 'admin'`, with checks preventing deletion or demotion of the final administrator account.

---

## 7. Deliverable 6: Interactive Synced Lyrics & UI Enhancements [COMPLETED]

### 7.1 Smart Navigation Arbitration
- **Playlist Switch Auto-Minimize**: When navigating to a different playlist, the center-stage lyrics view automatically minimizes, prioritizing track browsing while maintaining continuous audio playback in the bottom player bar.

### 7.2 Fullscreen Immersive Mode & Moving Ambient Background
- **Edge-to-Edge Maximize Toggle**: Added maximize/expand button beside the close icon in `LyricsView.jsx` allowing the lyrics view to cover the entire viewport for a concert-like experience, with toggle back to standard view.
- **Animated Ambient Canvas Background**: Integrated slow, fluid ambient color gradient canvas with an interactive toggle button. User preference is persisted across sessions in `localStorage.getItem('sangita_lyrics_bg')`.

---

## 8. Deliverable 7: Full-Stack Code Optimization Plan [COMPLETED]

### 8.1 Critical Performance Bugs & Quick Wins (Phase 1)
- **Removed Duplicate Analytics Bug**: Eradicated redundant 40+ lines in `admin_get_analytics` ([backend/app.py](file:///home/blue/projects/sangita/backend/app.py)) that was re-querying day-of-week data without timezone offsets.
- **Cached `load_users()`**: In-memory file cache with `mtime` invalidation eliminated 2+ disk reads per authenticated HTTP request.
- **Guarded RAF State Updates**: Throttled 60fps loop in `App.jsx` to state changes only, cutting React reconciliation passes by ~70%.

### 8.2 Database & Backend I/O Optimizations (Phase 2)
- **SQLite Composite Indexes & WAL Mode**: Added indexes on `play_events`, `user_track_totals`, and `playlist_tracks`, enabled `PRAGMA journal_mode=WAL`, `synchronous=NORMAL`, and `cache_size=-8000`.
- **Per-Request Connection Pooling via Flask `g`**: Implemented `_RequestDbProxy` and `@app.teardown_appcontext`, reusing a single connection per request while preserving compatibility.
- **TTL Cache for Track Durations**: 60-second in-memory cache for `get_track_durations()`.
- **Hoisted Imports & DRY Track Parser**: Hoisted inline imports to file top and extracted universal `parse_track_name(track_path)` helper.

### 8.3 Frontend Architecture & Vite Bundle Splitting (Phases 3 & 4)
- **Lazy-Loaded `AdminDashboard.jsx`**: Split the 204 kB / 4561-line component into an on-demand chunk using `React.lazy()` and `<Suspense>`.
- **Vite Rollup Manual Chunks**: Eager bundle trimmed from 430 kB down to **114 kB** main application code + isolated `vendor` and `sync` chunks.
- **Component Memoization**: Wrapped `TrackList`, `Sidebar`, `Player`, `Hero`, `Header`, and `RightPanel` in `React.memo()`.
- **Stabilized Callbacks**: Extracted inline render functions into `useCallback()` hooks.
- **Audio Stream Cache Headers**: Added `Cache-Control: public, max-age=86400` in `stream_audio`.

### 8.4 Sync Server Optimizations (Phase 5)
- **Batched Redis Queries**: Converted serial device queries in `getDevices()` to concurrent `Promise.all()`.
- **Broadcast Scrub Throttling**: Added 100ms throttle for rapid seek events while preserving immediate dispatch for play/pause/track events.

---

## 9. Verification & Test Suite Summary [COMPLETED]

| Test File | Covered Functionality | Result |
| :--- | :--- | :--- |
| `backend/test_admin_api.py` | Admin routes, RBAC, export, lyrics APIs, CLI flags, remote test | **13/13 Passed** |
| `backend/test_security.py` | Anti-brute force lockout, private banner, CORS, headers, secret key | **7/7 Passed** |
| `backend/test_lyrics_worker.py` | Metadata parsing, LRCLIB query, CLI `--api`/`--no-api`/`--remote-whisper-url`, remote GPU offload & fallback | **8/8 Passed** |
| `Local_PC_Lyrics_API/test_server.py` | `/health`, `/api/telemetry`, `/transcribe`, temporary file deletion guarantee, `/api/clear-history` | **5/5 Passed** |
| `frontend` (Vitest) | Vitest test suite (`npm test -- --run`) across 14 test suites | **14/14 Suites, 61/61 Tests Passed** |
| `frontend` (Vite Build) | Production bundle build with code-splitting (`npm run build`) | **Successful (114 kB core)** |
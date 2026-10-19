# Sangita — Technical Skills & Capabilities Inventory

This document provides an exhaustive, line-by-line engineering inventory of all skills, technologies, algorithms, protocols, and architectural patterns implemented across the **Sangita** codebase.

---

## 1. System Overview & Technology Stack Taxonomy

Sangita is a production-grade, self-hosted, multi-device music streaming, synced lyrics, and telemetry ecosystem. It bridges low-latency real-time synchronization, embedded audio parsing, AI vocal transcription, high-performance web audio streaming, and deep analytical capabilities.

| Domain | Core Technologies & Libraries | Primary Files |
| :--- | :--- | :--- |
| **Frontend Application** | React 18, Vite 5, JavaScript (ESM), Vanilla CSS3, Socket.IO Client | `frontend/src/*` |
| **Media & REST API Server** | Python 3.11, Flask 3.0, Gunicorn 21, Mutagen 1.48, Pillow 12.3, SQLite3 | `backend/app.py` |
| **AI Lyrics & Resource Engine** | `faster-whisper` (CTranslate2 `int8`), `psutil`, LRCLIB REST API, Optional `demucs` | `backend/lyrics_worker.py` |
| **Local PC Lyrics API & GPU Node** | Flask 3.0, `faster-whisper` (CUDA `float16`), `psutil`, `nvidia-smi` | `Local_PC_Lyrics_API/*` |
| **Real-time Sync Engine** | Node.js 20, Express 4.18, Socket.IO 4.7, ioredis 5.3, Native Crypto | `sync-server/server.js` |
| **Data & Cache Storage** | SQLite 3 (`stats.db`), Redis 7 Alpine (`sangita-redis`), JSON (`users.json`), CSV (`lyrics_report.csv`) | `/app/data/*`, `redis-data/*` |
| **Reverse Proxy & Gateway** | Nginx Alpine (HTTP/1.1 WebSockets, conditional proxies) | `nginx.conf` |
| **Orchestration & DevOps**| Docker Multi-stage Builds, Docker Compose v2, Cloudflare Tunnel | `Dockerfile`, `docker-compose.yml` |
| **Testing Frameworks** | Vitest 4.1, Testing Library (React/DOM), pytest 9.0, Python `unittest` | `frontend/src/test/*`, `backend/test_*.py`, `Local_PC_Lyrics_API/test_server.py` |

---

## 2. Frontend Engineering Skills (`frontend/src/`)

### 2.1 React 18 Component & State Architecture
- **Zero Heavy State Frameworks:** Implements global application state using pure React primitives (`useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`) combined with custom hooks, avoiding Redux/Zustand overhead.
- **Code-Splitting & Lazy Loading:**
  - Employs `React.lazy()` and `<Suspense>` to load the heavy administrative console (`AdminDashboard.jsx`, 204 kB) solely when requested, keeping regular customer playback initial bundles under **114 kB**.
  - Configures Vite Rollup `manualChunks` isolating `vendor` (`react`, `react-dom`) and `sync` (`socket.io-client`) for optimal long-term HTTP caching.
- **Render Optimization & Memoization:**
  - Wraps performance-critical leaf components (`TrackList`, `Sidebar`, `Player`, `Hero`, `Header`, `RightPanel`) in `React.memo()`.
  - All top-level action handlers (`handleSidebarSelect`, `handleToggleSidebar`, `handleOpenDevices`, `handleCloseDevices`, `handleOpenMobileMenu`, `handleToggleLyrics`, `handleToggleRightPanel`, `handleSearchChange`) are stabilized via `useCallback()`, ensuring child component props remain referentially identical across renders.
  - High-frequency playback scrubber driven via `requestAnimationFrame` (`rafRef`) in `App.jsx`, guarded by threshold delta checks (>0.05s for time, >0.1s for duration), reducing React reconciliation passes by ~70%.
  - Real-time catalog search results memoized via `useMemo` to eliminate repeated O(N) playlist sweeps during re-renders.
  - O(1) indexed `currentTrack` evaluation fast-path with queue reference comparison avoiding expensive array searches.
  - Device info classification (browser, OS, device type) computed statically at module load, eliminating redundant regex parsing inside periodic 10-second stats intervals.
- **View Hierarchy & Routing:**
  - Custom browser history routing using `window.history.pushState` and `window.history.replaceState` synchronized with `popstate` event listeners.
  - Granular view management: `'home'` (Personalized Dashboard), `'music'` (Playlist & Track Library), `'search'` (Real-time Full-catalog Search), `'admin'` (System & Telemetry Console), plus the toggleable Center-Stage `LyricsView` overlay.

### 2.2 Audio Management & HTML5 Audio API
- **Non-blocking Audio Streaming:**
  - Manages native `<audio>` element with `preload="auto"`.
  - Token-authenticated audio URI stream binding (`/api/stream/<path>?token=<token>`).
  - Seamless handling of playback interruptions, media end triggers (`ended`), and metadata readiness (`loadedmetadata`, `canplay`).
- **Autoplay Restriction Handling & User Gesture Unlock:**
  - Implements browser autoplay mitigation in `useDeviceSync.js` (`transferPlayback`) and `App.jsx`: executes a muted `audio.play().then(...).catch(...)` warmup during active device claims to unlock the browser AudioContext without throwing DOMExceptions.
- **Media Session API Integration:**
  - Hardware media key and lockscreen synchronization via `navigator.mediaSession`:
    - Action handlers: `'play'`, `'pause'`, `'previoustrack'`, `'nexttrack'`, `'seekto'`, `'seekbackward'`, `'seekforward'`.
    - Dynamic metadata publication (`MediaMetadata` with title, artist, album).
    - Continuous position state updates via `navigator.mediaSession.setPositionState({ duration, playbackRate, position })`.

### 2.3 Real-Time Multi-Device Synchronization Hook (`useDeviceSync.js`)
- **Device Fingerprinting:**
  - Generates RFC-compliant UUIDv4 device identifiers stored in `sessionStorage` (`getOrCreateDeviceId`).
  - User-Agent sniffing for device classification (`detectDeviceType`: mobile, tablet, desktop) and browser/platform tagging (`detectDeviceName`).
- **Dual-Transport WebSockets:**
  - Establishes connection via `socket.io-client` with fallback transports `['websocket', 'polling']`.
  - Implements automatic reconnection routines (10 attempts, 2000ms delay).
  - 25-second heartbeat loop (`HEARTBEAT`) maintaining Redis device registration leases.
- **Real-Time Position Interpolation:**
  - Active device periodically dispatches 1-second position reports (`POSITION_REPORT`).
  - Remote listening devices dynamically calculate time drift:
    $$\Delta t = \text{Date.now()} - \text{syncState.updatedAt}$$
    $$t_{\text{current}} = \min(t_{\text{target}} + \Delta t, t_{\text{duration}})$$
    providing buttery smooth scrubbing without network floods.
- **Remote RPC Control:**
  - Remote devices emit `REMOTE_CONTROL` packets containing commands (`play`, `pause`, `next`, `prev`, `seek`, `volume`, `loop`, `shuffle`, `play_track`).
  - Target active device executes instructions via matching ref-bound handlers.

### 2.4 SVG Data Visualization & Custom Charts
- **Pure SVG Graphic Synthesis:**
  - Custom mathematical curve plotting in `ListeningGraph.jsx`: converts discrete temporal points into cubic Bézier SVG paths (`M ... C ...`) with gradient area fills (`defs -> linearGradient`).
  - Automatic dynamic scale normalization: calculates optimal y-axis limits (15m, 30m, 60m, 120m, or multiples of 60m) and generates horizontal grid lines with text anchors.
  - Interactive hover vertical tracking lines and floating tooltips.
- **Diurnal Heatmaps & Bar Graphs:**
  - 24-hour diurnal listening distribution and 7-day weekday bars in `AdminDashboard.jsx`.
  - Dynamic HSL color generation (`strHue`) for deterministic playlist and track avatar themes.

### 2.5 Real-Time LRC Parsing & Interactive Center-Stage Lyrics (`LyricsView.jsx`)
- **Multi-Timestamp LRC Parser:** Regex state machine parsing `[mm:ss.xx]` and `[mm:ss.xxx]` timestamps with full Unicode/UTF-8 script support (Devanagari, Gurmukhi, Kannada, Latin).
- **Lookahead Time Matching & Scroll Arbitration:**
  - Matches active lines with a `+150ms` perceptual offset driven by the `<audio>` element's `timeupdate` / interpolated clock.
  - Smoothly centers the active line (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) while temporarily yielding auto-scroll control for `4000ms` upon detecting manual user wheel or touch scroll events.
  - Interactive click-to-seek on any lyric line with seamless support for both local playback and Socket.IO remote control.
- **Edge-to-Edge Fullscreen Mode:**
  - Integrated maximize toggle button expanding lyrics overlay across the entire display window, with toggle back to standard view.
- **Animated Ambient Gradient Canvas:**
  - Dynamic, slow-moving undulating color mesh background with user toggle button; state preserved across visits via `localStorage.getItem('sangita_lyrics_bg')`.
- **Navigation Minimization:**
  - Automatically minimizes lyrics overlay when navigating to a different playlist, ensuring library browsing is fluid without cutting off playback.

---

## 3. Backend & Media Engineering Skills (`backend/`)

### 3.1 Python 3.11 & Flask 3.0 Architecture
- **Stateless RESTful API:** Built on Flask with Gunicorn WSGI workers, designed for high-concurrency streaming and asynchronous telemetry ingestion.
- **Security & Authentication Subsystem:**
  - Custom cryptographic HMAC-SHA256 session tokens (`_make_token` / `_verify_token`).
  - URL-safe base64 encoding (`base64.urlsafe_b64encode`) of token payload `{ "u": username, "exp": timestamp }`.
  - Constant-time verification using `hmac.compare_digest` to prevent timing attacks.
  - Persistent cryptographic secret key stored at `DATA_DIR/.secret_key` with strict `0600` file permissions.
  - Route guards using Python decorators (`@require_auth`, `@require_admin`) binding user identity and role directly to the Flask request context `g`.
  - **Anti-Brute Force Protection:** Dedicated `login_lockouts` SQLite table tracks failed attempts by `ip:username`. 3 consecutive failures trigger an automatic 5-minute lockout (HTTP 429 Too Many Requests).
  - **In-Memory IP Rate Limiting:** Sliding-window rate limiting (`check_rate_limit`) guarding sensitive auth and search endpoints against abuse.
  - **Security Headers & CORS Defense:** Automatic response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`) and strict origin whitelisting.
  - **Path Traversal Guards:** Resolves and validates all audio, cover, and lyrics filepaths via `werkzeug.security.safe_join` and normalized relative path checks.
- **Role-Based Access Control (RBAC):**
  - Granular playlist filtering: verifies each stream and lyrics request against `rules["allowed_playlists"]`.
  - Administrator protection safeguards: prevents deleting or demoting the last remaining admin account.

### 3.2 Audio Metadata Extraction & Mutagen Engine
- **Universal Multi-format Audio Metadata Extraction:**
  - Uses `mutagen.File` across `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.opus`.
  - Resolves track durations down to 0.1s precision.
  - High-performance SQLite track metadata caching (`track_cache` table) comparing file modification times (`os.path.getmtime`) to avoid expensive re-parsing on repeated API calls.
  - Hoisted top-level mutagen and Pillow imports eliminating per-request `sys.modules` overhead.
  - Single-source DRY helper `parse_track_name(track_path)` unifying artist and track title resolution.
- **Embedded Cover Art & Lyrics Extraction:**
  - ID3 tags (`APIC` frames for cover art, `USLT`/`SYLT` frames for embedded lyrics in MP3).
  - Vorbis comments (`metadata_block_picture` and `LYRICS` for Ogg/Opus/FLAC).
  - MP4 container atom structures (`covr` atoms for artwork, `©lyr` atoms for embedded lyrics in M4A).
  - Local directory fallback discovery (`cover.jpg`, `cover.png`, `folder.jpg`, `album.jpg`, and sidecar `<track>.lrc`).

### 3.3 Computer Vision & Automated Image Processing (Pillow)
- **Advanced Letterbox & Canvas Border Truncation (`process_cover_image`):**
  - Solves the YouTube 500x500 letterboxed canvas problem.
  - Uses `ImageStat.Stat` to inspect standard deviation of pixels in the top and bottom 15% slices of the image.
  - Color difference calculations via `ImageChops.difference` against candidate background colors (white, black, corner pixel samples).
  - Dynamic threshold filtering (`diff.point(lambda p: 255 if p > 15 else 0)`).
  - Bounding box auto-cropping (`diff.getbbox()`) followed by aspect ratio squaring (1:1 center crop).
  - High-efficiency JPEG compression (`quality=95`) and PNG export for alpha channels.
  - HTTP cache control headers (`Cache-Control: public, max-age=604800, immutable`).

### 3.4 SQLite Database Engineering & Analytics Engine
- **High-Performance Database Engine & Pragmas:**
  - SQLite database (`stats.db`) with `sqlite3.Row` factory.
  - **Write-Ahead Logging (WAL Mode):** `PRAGMA journal_mode=WAL` decouples concurrent readers from writers, eliminating lock contention during telemetry ingestion.
  - **Page Cache & Synchronous Tuning:** `PRAGMA synchronous=NORMAL` and `PRAGMA cache_size=-8000` (8MB memory cache) maximizing read throughput.
  - **Composite B-Tree Indexes:**
    - `idx_play_events_user_ts (username, timestamp DESC)` for fast time-range queries.
    - `idx_play_events_user_device (username, device_id, id DESC)` for fast device history.
    - `idx_user_track_totals_user (username, total_seconds DESC)` for instant leaderboard sorting.
    - `idx_playlist_tracks_user_playlist (username, playlist_name)` for custom playlist resolution.
  - **Per-Request Connection Pooling (`_RequestDbProxy`):** Reuses a single SQLite connection per HTTP request via Flask `g` with automatic cleanup in `@app.teardown_appcontext`.
- **In-Memory Caching Subsystems:**
  - `load_users()` / `save_users()` in-memory dictionary caching with filesystem `mtime` invalidation, eliminating redundant JSON file reads on authenticated requests.
  - `get_track_durations()` 60-second TTL cache avoiding repeated library filesystem walks.
  - Resolved duplicate analytics calculation bug in `admin_get_analytics`.
- **High-Throughput Telemetry Writes (`/api/stats/ping`):**
  - Upsert semantics (`INSERT ... ON CONFLICT(username) DO UPDATE SET ...`).
  - Smart event deduplication: merges playback pings if the user and device continue listening to the same song within 120 seconds.
  - User rolling log maintenance: automatically truncates individual user audit trails to the latest 1,000 events (`DELETE FROM play_events WHERE id NOT IN (SELECT id ... LIMIT 1000)`).
- **Timezone-Aware Aggregation:**
  - Computes exact UTC offsets using Python 3.9+ `zoneinfo.ZoneInfo`.
  - Formats SQL interval strings (e.g., `+330 minutes` for Asia/Kolkata).
  - Converts stored UTC timestamps in SQLite via `datetime(timestamp, offset_sql)` for accurate hourly (`%Y-%m-%d %H`) and diurnal (`%H`, `%w`) grouping.
- **Streaming CSV Export & Audio Caching:**
  - Generates full audit logs on-the-fly (`/api/admin/export`) using Python `csv.writer` and `io.StringIO` streamed with `Content-Disposition: attachment`.
  - Audio streaming endpoint sets `Cache-Control: public, max-age=86400` enabling client browser audio caching.

### 3.5 AI Audio Transcription, API Orchestration & Hardware Governance (`backend/lyrics_worker.py`)
- **Dual-Mode Engine Orchestration:**
  - **API: ON Mode (`--api`)**: Queries online LRCLIB database first; if lyrics are missing or unavailable, automatically falls back to Remote GPU or local machine Whisper AI.
  - **API: OFF Mode (`--no-api`)**: Bypasses external network calls completely; runs direct local machine or Remote GPU transcription via CTranslate2.
- **6-Stage Lyrics Waterfall:**
  1. Skip if sidecar `.lrc` already exists (resume-safe, overridable with `--force`).
  2. Embedded tag inspection (`mutagen` ID3 `USLT`/`SYLT`, MP4 `©lyr`, Vorbis `LYRICS`).
  3. `LRCLIB` REST API lookup (`/api/get` & `/api/search` fallback with `±3s` duration tolerance) when API is ON.
  4. Optional `demucs` vocal stem isolation before Whisper.
  5. Remote GPU Whisper offload (`Local_PC_Lyrics_API` via `--remote-whisper-url`) for high-speed CUDA `float16` execution.
  6. Exclusive GPU safeguard (`--only-remote-gpu`): skips local server CPU Whisper to guarantee 0% server CPU usage if the remote GPU node is offline or fails.
  7. Local server `faster-whisper` (`int8` quantized CPU inference) utilizing cached weights if remote GPU is not configured and exclusive mode is off.
- **PyAV 14+ / 19+ Keyword Incompatibility Wrapper:**
  - Transparent monkeypatch (`_patched_av_open`) popping `metadata_errors` before invoking PyAV `_orig_av_open`, enabling seamless execution across Python 3.11, 3.12, 3.13, and 3.14.
- **DNS Resilience & Offline Hugging Face Fallback:**
  - Intercepts socket address resolution (`_resilient_getaddrinfo`) to query `8.8.8.8` via system resolver when local sinkhole DNS servers route `huggingface.co` to `0.0.0.0`.
  - Prioritizes offline cached models (`models--Systran--faster-whisper-small/`) with `local_files_only=True`.
- **Whisper Hallucination Mitigation:** Disables `condition_on_previous_text`, enforces Silero VAD (`vad_filter=True`, `min_silence_duration_ms=500`), filters high compression-ratio loops (`> 2.4`), strips known training watermark phrases, clamps long-silence drift, and collapses consecutive duplicate lines.
- **Process-Level Hardware Isolation (`psutil`):**
  - Lowers OS scheduling priority via `os.nice(10)`.
  - Enforces CPU core pinning (`psutil.Process.cpu_affinity`) and thread limits (`OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `cpu_threads`).
  - Monitors RSS memory footprint against admin-defined `max_ram_mb` thresholds, unloading CTranslate2 weights and invoking garbage collection if memory pressure exceeds limits.
  - Exposes real-time host and worker telemetry (`CPU %`, per-core load, `RAM MB`, job ETA, currently processing song, engine action, and source counters) to `AdminDashboard.jsx`.

### 3.6 Local PC GPU Acceleration & Microservice Skills (`Local_PC_Lyrics_API/`)
- **NVIDIA CUDA & CTranslate2 Float16 Acceleration:**
  - Queries `ctranslate2.get_cuda_device_count()` and parses `nvidia-smi` to dynamically select CUDA acceleration, achieving **3–8 second** transcription speeds per song.
- **Strict Ephemeral Audio Storage Lifecycle:**
  - Saves uploaded audio stream to a secure named temporary file.
  - Passes file to CTranslate2 engine.
  - Implements unconditional deletion in a `finally` block: `os.remove(temp_path)`, guaranteeing zero leftover audio retention on disk.
- **Hardware Telemetry Instrumentation:**
  - Real-time sampling of NVIDIA GPU name, driver version, total/used VRAM, GPU compute %, CPU %, and RAM % via `psutil` and `nvidia-smi`.
- **Single-Page Glassmorphic Telemetry Dashboard:**
  - Dark-mode responsive web interface served directly via Flask templates.
  - 1.5-second polling loop feeding live VRAM bars, active song progress, and a historical song table with an interactive `.lrc` lyrics modal viewer.

---

## 4. Real-Time Distributed Sync Engineering (`sync-server/`)

### 4.1 Node.js & Socket.IO Real-time Architecture
- **Room-Based Message Distribution:**
  - Isolated user rooms: `socket.join("user:${userId}")` ensures multi-device sync packets never leak across different accounts.
  - Token handshake authentication (`io.use`) validating HMAC signatures via Node's native `crypto.createHmac`.

### 4.2 Redis Cache Management & Resilient In-Memory Fallback
- **Distributed Key-Value Patterns:**
  - Device Lease Key: `sangita:device:<userId>:<deviceId>` with TTL = 30 seconds.
  - User Device Set: `sangita:devices:<userId>` maintaining all active socket connections.
  - Playback State Key: `sangita:state:<userId>` holding master player state.
- **Concurrent Batch Fetching (`Promise.all`):**
  - `getDevices(userId)` executes parallel `redis.get` calls across all registered device IDs via `Promise.all`, reducing serialized latency from O(N) down to a single concurrent batch roundtrip.
- **Dual-Mode Redis Wrapper (`RedisClientWrapper`):**
  - Primary driver: `ioredis` with immediate fail-fast retry strategy (`retryStrategy: () => null`).
  - Seamless zero-downtime fallback to `MemoryRedis` if the Redis container is unreachable or offline:
    - Implements in-memory `Map` stores for keys and sets.
    - Accurate TTL eviction via unref'd `setTimeout`.
    - Set operations: `sadd`, `srem`, `smembers`.

### 4.3 Playback State Arbitration & Handover Protocol
- **Active Device Election:**
  - When a device disconnects, the sync server arbitrates the new master: transfers playback to the first remaining online device or transitions state to paused.
  - Seamless handover (`TRANSFER_PLAYBACK`):
    - Captures origin position (`positionMs`) and duration.
    - If originating device was actively playing, compensates for transit latency:
      $$P_{\text{new}} = P_{\text{old}} + (\text{now} - \text{updatedAt})$$
    - Re-targets `activeDeviceId` and broadcasts atomic `PLAYBACK_STATE_CHANGED` to all sockets in the user room.
- **Broadcast Scrub Throttling:**
  - Throttles high-frequency playback position updates (`PLAYBACK_STATE_CHANGED`) to a maximum of 10 broadcasts/second (100ms window) during user scrub/drag operations, eliminating WebSocket connection saturation while keeping immediate dispatch for play, pause, and track skip events.

---

## 5. DevOps, Infrastructure & Systems Architecture

### 5.1 Docker Multi-Stage Builds
- **Optimized Multi-stage Containerization (`Dockerfile`):**
  - Stage 1: `node:20-alpine AS builder` installs npm packages and compiles production Vite assets into `/app/frontend/dist`.
  - Stage 2: `python:3.11-slim` runtime installs dependencies (`Flask`, `gunicorn`, `mutagen`, `Pillow`, `faster-whisper`, `psutil`, `requests`, `ffmpeg`), copies pre-compiled frontend assets into `./static`, and executes Gunicorn with 2 workers.
  - Total container footprint minimized by omitting Node runtime from the final image.

### 5.2 Microservice Orchestration (`docker-compose.yml`)
- Multi-container topology:
  1. `sangita-redis`: `redis:7-alpine` with Append-Only File (`AOF`) persistence and container healthchecks (`redis-cli ping`).
  2. `sangita-backend`: Python Flask + Gunicorn core application mounting `./music` and `./data`.
  3. `sangita-sync-server`: Node 20 microservice executing real-time WebSocket sync.
  4. `sangita-proxy`: Nginx Alpine gateway container on port 5000:80.
  5. `sangita-tunnel`: Optional Cloudflare Tunnel (`cloudflared`) allowing public ingress without port-forwarding.

### 5.3 Gateway & Reverse Proxy Engineering (`nginx.conf`)
- **Protocol Switching & Proxying:**
  - Directs `/socket.io/` to `http://sync-server:3001` with explicit HTTP/1.1 upgrade headers (`Upgrade $http_upgrade`, `Connection "upgrade"`).
  - Directs `/` and `/api/` to `http://sangita:5000`.
  - Preserves client IP addresses through `X-Real-IP` and `X-Forwarded-For`.

---

## 6. Testing, Quality Assurance & Verification

### 6.1 Frontend Integration & Unit Testing (Vitest + JSDOM)
- Comprehensive test coverage across all components in `frontend/src/test/` (**14 test suites, 61 unit and integration tests passing**):
  - `App.test.jsx`: Complete integration test verifying authentication gate, view routing, lyrics toggle, and dashboard rendering.
  - `AdminDashboard.test.jsx`: Validates tab switching (including Lyrics Engine), timeframe controls, KPI renders, user creation modals, and timezone updates.
  - `Player.test.jsx`, `LyricsView.test.jsx`, `TrackList.test.jsx`, `Hero.test.jsx`, `Sidebar.test.jsx`, `DevicePanel.test.jsx`, `ListeningGraph.test.jsx`, `RightPanel.test.jsx`, `HomeDashboard.test.jsx`, `AddToPlaylistModal.test.jsx`, `CreatePlaylistModal.test.jsx`.

### 6.2 Backend Integration Testing (pytest)
- Automated verification across 28 unit and integration tests (`PYTHONPATH=. pytest backend`):
  - `backend/test_admin_api.py` (13 tests): Tests authentication boundaries (401 Unauthorized, 403 Forbidden), analytics engine across all timeframes (`24h`, `7d`, `30d`, `90d`, `all`), lyrics sidecar serving, job control endpoints, timezone queries (`Asia/Kolkata` vs `UTC`), user management CRUD operations, and streaming CSV generation.
  - `backend/test_security.py` (7 tests): Validates anti-brute force lockout after 3 failed attempts, private access warning banner enforcement, HTTP security headers, CORS origin protection, persistent secret key generation, and rate limiting.
  - `backend/test_lyrics_worker.py` (8 tests): Validates metadata sanitization, online LRCLIB queries, local Whisper fallback, CLI `--api` / `--no-api` flags, and Remote GPU offload with exclusive mode safeguards.

### 6.3 Local PC Lyrics API Unit Testing (Python unittest)
- Unit tests in `Local_PC_Lyrics_API/test_server.py` (5 tests):
  - Validates `/health` check and GPU detection reporting.
  - Verifies `/api/telemetry` hardware stats streaming.
  - Guarantees strict ephemeral audio file deletion (`os.remove`) after `/transcribe`.
  - Verifies `/api/clear-history` and resource limit settings configuration.
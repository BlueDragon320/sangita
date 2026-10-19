# Sangita — Autonomous Agent Guide & Operational Playbook

This document is the authoritative engineering manual and operational playbook for autonomous AI agents, coding assistants, and human developers working on the **Sangita** repository.

---

## 1. Agent Mandate & Behavioral Invariants

When working within this repository, all agents must adhere to the following non-negotiable invariants:

### 1.1 Storefront Cleanliness & Separation of Concerns
- **Professional Retail Experience:** The music player UI must remain uncluttered, aesthetic, and responsive. Diagnostic artifacts, raw system logs, and debugging widgets must never be dumped onto customer-facing views (`HomeDashboard`, `Hero`, `TrackList`, `Player`, `LyricsView`).
- **Architectural Boundary:** Administrative, batch lyrics generation, and telemetry operations belong strictly within `AdminDashboard.jsx` and `/api/admin/*`. Core playback endpoints (`/api/stream`, `/api/playlists`, `/api/cover`, `/api/lyrics`) must remain lean and unburdened by analytics or synchronous ML/network overhead.

### 1.2 Concurrency & Parallel Execution
- Decompose complex multi-file features into concurrent streams of development (e.g., modifying backend SQLite models/workers and frontend React components simultaneously).
- Run test suites and build validations (`npm test`, `python -m unittest`) concurrently whenever feasible.

### 1.3 State Synchronization Contract
- Never introduce unilateral playback state changes on remote controllers without dispatching `REMOTE_CONTROL` Socket.IO events to the designated `activeDeviceId`.
- Always respect the `activeDeviceId` arbitration logic governed by `sync-server/server.js`.
- Clicking a synced lyric line in `LyricsView.jsx` to seek must check `isActiveDevice`: if acting as a remote controller, dispatch `sendRemoteControl({ action: 'seek', payload: { positionMs: seconds * 1000 } })`.

---

## 2. Codebase Inventory & Component Map

```
sangita/
├── README.md                  # Comprehensive root documentation, setup guide, and architectural overview
├── backend/
│   ├── app.py                 # Core Flask application, media streaming, auth, Pillow covers, SQLite telemetry, lyrics APIs
│   ├── lyrics_worker.py       # Resumable CLI & background worker (Mutagen -> LRCLIB [optional] -> Remote GPU -> faster-whisper int8)
│   ├── requirements.txt       # Python dependencies: Flask, gunicorn, mutagen, Pillow, faster-whisper, psutil, requests
│   ├── test_admin_api.py      # Unit tests for authentication, analytics, export, lyrics APIs, and CLI flag dispatch
│   └── test_lyrics_worker.py  # Unit tests for metadata sanitization, LRCLIB querying, and CLI flag parsing
├── Local_PC_Lyrics_API/       # Standalone GPU acceleration microservice & local web dashboard
│   ├── server.py              # Flask GPU service with CUDA auto-detect & auto-purge
│   ├── templates/             # Live hardware telemetry & lyrics viewer dashboard
│   ├── start.bat              # One-click Windows launcher
│   ├── start.sh               # One-click Linux/Mac launcher
│   ├── test_server.py         # Unit tests for local API
│   └── requirements.txt
├── sync-server/
│   ├── server.js              # Real-time WebSocket server, Socket.IO rooms, Redis wrapper & MemoryRedis fallback
│   ├── package.json           # Node dependencies: express, socket.io, ioredis, cors
│   └── .env.example           # Synchronization server environment configuration
├── frontend/
│   ├── index.html             # HTML5 entrypoint, Inter font preconnects, music note favicon
│   ├── vite.config.js         # Vite configuration with proxy rules (/api -> :5000, /socket.io -> :3001)
│   ├── package.json           # Frontend dependencies: React 18, socket.io-client, Vitest, Testing Library
│   └── src/
│       ├── main.jsx           # React DOM mounting
│       ├── App.jsx            # Application orchestrator, audio element binding, lyrics state, keyboard shortcuts, MediaSession API
│       ├── index.css          # Custom design system, Dark/Light modes, animations, responsive layouts, lyrics styles
│       ├── hooks/
│       │   └── useDeviceSync.js # Multi-device synchronization hook, WebSockets, heartbeats, drift compensation
│       ├── components/
│       │   ├── Header.jsx             # Top search bar, view switcher, theme toggle, device counter, user profile
│       │   ├── Sidebar.jsx            # Collapsible library navigation, filter chips (Playlists/Artists), mini-search
│       │   ├── Hero.jsx               # Playlist banner, 4-quad collage cover art, play/shuffle/download actions
│       │   ├── TrackList.jsx          # Spotify-styled song table, animated equalizer bars, inline actions
│       │   ├── Player.jsx             # Persistent bottom audio controls, scrub slider, volume, Lyrics toggle button, Now Playing toggle
│       │   ├── LyricsView.jsx         # Center-stage synced .lrc overlay, 150ms lookahead highlight, smooth auto-scroll, click-to-seek
│       │   ├── RightPanel.jsx         # Collapsible Now Playing side-panel, high-res art, audio format pill
│       │   ├── HomeDashboard.jsx      # Personalized dashboard, greeting, quick actions, Top 10 songs, recent tracks
│       │   ├── ListeningGraph.jsx     # Pure SVG activity chart, cubic Bézier curves, 24h/7d/custom timeframe filters
│       │   ├── AdminDashboard.jsx     # 6-tab admin console: Overview, Catalog, Stream Logs, Users, Lyrics Engine, System
│       │   ├── DevicePanel.jsx        # Modal device switcher for multi-device playback transfer
│       │   ├── Login.jsx              # High-contrast authentication gateway
│       │   ├── CreatePlaylistModal.jsx# Custom user playlist generator
│       │   └── AddToPlaylistModal.jsx # Inline playlist and favorites track assignment modal
│       └── test/                      # Test suites covering components and integration flows
├── Dockerfile                 # Multi-stage production container build (Node builder -> Python runtime with ffmpeg)
├── docker-compose.yml         # Container topology: redis, sangita, sync-server, proxy, optional tunnel
└── nginx.conf                 # Gateway reverse proxy with WebSocket upgrade support
```

---

## 3. Core Development & Extension Workflows

### 3.1 Adding a New Backend REST Endpoint
1. Open `backend/app.py`.
2. Choose the appropriate security decorator:
   - `@require_auth`: Standard authenticated user route (`g.username`, `g.user`).
   - `@require_admin`: Administrative route (validates `g.user["role"] == "admin"`).
3. Obtain a database connection using `conn = get_db()`, execute queries, and ensure `conn.close()` is in a `finally:` block.
4. If writing time-series queries, always respect timezone offsets via `get_tz_from_request()`.
5. Add unit test assertions in `backend/test_admin_api.py`.

---

### 3.2 Extending Real-Time Synchronization Commands
When adding a new command (e.g., `set_speed` or `mute`):
1. **Frontend Dispatch:** Update `sendRemoteControl` in `frontend/src/hooks/useDeviceSync.js`:
   ```javascript
   sendRemoteControl({ action: 'set_speed', payload: { rate: 1.5 } });
   ```
2. **Server Routing:** `sync-server/server.js` intercepts `REMOTE_CONTROL` and emits `REMOTE_COMMAND` directly to the active device socket.
3. **Active Device Execution:** Add the action handler inside `handleRemoteCommand` in `frontend/src/App.jsx`.

---

### 3.3 Synced Lyrics & Resource Governance Invariants
1. **Storefront Separation:** `GET /api/lyrics/<path:filepath>` must only read existing sidecar `.lrc` files on disk. Never trigger synchronous `faster-whisper` inference or `LRCLIB` network calls inside a customer playback request.
2. **Remote Control Seeking Contract:** When a user clicks a lyric line inside `LyricsView.jsx` to seek (`onSeek(seconds)`), `App.jsx` must check `isActiveDevice`. If operating as a remote controller, it MUST dispatch `sendRemoteControl({ action: 'seek', payload: { positionMs: seconds * 1000 } })` rather than mutating local audio state unilaterally.
3. **Worker Resource Ceiling:** Any modifications to `backend/lyrics_worker.py` must preserve `os.nice(10)`, `psutil.Process.cpu_affinity`, `OMP_NUM_THREADS`, and the `max_ram_mb` watchdog check so live Gunicorn audio streams never stutter on a 4-core / 6 GB RAM host.
4. **Dual Engine Mode (API Toggle):**
   - The worker must support `--api` (default) and `--no-api`.
   - When `--no-api` is passed, skip all external network requests to LRCLIB and transcribe directly using local CTranslate2 models.
   - When `--api` is passed, query LRCLIB first; if lyrics are missing, automatically fall back to local models.
5. **Exclusive GPU Safeguard (`--only-remote-gpu`):**
   - When `--only-remote-gpu` is passed, the worker offloads strictly to the Remote GPU node. If the remote GPU is offline or fails, it skips local server CPU Whisper completely to guarantee 0% server CPU inference load.

---

### 3.4 Security & Hardening Standards
1. **Brute Force Lockout**: Any login flow modifications must route through `_check_login_lockout(key)` and `_record_login_failure(key)` in `backend/app.py`. Ensure IP and username lockouts persist in `login_lockouts` table with a 5-minute cooldown.
2. **Private Warning Notice**: Preserve the private site warning `h1` banner in `frontend/src/components/Login.jsx` to maintain explicit unauthorized access disclaimers.
3. **CORS & Response Headers**: All API endpoints must send hardened headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`). Never enable `DEBUG = True` in production.
4. **Persistent Cryptographic Keys**: Secret keys must be loaded from `DATA_DIR/.secret_key` with strict `0600` file permissions if not provided in the environment.

---

### 3.5 Performance & State Management Standards
1. **Per-Request Database Pooling**: Always obtain SQLite connections via `conn = get_db()`. Inside Flask request context, `get_db()` returns a `_RequestDbProxy` that makes explicit `.close()` calls safe no-ops, automatically closing the underlying connection on `@app.teardown_appcontext`.
2. **In-Memory Caching**: Always check `_users_cache` in `load_users()` and `_durations_cache` in `get_track_durations()` with `mtime` / TTL invalidation instead of performing repeated disk I/O.
3. **Component Memoization & Callback Stability**: Wrap complex leaf components (`TrackList`, `Sidebar`, `Player`, `Hero`, `Header`, `RightPanel`) with `React.memo()`. Always pass stable callback references wrapped with `useCallback()` from parent containers to prevent unnecessary child re-renders.
4. **Guarded High-Frequency Loops**: In `requestAnimationFrame` loops, guard `setState` calls by checking value deltas (e.g. `> 0.05s` for time, `> 0.1s` for duration) so React reconciliation runs only on actual changes.
5. **Code Splitting & Bundle Limits**: Heavy administrative interfaces (such as `AdminDashboard.jsx`) must be dynamically imported using `React.lazy()` and `<Suspense>` so regular retail streaming bundles stay under **120 kB**.

---

## 4. Critical Edge Cases & Implementation Gotchas

### 4.1 PyAV 14+ / 19+ Keyword Incompatibility
In PyAV versions 14 and newer, `av.open` rejects the legacy `metadata_errors` keyword argument previously passed by some media decoders.
- **The Fix:** `backend/lyrics_worker.py` implements a transparent wrapper monkeypatch (`_patched_av_open`) that pops `metadata_errors` from `kwargs` before invoking `_orig_av_open`.

### 4.2 Network DNS Sinkhole Bypass for Hugging Face Models
Certain local network DNS resolvers sinkhole `huggingface.co` to `0.0.0.0` or `::`.
- **The Fix:** `backend/lyrics_worker.py` implements `_resilient_getaddrinfo` which falls back to querying Google DNS (`8.8.8.8`) via `dig` if the local resolver returns `0.0.0.0`. In addition, cached local weights (`models--Systran--faster-whisper-small`) are loaded with `local_files_only=True` to run completely offline without relying on internet connectivity.

### 4.3 Browser Audio Autoplay Policy & The Warmup Trick
Modern mobile and desktop browsers block audio elements from calling `.play()` without a preceding user gesture.
- **The Fix:** In `frontend/src/hooks/useDeviceSync.js`, inside `transferPlayback(targetDeviceId)`, when a device claims active status via a click, it executes an immediate muted warmup (`audio.muted = true; audio.play().then(...).catch(...)`).

### 4.4 Filesystem Directory Traversal Defenses
Whenever accepting user-supplied track paths (`/api/stream/<path>`, `/api/cover/<path>`, `/api/lyrics/<path>`):
- Always decode and normalize: `os.path.normpath(urllib.parse.unquote(filepath))`.
- Reject any path starting with `..` or `/` immediately with HTTP 403 Forbidden.

---

## 5. Verification & Testing Checklist

Before completing any task on this codebase, agents must execute the following validation steps:

```bash
# 1. Run Python Backend Unit Tests
PYTHONPATH=. pytest backend

# 2. Run Local PC Lyrics API Unit Tests
python3 -m unittest Local_PC_Lyrics_API/test_server.py

# 3. Run Frontend Test Suites
cd frontend && npm test -- --run

# 4. Validate Frontend Production Build & Code-Splitting
cd frontend && npm run build

# 5. Verify Docker Compose Configuration Validity
docker compose config
```

### Key Functional Checks:
1. **Playback Functionality:** Start playback of a song, seek halfway, change volume, and verify that the timeline scrubber updates smoothly.
2. **Synced Lyrics Overlay:** Click the Lyrics button in the bottom player bar; verify the center region transitions to `LyricsView`, highlights the active line in sync with audio, auto-scrolls smoothly, seeks when a line is clicked, and returns to normal view when toggled off.
3. **Admin Lyrics Engine & API Toggle:**
   - In `AdminDashboard -> Lyrics Engine`, verify the **API** button toggles between `API: ON` and `API: OFF`.
   - Verify CTranslate2 Model label dynamically indicates whether it acts as the `(Local Fallback)` or `(Primary Engine)`.
   - Verify starting a run updates the live **Currently Processing Song** box and displays appropriate engine source badges (`🌐 Online API`, `⚡ Local Machine`, `⚡ Remote GPU`).
4. **Local PC Lyrics API & Remote GPU Offload:**
   - Launch `./Local_PC_Lyrics_API/start.sh` (or `start.bat`); verify dashboard loads on `http://localhost:8000` showing GPU VRAM and CPU/RAM telemetry.
   - In `AdminDashboard -> Lyrics Engine`, enable 'Remote GPU Acceleration', test connectivity with `POST /api/admin/lyrics/test-remote`, and verify live status indicator turns green with GPU name and ping latency.
5. **Device Discovery:** Open two tabs/browsers with the same credentials; ensure both devices appear in the Device Panel and switching playback between them works seamlessly.
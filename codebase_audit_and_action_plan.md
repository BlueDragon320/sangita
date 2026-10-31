# Sangita Full Codebase Audit & Action Plan

**Date**: 2026-10-31  
**Scope**: 
- `sangita` repository (`backend/`, `sync-server/`, `frontend/`)
- `sangita-android-app` repository (`app/src/main/...`)

---

## Executive Summary

A comprehensive, end-to-end multi-agent audit was conducted across both the Sangita web/backend repository and the native Android application repository. The audit evaluated:
1. **API Security & Database Concurrency** (Flask Backend & SQLite `stats.db`)
2. **Real-time Protocol & State Synchronization** (Socket.IO `sync-server`)
3. **Web Client Architecture & Reactive Performance** (React Frontend)
4. **Android Native Media Lifecycle, Navigation & Concurrency** (Jetpack Compose & Media3 ExoPlayer)

Below is the structured list of all identified issues, their architectural root causes, and the concrete implementation plan to resolve them.

---

## 1. Backend & Database Engine (`backend/app.py`, `stats.db`)

### [P0] B1. IP Spoofing & Loopback Authentication Bypass via `X-Forwarded-For`
- **Location**: `backend/app.py:782-785`, `1080-1093`
- **Issue**: `_get_client_ip()` blindly trusts the incoming HTTP `X-Forwarded-For` header. In `_is_authorized_node_or_admin()`, any client sending `X-Forwarded-For: 127.0.0.1` or `localhost` is granted admin/node access without a token, bypassing authentication on internal endpoints. Furthermore, attackers can rotate spoofed IPs to bypass the 5-minute login lockout in `_check_login_lockout()`.
- **Root Cause**: Reliance on spoofable client headers rather than socket peer address (`request.remote_addr`).
- **Fix**: In `_is_authorized_node_or_admin()`, strictly verify socket peer `request.remote_addr in ("127.0.0.1", "::1")`. In `_get_client_ip()`, only trust `X-Forwarded-For` if `request.remote_addr` originates from a configured reverse proxy or localhost.

### [P0] B2. Write Transactions Inside Read Endpoint (`GET /api/v2/playlists`)
- **Location**: `backend/app.py:2254-2268`
- **Issue**: Every `GET /api/v2/playlists` request executes `INSERT INTO playlists ... ON CONFLICT` and calls `conn.commit()`. Under concurrent traffic, read requests acquire an exclusive SQLite write lock, causing lock contention (`database is locked`) and high latency.
- **Root Cause**: Automatic folder playlist synchronization was coupled directly to playlist reads instead of catalog indexing.
- **Fix**: Move folder playlist reconciliation to catalog scan / startup tasks or guard with an in-memory dirty flag / cache check so `GET /api/v2/playlists` performs pure read operations.

### [P1] B3. SQLite Running in `DELETE` Journal Mode Without WAL or Busy Timeout
- **Location**: `backend/app.py:150-160`, `431`
- **Issue**: `PRAGMA journal_mode = WAL` was called inside `init_db()` while a transaction was implicitly opened by Python's `sqlite3`, causing SQLite to ignore the PRAGMA. As verified by `sqlite3 stats.db "PRAGMA journal_mode;"`, the database is currently running in legacy `delete` rollback mode. Furthermore, `foreign_keys` and `busy_timeout` are not configured on new connections.
- **Root Cause**: Python's `sqlite3.connect` starts implicit transactions unless `isolation_level = None`.
- **Fix**: Set `isolation_level = None` when executing WAL configuration during `init_db()`. In `get_db()`, configure `conn.execute("PRAGMA foreign_keys = ON;")` and `conn.execute("PRAGMA busy_timeout = 5000;")` on every connection.

### [P1] B4. Total Bandwidth Consumption Telemetry Reporting `0 B`
- **Location**: `backend/app.py:3330`, `3408`
- **Issue**: `get_current_user_stats()` queries `SELECT total_seconds FROM user_totals WHERE username = ?`, omitting `total_bytes`. On line 3408, it tests `"total_bytes" in row_tot.keys()`, which evaluates to `False`. As a result, `total_bytes` is permanently reported as `0 B` in user profile statistics.
- **Root Cause**: Missing `total_bytes` column in the SQL SELECT projection.
- **Fix**: Update query to `SELECT total_seconds, total_bytes FROM user_totals WHERE username = ?`.

### [P1] B5. Bandwidth Overcounting on HTTP 206 Partial Content Audio Streaming
- **Location**: `backend/app.py:3727-3740`
- **Issue**: For HTTP Range requests (seeking or streaming chunks), `resp.content_length` may not be set prior to response generation. Line 3734 falls back to `bytes_count = os.path.getsize(full_path)`. Seeking 10 times in a 30MB track records 300MB of consumed user bandwidth and increments `stream_requests` 10 times.
- **Root Cause**: Fallback to full file size on partial byte-range requests.
- **Fix**: Compute byte count from `request.range` (e.g. `range_end - range_start + 1`) when present, and only increment `stream_requests` when `request.range` starts at byte 0 or is absent.

### [P2] B6. Audio Streaming MIME Types for Modern Formats
- **Location**: `backend/app.py:3720-3735`
- **Issue**: Common audio extensions (`.opus`, `.flac`, `.m4a`) can default to `application/octet-stream` on Linux servers with minimal `mime.types`.
- **Fix**: Register explicit MIME mapping for `.opus` -> `audio/ogg; codecs=opus`, `.flac` -> `audio/flac`, `.m4a` -> `audio/mp4`.

---

## 2. Real-time Device Sync Server (`sync-server/server.js`)

### [P0] S1. Reconnected Sockets Wiped by Stale Disconnect Events
- **Location**: `sync-server/server.js:492-501`
- **Issue**: In `socket.on('disconnect')`, `userDevs.delete(deviceId)` is called unconditionally. If a device reconnects under poor mobile connectivity, registers its new socket ID, and seconds later the previous dead socket finishes timing out and fires `disconnect`, the active registered device is deleted from memory.
- **Root Cause**: Lack of socket ID ownership verification during disconnect cleanup.
- **Fix**: Verify `if (userDevs.get(deviceId)?.socketId === socket.id) { userDevs.delete(deviceId); }`.

### [P1] S2. Dead Device In-Memory Accumulation (Missing TTL Reaper)
- **Location**: `sync-server/server.js:227-251`
- **Issue**: `DEVICE_TTL` constant is defined, but `inMemoryDevices` is a pure JavaScript Map without a background sweeper. Devices that disconnect abruptly without an explicit TCP FIN or browser unload remain in memory until server restart.
- **Root Cause**: No active TTL reaping interval for in-memory registry.
- **Fix**: Add a 30-second `setInterval` to prune devices whose `Date.now() - dev.lastSeen > 90000` and socket connection is missing, notifying `DEVICE_LIST_UPDATED` when stale devices expire.

### [P2] S3. Missing Remote Volume Command Handling & Normalization
- **Location**: `sync-server/server.js:465-491`
- **Issue**: Remote volume adjustments emitted from web/mobile should enforce clamped values `0.0 - 1.0` or `0 - 100` to prevent audio clipping or silent state mismatches across platforms.
- **Fix**: Add explicit validation and integer/float normalization in `REMOTE_COMMAND` handling.

---

## 3. Web Client Frontend (`frontend/src/`)

### [P0] F1. Sync Race Condition & Active Playback Snapping Back on Song Change
- **Location**: `frontend/src/App.jsx:1345-1369`, `frontend/src/hooks/useDeviceSync.js:236-244`
- **Issue**: When the web client is passive and user clicks a new song, `claimActiveDevice` falls back to the old remote track ID and does not set `forceClaim: true`. The server rejects or overwrites the playback state with the old track, causing playback to snap back to the remote song.
- **Root Cause**: Missing authoritative track ID parameter and `forceClaim: true` in local playback start while passive.
- **Fix**: Pass the explicit new `trackId` into `claimActiveDevice` and set `forceClaim: true` in `broadcastState` upon local user playback initiation.

### [P0] F2. Duplicate Clashing Effects on Device Transfer Handoff
- **Location**: `frontend/src/App.jsx:541-562`, `740-860`
- **Issue**: Two separate `useEffect` hooks listen to `syncState.isTransferHandoff`. Both invoke `audio.src = ...` and `audio.play()`, causing `AbortError: The play() request was interrupted by a new load request`.
- **Root Cause**: Split responsibility across duplicate handoff listeners.
- **Fix**: Consolidate playback handoff logic into a single authoritative handler that resets `isTransferHandoff` once audio loading commences.

### [P1] F3. 60Hz Re-render Storm & Broken SQLite Analytics Pings
- **Location**: `frontend/src/App.jsx:574-605`, `705-732`
- **Issue**: `currentTrack` is computed as an inline IIFE on every render. For non-queue tracks, it creates a new object reference every time `App` renders. In `App.jsx:732`, the 10-second stats ping effect depends on `currentTrack`. Because the object reference changes on every render/tick, the effect teardown `clearInterval(timer)` executes continuously, preventing the stats ping from ever firing.
- **Root Cause**: Missing memoization of `currentTrack`.
- **Fix**: Wrap `currentTrack` in `useMemo` with stable dependency primitives `[loadedTrackId, syncState?.trackId, currentIndex, queue, playlists]`.

### [P1] F4. Autoplay Policy User Gesture Unlock UI Missing
- **Location**: `frontend/src/components/Player.jsx:213-214`
- **Issue**: When a browser blocks background audio transfer, `requiresUserGesture` is set to `true`. `Player.jsx` receives the prop but renders no visual affordance or unlock pill. The user sees a frozen playback bar without knowing audio was blocked.
- **Root Cause**: Prop received in component signature but unrendered in JSX.
- **Fix**: Render an inline playback unlock pill/button in `Player.jsx` when `requiresUserGesture` is true, invoking `onUnlockWebAudio` on click.

### [P1] F5. Track List Play/Pause Button Restarts Song
- **Location**: `frontend/src/components/TrackList.jsx:256-265`
- **Issue**: Clicking the play/pause button on the currently playing track calls `onPlayTrack(track, idx)` instead of `onTogglePlay()`. This restarts the track from 0:00 rather than pausing it.
- **Root Cause**: Missing ternary check for active track state.
- **Fix**: In `onClick`: `if (isActive) onTogglePlay(); else onPlayTrack(track, idx);`.

### [P2] F6. Desktop Mouse Scrubbing Support & Socket Seek Throttling
- **Location**: `frontend/src/components/Player.jsx:51-177`
- **Issue**: The player scrubber only attaches touch event listeners, lacking mouse drag handlers for desktop browsers. Furthermore, drag gestures emit unthrottled seek commands on every micro-movement.
- **Fix**: Add unified mouse/touch drag handlers and emit remote seek commands only on gesture release (`onPointerUp` / `onTouchEnd`).

---

## 4. Android Native Application (`sangita-android-app`)

### [P0] A1. Fatal Crash on `%` and `+` Double URL Decoding in NavGraph
- **Location**: `app/src/main/java/com/sangita/app/ui/navigation/NavGraph.kt:340-342`, `373-375`
- **Issue**: Jetpack Compose Navigation automatically URL-decodes route parameters. `NavGraph.kt` calls `URLDecoder.decode(rawKey, "UTF-8")` a second time. When a playlist has `%` in the title (e.g. "Top 100% Hits"), Compose Navigation decodes `%25` to `%`. The second `URLDecoder.decode` throws `IllegalArgumentException: URLDecoder: Incomplete trailing escape (%) pattern` and crashes the app immediately. Similarly, `+` is decoded into a space, causing 404s.
- **Root Cause**: Redundant manual URL decoding of already decoded navigation arguments.
- **Fix**: Remove the second `URLDecoder.decode()` call; use `rawKey` directly.

### [P0] A2. Thread-Unsafe Color Cache Crashing `PlaylistDetailScreen`
- **Location**: `app/src/main/java/com/sangita/app/ui/screens/playlist/PlaylistDetailScreen.kt:110`, `159`, `201`
- **Issue**: `playlistDominantColorCache = mutableMapOf<String, Color>()` is a top-level unthread-safe HashMap. It is read on `Dispatchers.Main` and mutated across coroutine dispatches, triggering `ConcurrentModificationException`.
- **Root Cause**: Unsynchronized global mutable map accessed across threads.
- **Fix**: Replace with a thread-safe `ConcurrentHashMap<String, Color>` or Android's thread-safe `LruCache<String, Color>`.

### [P0] A3. Position Sync Inverting `isPlaying` to `false` Every Second
- **Location**: `PlaybackController.kt:826-836`, `DeviceSyncManager.kt:463-484`
- **Issue**: Every 1 second during phone playback, `PlaybackController` calls `deviceSyncManager.reportPosition(pos, dur)`. Default parameters send `isPlaying = false` and `trackId = null`. The sync server receives `isPlaying: false`, updates session state, and notifies the web player that music is paused.
- **Root Cause**: Omitting active playback state and track ID in progress polling invocation.
- **Fix**: Pass `isPlaying = _playbackState.value.isPlaying`, `isBuffering = _playbackState.value.isBuffering`, and `trackId = currentTrack?.id` explicitly in `reportPosition()`.

### [P0] A4. Repeat Mode `ALL` Traps ExoPlayer in Infinite Single-Track Loop
- **Location**: `PlaybackController.kt:749`, `394-422`
- **Issue**: `PlaybackController` feeds ExoPlayer a single `MediaItem` at a time while managing the playlist queue in memory. When Repeat Mode is set to `ALL`, `mediaController?.repeatMode = Player.REPEAT_MODE_ALL`. ExoPlayer repeats that single item internally and NEVER fires `Player.STATE_ENDED`. The controller is never notified, and the queue never advances to the next track.
- **Root Cause**: Mismatch between single-item ExoPlayer loading and player repeat mode semantics.
- **Fix**: Map `RepeatMode.ALL` to `Player.REPEAT_MODE_OFF` on ExoPlayer so `STATE_ENDED` triggers and `PlaybackController` advances `_currentQueue`.

### [P0] A5. Permanent Failure of Offline Playlist Mutations (`ADD_TRACK` / `REMOVE_TRACK`)
- **Location**: `SangitaSyncWorker.kt:471-475`, `531-534`
- **Issue**: When a playlist is created offline, its server UUID is null. Line 472 falls back to `playlistEntity?.title`. The worker sends the human title (e.g. "Road Trip") to the V2 API, which expects a UUID and returns 404. The worker marks the action `isPermanent = true`, permanently discarding the offline track additions.
- **Root Cause**: Fallback to human title as server ID instead of waiting for playlist creation sync.
- **Fix**: Do NOT fall back to title. If `serverId` is null, return `ActionExecutionResult.Skip` so the worker retries after the playlist creation mutation completes.

### [P1] A6. PlayerScreen Blank Black Freeze on Track End
- **Location**: `app/src/main/java/com/sangita/app/ui/screens/player/PlayerScreen.kt:110`
- **Issue**: `val track = state.currentTrack ?: return` exits early without rendering any UI or triggering navigation back when queue playback ends, leaving a blank black surface.
- **Root Cause**: Early return without fallback composable or navigation handler.
- **Fix**: Render an empty state with a back action button or auto-navigate back when `currentTrack == null`.

### [P1] A7. ExoPlayer Error Handling & Buffering Hang
- **Location**: `PlaybackController.kt:360-446`
- **Issue**: `Player.Listener` lacks `onPlayerError(PlaybackException)`. If an audio stream fails (network drop, 404, bad token), `_playbackState` remains stuck with `isBuffering = true`.
- **Root Cause**: Missing error listener in ExoPlayer callbacks.
- **Fix**: Implement `onPlayerError` to log the failure, stop progress polling, and reset `isBuffering = false` and `isPlaying = false`.

### [P1] A8. Android 14+ `SecurityException` on `becomingNoisyReceiver`
- **Location**: `SangitaPlaybackService.kt:32-38`, `167-170`
- **Issue**: `registerReceiver(becomingNoisyReceiver, ...)` does not specify `RECEIVER_NOT_EXPORTED` on Android 14+ (API 34). In addition, ExoPlayer already has `.setHandleAudioBecomingNoisy(true)` enabled.
- **Root Cause**: Redundant manual broadcast receiver registration violating API 34 export flags.
- **Fix**: Delete manual `becomingNoisyReceiver`; let ExoPlayer's built-in handler pause playback safely.

### [P1] A9. Downloaded Audio Hijacking Remote Playback
- **Location**: `PlaybackController.kt:457-470`
- **Issue**: If the user is controlling a remote device (e.g. web browser on sound system) and taps a song that happens to be downloaded locally on the phone, `!hasLocalAudio` evaluates to `false`, causing the controller to play through the phone speaker and hijack playback.
- **Root Cause**: Checking local file existence in remote playback dispatch condition.
- **Fix**: Condition remote dispatch solely on `isRemoteActive && !forceLocal`.

### [P2] A10. UI Thread Performance ($O(N \times M)$ Scans in `ArtistDetailScreen.kt`)
- **Location**: `app/src/main/java/com/sangita/app/ui/screens/artist/ArtistDetailScreen.kt:279-281`
- **Issue**: In `LazyColumn` item composition, `downloadedTracks.any { ... }`, `favorites.any { ... }`, and `savedTracks.any { ... }` run linear list scans per track row during fast scrolling.
- **Root Cause**: Unindexed list queries in hot Compose render loop.
- **Fix**: Precompute `downloadedIds`, `favoriteIds`, and `savedIds` as `HashSet<String>` via `remember`.

---

## 5. Verification & Testing Plan

| Layer | Test Suite / Command | Verification Criteria |
|---|---|---|
| **Backend** | `pytest backend/` | All API security, database WAL pragmas, stats tracking, and playlist endpoints pass. |
| **Sync Server** | `npm --prefix sync-server test` | Disconnect socket isolation, TTL reaper, and state broadcast tests pass. |
| **Web Frontend** | `npm --prefix frontend test` & `npm --prefix frontend run build` | Player memoization, gesture unlock, and track list toggle tests pass without React build errors. |
| **Android App** | `./gradlew testDebugUnitTest` | NavGraph decoding, PlaybackController repeat/remote routing, and SyncWorker skip logic pass. |
| **Android Build** | `./gradlew assembleDebug assemblePerformance` | Successful compilation, DEX optimization, and artifact generation in `releases/`. |

---

## 6. Execution Sequence

1. **Phase 1: Backend & Sync Server Remediation**
   - Implement B1 through B6 in `backend/app.py`.
   - Implement S1 through S3 in `sync-server/server.js`.
   - Run backend test suite and verify SQLite WAL mode.
2. **Phase 2: Web Client Frontend Remediation**
   - Implement F1 through F6 in `frontend/src/`.
   - Run web test suite and build verification.
3. **Phase 3: Android Native Remediation**
   - Implement A1 through A10 in `sangita-android-app`.
   - Run unit tests and assemble APKs.
4. **Phase 4: Verification & Git Commit / Push**
   - Verify RAM stays under 95% at all times.
   - Push to `origin/main` for `sangita` and `origin/main`, `origin/beta`, `tags` for `sangita-android-app`.

# Sangita Architecture & System Design

## Overview

Sangita is a **multi-device music synchronization application** that allows users to control playback across multiple devices seamlessly. It consists of three main components:

1. **Flask Backend** - REST API + Static file serving
2. **Vite React Frontend** - UI for music playback and device management
3. **Node.js Sync Server** - Real-time device synchronization via WebSockets

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Device 1-N)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React App (Vite)                                    │   │
│  │  ├─ Components: Player, TrackList, DevicePanel      │   │
│  │  ├─ useDeviceSync Hook (WebSocket Client)          │   │
│  │  └─ Local Storage: token, device_id, theme         │   │
│  └──────────────────────────────────────────────────────┘   │
│         │ HTTP (API)       │ WebSocket (Device Sync)        │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  ▼
┌──────────────────┐  ┌──────────────────────────┐
│  Flask Backend   │  │  Sync Server (Node.js)   │
│  (Port 5000)     │  │  (Port 3001)             │
│  ┌────────────┐  │  │  ┌────────────────────┐  │
│  │ /api/login │  │  │  │ Socket.io Handlers │  │
│  │ /api/playlist│ │  │  │ - REGISTER_DEVICE  │  │
│  │ /api/stream│  │  │  │ - HEARTBEAT        │  │
│  │ /           │  │  │  │ - TRANSFER_PLAYBACK
│  │ (static)   │  │  │  │ - PLAYBACK_STATE   │  │
│  └────────────┘  │  │  │ - POSITION_REPORT  │  │
│                  │  │  │ - REMOTE_CONTROL   │  │
└──────────────────┘  └────────────────────────────┘
         │                     │
         │                     ▼
         │            ┌──────────────────┐
         │            │ Redis Cache      │
         │            │ (Port 6379)      │
         │            │                  │
         │            │ Keys:            │
         │            │ - devices:{uid}  │
         │            │ - state:{uid}    │
         │            └──────────────────┘
         │
         ▼
┌──────────────────┐
│  Music Files     │
│  /app/music      │
│  ├─ song1.mp3    │
│  ├─ Playlist1/   │
│  └─ Playlist2/   │
└──────────────────┘
```

---

## Component Details

### 1. Flask Backend (`backend/app.py`)

**Purpose:** Authentication, music streaming, and frontend serving

#### Key Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/login` | POST | Authenticate user, return JWT token |
| `/api/playlists` | GET | Fetch all playlists & tracks |
| `/api/stream/<path>` | GET | Stream audio file |
| `/`, `/<path>` | GET | Serve React frontend (SPA) |

#### Authentication Flow:

```
1. User submits credentials (username/password)
   POST /api/login { username: "admin", password: "sangita123" }

2. Backend generates JWT token:
   - Payload: { u: "username", exp: <7 days from now> }
   - Encoding: base64url
   - Signature: HMAC-SHA256(payload, SECRET_KEY)
   - Token format: "<base64payload>.<hexsignature>"

3. Frontend stores token in localStorage
   - Used in Authorization header for API requests
   - Sent to sync-server via WebSocket auth handshake
```

#### Token Verification (Python):
```python
def _verify_token(token):
    b64, sig = token.rsplit(".", 1)
    expected = hmac.new(SECRET_KEY, b64.encode(), hashlib.sha256).hexdigest()
    if not crypto.compare_digest(sig, expected): return None
    payload = json.loads(base64.urlsafe_b64decode(b64 + "==").decode())
    if payload.get("exp") < time.time(): return None
    return payload.get("u")  # Return username
```

#### Playlist Discovery:

Scans the `MUSIC_DIR` directory:
- **Root tracks:** Any audio files in `/app/music/`
- **Playlists:** Subdirectories containing audio files
- Supported formats: `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.opus`

Example response:
```json
{
  "Library": ["song1.mp3", "song2.mp3"],
  "Rock": ["rock1/track1.mp3", "rock1/track2.mp3"],
  "Pop": ["pop1/track1.mp3"]
}
```

#### Audio Streaming:

- Uses Flask's `send_from_directory()` with conditional requests (HTTP 206)
- Prevents path traversal attacks (validates paths)
- Supports browser-native audio tag streaming

---

### 2. Sync Server (`sync-server/server.js`)

**Purpose:** Real-time multi-device synchronization via WebSockets

#### Architecture:

- **Server:** Express + Socket.io + Redis
- **Client:** Browser instances running `useDeviceSync` hook
- **Persistence:** Redis (TTL-based device registry, playback state)

#### WebSocket Events

##### **Client → Server Events**

1. **REGISTER_DEVICE**
   - Sent on first connection after authentication
   - Data: `{ deviceId, deviceName, deviceType }`
   - Action: Stores device info in Redis with 30s TTL
   - Effect: Broadcasts `DEVICE_LIST_UPDATED` to all user's devices

2. **HEARTBEAT**
   - Sent every 25 seconds from each connected device
   - Data: `{ deviceId }`
   - Action: Refreshes device TTL to 30s
   - Purpose: Prevents device list stale entries

3. **TRANSFER_PLAYBACK**
   - Sent when user wants to switch active device
   - Data: `{ targetDeviceId }`
   - Action: Sets new activeDeviceId, extrapolates position, saves state
   - Effect: Broadcasts `PLAYBACK_STATE_CHANGED` to all devices

4. **PLAYBACK_STATE_CHANGED**
   - Sent by active device when playback changes
   - Data: `{ activeDeviceId, trackId, positionMs, isPlaying, volume, updatedAt }`
   - Action: Saves to Redis state
   - Effect: Relays to inactive devices (read-only, for display)

5. **POSITION_REPORT**
   - Sent every 5 seconds by active device during playback
   - Data: `{ positionMs }`
   - Action: Updates server-side position for accuracy
   - No broadcast (internal sync)

6. **REMOTE_CONTROL**
   - Sent by inactive device to control active device
   - Data: `{ action, payload }`
   - Example: `{ action: "play" }`, `{ action: "seek", payload: { pct: 0.5 } }`
   - Action: Routes to active device via `REMOTE_COMMAND` event

##### **Server → Client Events**

1. **DEVICE_LIST_UPDATED**
   - Broadcast when device list changes
   - Data: `{ devices: [...] }`
   - Devices include: deviceId, deviceName, deviceType, socketId, connectedAt

2. **PLAYBACK_STATE_CHANGED**
   - Sent whenever playback state updates
   - Data: Full state object with activeDeviceId, trackId, position, etc.
   - Inactive devices pause audio automatically

3. **REMOTE_COMMAND**
   - Sent only to active device socket
   - Data: Command object passed through from REMOTE_CONTROL
   - Frontend handler processes and executes (play, pause, next, seek, volume)

#### Redis Data Structure

**Keys:** (TTL where noted)

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `sangita:device:{userId}:{deviceId}` | String (JSON) | 30s | Device metadata |
| `sangita:devices:{userId}` | Set | - | Device ID registry |
| `sangita:state:{userId}` | String (JSON) | - | Current playback state |

**Example Device Object:**
```json
{
  "deviceId": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "deviceName": "Chrome on Desktop · Mac",
  "deviceType": "desktop",
  "socketId": "socket_id_123",
  "connectedAt": 1715740800000
}
```

**Example State Object:**
```json
{
  "activeDeviceId": "device-1",
  "trackId": "library-5",
  "positionMs": 45000,
  "isPlaying": true,
  "volume": 0.8,
  "updatedAt": 1715740850000
}
```

#### Position Extrapolation

When switching devices, the server calculates where playback should resume:

```javascript
if (state.isPlaying && state.updatedAt) {
  state.positionMs = Math.max(0, state.positionMs + (Date.now() - state.updatedAt));
}
```

**Why:** The last position report was N seconds ago; audio should continue from extrapolated position.

#### Device Cleanup

**Auto-transfer on disconnect:**
- If active device disconnects while playing
- Server automatically switches to first remaining device
- Extrapolates position for seamless resume
- If no devices remain: pause and clear activeDeviceId

---

### 3. React Frontend (`frontend/src/`)

**Purpose:** User interface for authentication, music playback, and device management

#### Component Structure

```
App.jsx (Main component)
├─ Login.jsx (Authentication)
├─ Sidebar.jsx (Playlist selector)
├─ Hero.jsx (Welcome screen)
├─ TrackList.jsx (Queue display)
├─ Player.jsx (Playback controls)
├─ DevicePanel.jsx (Device selector)
└─ useDeviceSync.js (Custom hook)
```

#### useDeviceSync Hook

**Purpose:** Manages WebSocket connection and device synchronization logic

**Key State:**
- `devices` - List of connected devices
- `isActiveDevice` - Whether current device can control playback
- `syncState` - Current playback state from server

**Key Actions:**
- `broadcastState(state)` - Send playback update to server
- `transferPlayback(targetDeviceId)` - Switch to different device
- `sendRemoteControl(command)` - Send command to active device
- `claimActiveDevice()` - Make current device active

**Device Identification:**

```javascript
// Generates unique device ID
function getOrCreateDeviceId() {
  let id = localStorage.getItem('sangita_device_id');
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ...);
    localStorage.setItem('sangita_device_id', id);
  }
  return id;
}

// Detects device name from user agent
function detectDeviceName() {
  // Returns: "Chrome on Desktop · Mac"
}

function detectDeviceType() {
  // Returns: 'mobile', 'tablet', or 'desktop'
}
```

**Heartbeat Logic:**

```javascript
// Every 25 seconds, send HEARTBEAT to keep device alive
heartbeatRef.current = setInterval(() => {
  socket.emit('HEARTBEAT', { deviceId: deviceId.current });
}, 25_000);
```

**Position Reporting:**

```javascript
// While active AND playing, report position every 5s
if (isActiveDevice && isPlaying) {
  posReportRef.current = setInterval(() => {
    socket.emit('POSITION_REPORT', {
      positionMs: Math.floor(audioRef.current.currentTime * 1000),
    });
  }, 5_000);
}
```

**Remote Control Handler:**

```javascript
socket.on('REMOTE_COMMAND', (command) => {
  if (isActiveDevice) {
    switch (command.action) {
      case 'play': togglePlayRef.current?.(); break;
      case 'pause': togglePlayRef.current?.(); break;
      case 'next': playNextRef.current?.(); break;
      case 'prev': playPrevRef.current?.(); break;
      case 'seek': seekToRef.current?.(command.payload?.pct); break;
      case 'volume': changeVolRef.current?.(command.payload?.volume); break;
    }
  }
});
```

#### Player Component

**Features:**
- Audio playback with HTML5 `<audio>` element
- Current time / duration display
- Seek bar
- Volume control
- Play / pause / next / previous buttons
- Shuffle and repeat/loop modes

**State Sync:**
- On play/pause: broadcasts state to sync-server
- On seek: broadcasts state with new position
- On volume change: broadcasts state with new volume
- Receives state updates from server when inactive

#### DevicePanel Component

**Features:**
- Lists all connected devices
- Shows device type and name
- Current active device highlighted
- Click to transfer playback to another device
- Auto-refreshes when device list changes

---

## Authentication & Security Flow

### Token Generation & Verification

**Backend (Flask) generates token:**
```python
payload = json.dumps({
  "u": "admin",
  "exp": int(time.time()) + 86400 * 7  # 7 days
})
b64 = base64.urlsafe_b64encode(payload.encode()).decode()
sig = hmac.new(SECRET_KEY, b64.encode(), hashlib.sha256).hexdigest()
token = f"{b64}.{sig}"
```

**Frontend stores token:**
```javascript
localStorage.setItem('sangita_token', token);
```

**Frontend sends token to sync-server:**
```javascript
const socket = io(SYNC_URL, { auth: { token } });
```

**Sync-server verifies token (same algorithm):**
```javascript
function verifyToken(token) {
  const [b64, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET_KEY)
    .update(b64).digest('hex');
  if (!crypto.timingSafeEqual(sig, expected)) return null;
  const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.u;
}
```

**Security Considerations:**
- ✅ HMAC-SHA256 signature prevents tampering
- ✅ `timingSafeEqual` prevents timing attacks
- ✅ Expiration timestamp prevents indefinite token reuse
- ✅ Same SECRET_KEY used by backend and sync-server (must match!)
- ⚠️ Environment variable `SECRET_KEY` must be strong in production

---

## Data Flow: Multi-Device Playback

### Scenario: Play music on Device A, then switch to Device B

**1. Device A connects**
```
Device A → REGISTER_DEVICE {deviceId: "A1", deviceName: "Chrome", deviceType: "desktop"}
Sync Server → Store in Redis: sangita:device:admin:A1 (30s TTL)
Sync Server → Broadcast: DEVICE_LIST_UPDATED {devices: [{...A1}]} to both devices
```

**2. Device B connects**
```
Device B → REGISTER_DEVICE {deviceId: "B1", deviceName: "Firefox", deviceType: "desktop"}
Sync Server → Store in Redis: sangita:device:admin:B1 (30s TTL)
Sync Server → Broadcast: DEVICE_LIST_UPDATED {devices: [{...A1}, {...B1}]}
Sync Server → Send to B1: PLAYBACK_STATE_CHANGED (current state if A1 playing)
```

**3. User plays song on Device A**
```
Device A → PLAYBACK_STATE_CHANGED {
  activeDeviceId: "A1",
  trackId: "library-0",
  positionMs: 0,
  isPlaying: true,
  volume: 0.8,
  updatedAt: <timestamp>
}
Sync Server → Store in Redis: sangita:state:admin
Sync Server → Relay to all: PLAYBACK_STATE_CHANGED
Device B → Receives event, pauses its audio (if playing)
```

**4. Device A sends periodic position reports (every 5s)**
```
Device A → POSITION_REPORT {positionMs: 5000}
Sync Server → Updates Redis state.positionMs
```

**5. User switches to Device B**
```
Device B → TRANSFER_PLAYBACK {targetDeviceId: "B1"}
Sync Server → Extrapolates position:
  - Current position in Redis: 25000ms
  - Last update: 2 seconds ago
  - Calculated position: 25000 + 2000 = 27000ms
Sync Server → Updates Redis state:
  activeDeviceId = "B1"
  positionMs = 27000
  updatedAt = now
Sync Server → Broadcast: PLAYBACK_STATE_CHANGED
Device A → Receives event, pauses audio
Device B → Receives event, seeks to 27000ms and plays
```

**6. Heartbeat (every 25s) keeps devices alive**
```
Device A → HEARTBEAT {deviceId: "A1"}
Sync Server → Refresh TTL for sangita:device:admin:A1 to 30s

Device B → HEARTBEAT {deviceId: "B1"}
Sync Server → Refresh TTL for sangita:device:admin:B1 to 30s
```

**7. Device A disconnects**
```
Device A → [TCP connection closes]
Sync Server → "disconnect" event triggers
Sync Server → Remove from Redis: sangita:device:admin:A1
Sync Server → If A1 was active device:
  - Check remaining devices: [B1]
  - Auto-switch: activeDeviceId = "B1", extrapolate position
  - Broadcast: PLAYBACK_STATE_CHANGED to B1
```

---

## Environment Variables

### Backend (`backend/app.py`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MUSIC_DIR` | `./music` | Path to music files directory |
| `SANGITA_USER` | `admin` | Username for authentication |
| `SANGITA_PASS` | `sangita123` | Password for authentication |
| `SECRET_KEY` | `change-this-secret` | HMAC key for token signing |

### Sync Server (`sync-server/server.js`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | `change-this-secret` | HMAC key (must match backend!) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SYNC_PORT` | `3001` | Port sync-server listens on |
| `CORS_ORIGIN` | `*` | CORS allowed origins |

### Docker Compose (`.env` file, optional)

```bash
SANGITA_USER=admin
SANGITA_PASS=sangita123
SECRET_KEY=your-super-secret-key-change-this
```

---

## Docker Deployment

### Services:

1. **redis** - Cache layer for device registry and state
2. **sangita** - Flask backend (port 5000)
3. **sync-server** - WebSocket sync server (port 3001)

### Startup Order:

1. Redis starts (dependency for both services)
2. Flask backend waits for Redis health check ✗ Actually no health check in current config - Redis auto-connects
3. Sync Server waits for Redis, runs `npm install && npm start`

### Running:

```bash
docker-compose up -d
```

Access:
- Frontend: `http://localhost:5000`
- API: `http://localhost:5000/api/*`
- Sync Server: `ws://localhost:3001` (WebSocket)

---

## Fixes Applied

### 1. ✅ Missing `socket.io-client` dependency
- **Problem:** Frontend imports `socket.io-client` but not listed in `package.json`
- **Fix:** Added `"socket.io-client": "^4.7.5"` to frontend dependencies

### 2. ✅ Missing Sync Server in Docker Compose
- **Problem:** `docker-compose.yml` only defined Flask service, no sync-server
- **Fix:** Added `sync-server` service with:
  - Node.js container
  - Redis dependency
  - Port 3001 exposed
  - Environment variables for SECRET_KEY, REDIS_URL, CORS_ORIGIN

### 3. ✅ Missing Redis Service
- **Problem:** Sync Server requires Redis but no service defined
- **Fix:** Added `redis` service with:
  - Redis 7-Alpine image
  - Port 6379 exposed
  - Health check for startup validation
  - Persistent data (in-memory in this config, can add volume for persistence)

### 4. ✅ Network Connectivity
- **Fix:** Docker Compose auto-creates network; services reference each other by name:
  - Sync Server connects to: `redis://redis:6379`
  - Backend (if needed) can reach sync-server at: `http://sync-server:3001`

---

## Performance Considerations

### Sync Latency

- **Heartbeat interval:** 25 seconds (aggressive TTL refresh)
- **Position report interval:** 5 seconds (tracks position drift)
- **WebSocket transport:** Binary WebSocket + HTTP long-polling fallback
- **Expected latency:** <100ms for playback state propagation

### Scalability

**Current design:**
- Single Redis instance (in-memory)
- Single Sync Server instance
- Per-user device registry (scales with unique users)

**Limitations:**
- No Redis persistence (data lost on restart)
- No load balancing for sync-server
- No cross-server device synchronization

**For production scaling:**
- Add Redis AOF or RDB persistence
- Use Redis Cluster or Sentinel for HA
- Deploy sync-server behind load balancer with sticky sessions
- Use Socket.io adapter (socket.io-redis) for multi-instance sync

---

## Testing Scenarios

### 1. Single Device Playback
- Open `http://localhost:5000`
- Login with `admin` / `sangita123`
- Select track, play
- Verify: audio plays normally

### 2. Multi-Device Connection
- Open in two browsers/tabs
- Both login and register as different devices
- Device list shows both devices
- Verify: both appear in DevicePanel

### 3. Transfer Playback
- Start playing on Device A
- Click on Device B in DevicePanel
- Verify: Device A pauses, Device B plays from same position

### 4. Remote Control
- Playing on Device A, inactive on Device B
- Click play/pause in Device B's player
- Verify: Command reaches Device A, playback changes

### 5. Device Disconnection
- Three devices connected, Device A active
- Close Device A browser tab
- Verify: Playback auto-transfers to Device B/C

### 6. Token Expiration
- Set SHORT token TTL (for testing)
- Wait for expiration
- Try to perform action
- Verify: 401 Unauthorized, requires re-login

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Devices not appearing | Token invalid | Check SECRET_KEY matches in backend & sync-server |
| Transfer fails | Redis unreachable | Verify Redis container running: `docker ps` |
| Audio plays but sync breaks | Position report lag | Check network latency, increase report interval |
| WebSocket connection fails | CORS issue | Verify `CORS_ORIGIN=*` in sync-server env |
| Token decode errors | SECRET_KEY mismatch | Ensure same SECRET_KEY value across services |
| Stale devices in list | Heartbeat missed | Check for network issues, reduce heartbeat interval |

---

## Future Enhancements

1. **Persistent Redis** - Add volume mount for data persistence
2. **Multi-User Support** - Per-user playback state isolation (already supported)
3. **Queue Sharing** - Allow devices to share queue
4. **Offline Mode** - Download tracks for offline playback
5. **Server-Side Playlists** - Persist user-created playlists
6. **Now Playing API** - External API for current playing info
7. **Analytics** - Track play counts, user listening patterns
8. **Transcoding** - Support for lossless streaming with adaptive bitrate

---

**Document Version:** 1.0  
**Last Updated:** May 14, 2026  
**Architecture:** Microservices with WebSocket sync layer

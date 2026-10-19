# Sangita — Self-Hosted Music Streaming & Synced Lyrics Platform

**Sangita [ಸಂಗೀತ] — Meaning "Music" in Kannada**

Sangita is a modern, self-hosted, full-stack music streaming platform designed to run smoothly on your own server or home computer. Drop your music files into a folder, open your browser, and enjoy high-fidelity streaming, multi-device synchronization, and automated time-synced lyrics with zero subscription fees.

---

## Key Features

- **Self-Hosted Audio Streaming**:
  - Direct, fast streaming with HTTP 206 partial-content range support for instantaneous seeking.
  - Automatic playlist generation from directory structures (`music/<PlaylistName>/...`).
  - Wide format support: `.mp3`, `.flac`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.opus`.
- **Center-Stage Synced Lyrics (`.lrc`)**:
  - Immersive synced lyrics overlay with auto-scroll and 150ms lookahead highlighting.
  - Interactive click-to-seek directly to any lyric line.
  - Seamless full Unicode/UTF-8 support across scripts (Devanagari, Gurmukhi, Kannada, Latin, etc.).
- **Automated Lyrics Engine (Online API + Local AI Model Fallback)**:
  - **Online API Mode (Default)**: Rapidly fetches synced lyrics from LRCLIB; if missing, automatically falls back to local Whisper AI models.
  - **Direct Local Model Mode**: Offline and privacy-first transcription directly on machine CPU via CTranslate2 / `faster-whisper` (`small` int8 ~460MB, `base`, `tiny`, `medium`).
  - **Admin Web Controls & CLI**: Interactive **API Toggle**, Target Scope selection (All Library, Specific Playlist, or Single Song), CPU core affinity, RAM limiters, and optional HTDemucs vocal separation.
- **Remote GPU Acceleration (Local PC Lyrics API Offload)**:
  - Offload heavy Whisper AI transcription from low-spec servers (VPS, Docker, Raspberry Pi) to your local NVIDIA GPU laptop/PC using the standalone [Local_PC_Lyrics_API](Local_PC_Lyrics_API/).
  - Transcribes 4-minute tracks in **3 to 8 seconds** (15x–30x faster) using CUDA `float16`.
  - Includes a dedicated web dashboard on your PC displaying live GPU VRAM, CPU/RAM telemetry, active job monitor, and lyrics viewer.
  - Zero disk retention: uploaded audio is purged from local disk immediately after lyrics generation.
- **Multi-Device Real-Time Synchronization**:
  - Spotify Connect-style real-time control via WebSockets and Redis.
  - Use your smartphone or secondary browser tab as a remote control for your desktop or stereo playback.
- **Modern Responsive Design**:
  - Three curated themes: Blue Dark, Sleek Dark, and Clean Light.
  - Mobile, tablet, and desktop optimized responsive layouts.
  - Personalized Home Dashboard with listening history, Top 10 tracks, and diurnal SVG activity charts.
- **Docker-Ready**:
  - One-command startup via `docker compose`.
  - Optional Cloudflare Tunnel integration for zero-trust public access without opening router ports.

---

## Quick Start with Docker

### Requirements
- Docker and Docker Compose installed.

### Step 1: Clone the Repository
```bash
git clone https://github.com/bluedragon320/sangita.git
cd sangita
```

### Step 2: Configure Environment
Copy the example configuration:
```bash
cp .env.example .env
```
Edit `.env` to configure your credentials and secrets:
```env
SANGITA_USER=admin
SANGITA_PASS=yourpassword
SECRET_KEY=generate-a-secure-random-secret-here
```

### Step 3: Add Your Audio Library
Add music folders inside the `music/` directory. Each subfolder automatically becomes a playlist in Sangita:
```bash
mkdir -p music/Rock music/Electronic music/Main
cp /path/to/your/songs/*.mp3 music/Rock/
```

### Step 4: Launch
```bash
docker compose up --build -d
```
Open your browser and navigate to:
**http://localhost:5000**

Log in using the credentials defined in your `.env` file.

---

## Daily Operational Commands

| Action | Command |
| :--- | :--- |
| **Start services** | `docker compose up -d` |
| **Stop services** | `docker compose down` |
| **View live logs** | `docker compose logs -f` |
| **Restart backend after adding music** | `docker compose restart sangita` |
| **Rebuild after code changes** | `docker compose down && docker compose up --build -d` |

---

## Synced Lyrics Generation

Sangita includes an automated, resource-aware lyrics generation engine that pairs `.lrc` sidecar files with your audio tracks.

### 1. From the Web Admin Dashboard
1. Log in as an administrator and navigate to **Admin Dashboard -> Lyrics Engine**.
2. **API Toggle**:
   - **API: ON (Online + Fallback)**: Queries LRCLIB online database; if not found, automatically falls back to your local Whisper AI model.
   - **API: OFF (Direct Local)**: Skips all online lookups and transcribes directly using the local machine model.
3. **Target Scope**: Select **All Songs**, **Select Playlist**, or **Select Particular Song**.
4. **CTranslate2 Model**: Choose between `Small` (recommended ~460MB), `Base`, `Tiny`, or `Medium`.
5. **Resource Limits**: Set CPU core cap and watchdog RAM limit (default: 4096MB).
6. Click **Start Lyrics Caption Generation**. Monitor progress live via the real-time processing card, engine badges, and source counters.

### 2. From the Command Line (Background / Resumable)
You can also run the worker directly via CLI inside the container or on your host:
```bash
# Process entire library using online API with local fallback
docker exec -it sangita-backend python3 backend/lyrics_worker.py --cores 2 --max-ram-mb 4096

# Process library strictly offline using local Whisper models (bypassing online API)
docker exec -it sangita-backend python3 backend/lyrics_worker.py --no-api --model small --cores 2

# Process a specific playlist only
docker exec -it sangita-backend python3 backend/lyrics_worker.py --playlist "Rock" --cores 2

# Force transcribe a single song with vocal isolation
docker exec -it sangita-backend python3 backend/lyrics_worker.py --song "Rock/Song.mp3" --force --demucs
```

---

## Remote Access (Cloudflare Tunnel)

To securely access Sangita from mobile data or outside your local network without port forwarding:

1. Create a tunnel in the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com).
2. Copy your Tunnel Token.
3. Add the token to `.env`:
   ```env
   CLOUDFLARE_TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
   ```
4. In `docker-compose.yml`, uncomment the `tunnel` service block:
   ```yaml
   tunnel:
     image: cloudflare/cloudflared:latest
     container_name: sangita-tunnel
     restart: unless-stopped
     command: tunnel --no-autoupdate run
     environment:
       - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
     depends_on:
       - proxy
   ```
5. In Cloudflare, point the Public Hostname to `http://proxy:80`.
6. Restart your containers:
   ```bash
   docker compose up --build -d
   ```

---

## Local Development (Without Docker)

### Prerequisites
- Python 3.11+ with `ffmpeg`
- Node.js 18+
- Redis (optional; sync server falls back to in-memory mode if Redis is absent)

### 1. Backend Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=. python3 backend/app.py
```

### 2. Node Sync Server
```bash
cd sync-server
npm install
npm start
```

### 3. Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## ⚡ Local PC Lyrics API (Remote GPU Acceleration)

If your Sangita server runs on a low-resource machine (e.g., VPS, Raspberry Pi, or NAS without a GPU), you can run the standalone Whisper GPU microservice on your personal laptop or gaming PC with NVIDIA CUDA.

### On your PC / Laptop:
```bash
# Windows
Local_PC_Lyrics_API\start.bat

# Linux / macOS
./Local_PC_Lyrics_API/start.sh
```
Open **`http://localhost:8000`** in your browser to view the real-time hardware telemetry dashboard (GPU VRAM, CPU %, active job progress, and processed lyrics).

### On your Sangita Server:
1. Open Admin Dashboard -> **Lyrics Engine**.
2. Enable **"Remote GPU Acceleration"**.
3. Enter your PC's IP or Tailscale address (e.g., `http://192.168.1.50:8000`).
4. Click **"Test Connection"** and start generating lyrics at blazing speeds!

See [Local_PC_Lyrics_API/README.md](Local_PC_Lyrics_API/README.md) for detailed networking and setup instructions.

---

## Architecture Overview

```
sangita/
├── backend/
│   ├── app.py                 # Media streaming, auth, Pillow covers, SQLite stats, lyrics APIs
│   ├── lyrics_worker.py       # Resumable batch lyrics worker (Mutagen -> LRCLIB -> Remote GPU -> faster-whisper)
│   ├── requirements.txt       # Python dependencies
│   ├── test_admin_api.py      # Unit tests for admin routes and lyrics endpoints
│   └── test_lyrics_worker.py  # Unit tests for lyrics metadata and CLI flags
├── Local_PC_Lyrics_API/       # Standalone GPU acceleration microservice & local web dashboard
│   ├── server.py              # Flask GPU service with CUDA auto-detect & auto-purge
│   ├── templates/             # Live hardware telemetry & lyrics viewer dashboard
│   ├── start.bat              # One-click Windows launcher
│   ├── start.sh               # One-click Linux/Mac launcher
│   ├── test_server.py         # Unit tests for local API
│   └── requirements.txt
├── sync-server/
│   ├── server.js              # Socket.IO multi-device real-time sync with Redis / Memory fallback
│   └── package.json           # Node.js dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.jsx # Administration, analytics, user management, and lyrics console
│   │   │   ├── LyricsView.jsx     # Center-stage synced lyrics overlay with click-to-seek
│   │   │   ├── Player.jsx         # Persistent bottom audio player and controls
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useDeviceSync.js   # Multi-device WebSocket synchronization hook
│   │   └── index.css              # Custom design system and themes
│   └── package.json
├── nginx.conf                 # Gateway reverse proxy configuration
├── Dockerfile                 # Multi-stage production container build
└── docker-compose.yml         # Container topology
```

---

## License

This project is licensed under the terms of the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

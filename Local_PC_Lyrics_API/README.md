# ⚡ Sangita — Local PC Lyrics API

Run this standalone microservice on your personal PC or laptop (equipped with an NVIDIA GPU or modern CPU) to generate synced lyrics (`.lrc`) locally with lightning speed.

Because it runs completely on your local machine, there is zero GPU cloud cost and no need for a heavy server to do AI processing.

---

## 🌟 Highlights

- **Blazing Fast GPU Acceleration:** Transcribes a 4-minute song in **2 to 5 seconds** using NVIDIA CUDA (`float16`), compared to 2 to 5 minutes on server CPUs.
- **🛡️ Ephemeral RAM Isolation (Zero Disk Retention):** Models and audio streams reside in volatile RAM (`/dev/shm` POSIX shared memory on Linux) and GPU VRAM. When you stop the server or click Purge, **zero files remain on local storage**.
- **⚡ Two Delivery Modes (Online vs Server LAN):**
  - **Online (HuggingFace CDN):** Direct fast download from HuggingFace official CDN or local cache into RAM.
  - **From Sangita Server (LAN):** Streams model weights directly from your Sangita server over LAN into local RAM without internet access.
- **Built-in Web Dashboard:** Open `http://localhost:8000` in your browser to monitor real-time GPU VRAM, CPU %, RAM disk isolation, and view generated lyrics.
- **Flexible & On-Demand:** Start it when you want to batch-generate lyrics; stop it (`Ctrl+C`) when you're done and everything is cleanly wiped.

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.9+
- (Optional, Recommended) NVIDIA GPU with CUDA drivers installed

### 2. Launch on Windows
Double-click `start.bat` or run:
```cmd
cd Local_PC_Lyrics_API
python -m pip install -r requirements.txt
python server.py --port 8000
```

### 3. Launch on Linux / macOS
```bash
cd Local_PC_Lyrics_API
chmod +x start.sh
./start.sh
```

---

## 🔗 Connecting Sangita Server to Your PC

### If Server and PC are on the same local network (Wi-Fi/LAN):
1. Find your PC's local IP address (`ipconfig` on Windows or `ip a` / `hostname -I` on Linux/macOS, e.g. `192.168.1.50`).
2. Open Sangita Admin Dashboard -> **Lyrics Engine**.
3. Under **Remote GPU Acceleration**, enter:
   ```
   http://192.168.1.50:8000
   ```
4. *(Optional)* Toggle **"Use Only This GPU API (Exclusive GPU Mode)"** if your server has very low RAM/CPU, ensuring it strictly uses your PC GPU and never runs Whisper on the server CPU.
5. Click **"Test Connection"**. When green 🟢, click **Start Lyrics Caption Generation**!

### If Server is on a remote VPS / Cloud:
Connect your PC and VPS securely without opening router ports using **[Tailscale](https://tailscale.com/)** (Free):
1. Install Tailscale on your VPS and on your PC.
2. In Sangita Admin Dashboard, enter your PC's Tailscale IP:
   ```
   http://100.x.y.z:8000
   ```
3. Test connection and enjoy instant GPU offloading over encrypted wire!

---

## ⚙️ CLI Options & Resource Limits

| Flag | Default | Description |
| :--- | :--- | :--- |
| `--host` | `0.0.0.0` | Bind IP address (use `0.0.0.0` to allow server connections) |
| `--port` | `8000` | Port number |
| `--device` | `auto` | `auto` (prefers CUDA if detected), `cuda`, or `cpu` |
| `--compute-type` | `auto` | `float16`, `int8_float16` (50% less VRAM), or `int8` |
| `--model` | `small` | Default Whisper model (`tiny`, `base`, `small`, `medium`, `large-v3`) |
| `--cpu-threads` | Half cores | Maximum CPU threads allocated to CTranslate2 |
| `--max-ram-mb` | `4096` | Memory watchdog limit (MB); frees models if exceeded |
| `--cooldown-sec` | `0.5` | Pause between songs (seconds) to prevent continuous 100% GPU heat |
| `--no-low-priority` | `False` | Disables below-normal process priority |

---

## 🛡️ Live Resource Controls (Web UI)

Open **`http://localhost:8000`** in your browser to tune hardware safeguards in real time:
- **Max CPU Threads Slider:** Cap CPU cores so background transcription never slows down local multitasking.
- **RAM Ceiling Slider:** Auto-watchdog that unloads cached models and forces garbage collection.
- **GPU Cooldown Rest:** Pauses between tracks (e.g. 0.5s or 1.0s) to keep laptop temperatures cool and eliminate fan whine.
- **VRAM Optimization:** Switch to `int8_float16` to cut GPU VRAM usage in half while retaining full CUDA speed.
- **Low OS Priority:** Keeps games and desktop applications buttery smooth during transcription.

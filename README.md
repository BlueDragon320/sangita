Sangita — Self-Hosted Music Player

Sangita Meaning [Music in Kannada]

Sangita is a music player you run on your own server or computer. Drop in your audio files, open the browser, and stream your music from anywhere.
 
What it does
- Login page with username and password
- Each subfolder inside `music/` becomes a playlist
- Play, pause, skip, seek, volume control, shuffle
- Shows track duration for every song
- Three themes: Blue Dark, Dark, Light — toggle in the sidebar
- Works on desktop and mobile browser
- Runs in Docker — one command to start

HOW ANYONE CAN INSTALL AND RUN IT
================================================================

Requirements:
  - Docker installed
  - Docker Compose installed
  - That's it. Nothing else needed.

----------------------------------------------------------------
STEP 1 — Download the project
----------------------------------------------------------------

  git clone https://github.com/bluedragon320/sangita.git
  cd sangita

----------------------------------------------------------------
STEP 2 — Set username and password
----------------------------------------------------------------

  cp .env.example .env

Then open .env and change the values:

  SANGITA_USER=admin
  SANGITA_PASS=yourpassword
  SECRET_KEY=anylongrandomstring

change the user name, password as well as the secret_key.

Save the file.

----------------------------------------------------------------
STEP 3 — Add your music
----------------------------------------------------------------

Create folders inside the music/ folder.
Each folder becomes a playlist in the app.

  mkdir -p music/Rock
  mkdir -p music/Jazz

  cp /path/to/your/songs/*.mp3 music/Rock/

Supported formats: mp3  flac  wav  ogg  m4a  aac  opus

----------------------------------------------------------------
STEP 4 — Start the app
----------------------------------------------------------------

  docker compose up --build -d

Wait for it to finish. Then open your browser:

  http://localhost:5000

Login with the username and password you set in .env


----------------------------------------------------------------
PART 4 — EVERYDAY COMMANDS
----------------------------------------------------------------


Start the app:
  docker compose up -d

Stop the app:
  docker compose down

View logs (if something is wrong):
  docker compose logs -f

Add new music and restart:
  cp newsong.mp3 music/PlaylistName/
  docker compose restart

Update the app after code changes:
  docker compose down -v
  docker compose up --build -d


----------------------------------------------------------------
PART 5 — ACCESS FROM OTHER DEVICES
----------------------------------------------------------------

From another phone or computer on the same wifi:

  1. Find your computer's local IP:
       Linux:   ip a
       Windows: ipconfig

  2. Open this on the other device:
       http://YOUR_IP:5000

  Example: http://192.168.1.10:5000


----------------------------------------------------------------
PART 6 — ACCESS FROM ANYWHERE (Cloudflare Tunnel)
----------------------------------------------------------------

This lets you open Sangita from your phone on mobile data,
from another country, from anywhere — no port forwarding needed.

Step 1 — Go to https://one.dash.cloudflare.com
Step 2 — Networks → Tunnels → Create a tunnel
Step 3 — Copy the tunnel token shown on screen
Step 4 — Add it to your .env file:

  CLOUDFLARE_TUNNEL_TOKEN=paste-your-token-here

----------------------------------------------------------------
Step 5 — Replace your docker-compose.yml with this:
----------------------------------------------------------------
services:
  sangita:
    build: .
    expose:
      - "5000"
    volumes:
      - ./music:/app/music
    environment:
      - MUSIC_DIR=/app/music
      - SANGITA_USER=${SANGITA_USER}
      - SANGITA_PASS=${SANGITA_PASS}
      - SECRET_KEY=${SECRET_KEY}
    restart: unless-stopped

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - sangita
      
----------------------------------------------------------------
Step 6 — In Cloudflare dashboard, set the tunnel to point to:
----------------------------------------------------------------

  http://sangita:5000

----------------------------------------------------------------
Step 7 — Start:
----------------------------------------------------------------

  docker compose up --build -d

Your Sangita is now live at your Cloudflare domain from anywhere.



Images: 
<img width="1918" height="1037" alt="image" src="https://github.com/user-attachments/assets/800622b0-a754-47b6-8817-a3cb4b24a825" />
<img width="1922" height="1038" alt="image" src="https://github.com/user-attachments/assets/ad544933-c217-49b0-bb4b-6c5c937f4772" />


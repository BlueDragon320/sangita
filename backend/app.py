import os
import hmac
import hashlib
import time
import json
import base64
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, abort, g
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder=None)

MUSIC_DIR  = os.path.abspath(os.environ.get("MUSIC_DIR", "./music"))
USERNAME   = os.environ.get("SANGITA_USER", "admin")
PASSWORD   = os.environ.get("SANGITA_PASS", "sangita123")
SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret")
TOKEN_TTL  = 86400 * 7

AUDIO_EXTS = (".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus")

# User Database Persistence setup
DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
if not os.path.exists(DATA_DIR):
    DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
USERS_FILE = os.path.join(DATA_DIR, "users.json")
STATS_DB = os.path.join(DATA_DIR, "stats.db")

def get_db():
    conn = sqlite3.connect(STATS_DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS play_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            track_id TEXT,
            playlist TEXT,
            device_id TEXT,
            device_name TEXT,
            device_type TEXT,
            browser TEXT,
            os TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            duration_sec INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_totals (
            username TEXT PRIMARY KEY,
            total_seconds INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_track_totals (
            username TEXT,
            track_id TEXT,
            playlist TEXT,
            total_seconds INTEGER DEFAULT 0,
            play_count INTEGER DEFAULT 0,
            PRIMARY KEY (username, track_id, playlist)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_device_totals (
            username TEXT,
            device_id TEXT,
            device_name TEXT,
            device_type TEXT,
            browser TEXT,
            os TEXT,
            total_seconds INTEGER DEFAULT 0,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, device_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS track_cache (
            path TEXT PRIMARY KEY,
            mtime REAL,
            duration REAL,
            title TEXT,
            artist TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS playlist_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            playlist_name TEXT NOT NULL,
            track_path TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (username, playlist_name, track_path)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (username, name)
        )
    """)
    
    # Simple migration: if user_totals is empty, populate from existing play_events
    try:
        row = conn.execute("SELECT COUNT(*) as cnt FROM user_totals").fetchone()
        if row and row["cnt"] == 0:
            events = conn.execute("SELECT COUNT(*) as cnt FROM play_events").fetchone()
            if events and events["cnt"] > 0:
                # Populate user_totals
                conn.execute("""
                    INSERT INTO user_totals (username, total_seconds)
                    SELECT username, SUM(duration_sec)
                    FROM play_events
                    GROUP BY username
                """)
                # Populate user_track_totals
                conn.execute("""
                    INSERT INTO user_track_totals (username, track_id, playlist, total_seconds, play_count)
                    SELECT username, track_id, playlist, SUM(duration_sec), COUNT(*)
                    FROM play_events
                    GROUP BY username, track_id, playlist
                """)
                # Populate user_device_totals
                conn.execute("""
                    INSERT INTO user_device_totals (username, device_id, device_name, device_type, browser, os, total_seconds, last_seen)
                    SELECT username, device_id, device_name, device_type, browser, os, SUM(duration_sec), MAX(timestamp)
                    FROM play_events
                    GROUP BY username, device_id
                """)
    except Exception as e:
        print(f"[DB Migration Error] {e}")

    conn.commit()
    conn.close()

init_db()

def load_users():
    if not os.path.exists(USERS_FILE):
        # Seed default admin user from environment
        admin_user = {
            "username": USERNAME,
            "password_hash": generate_password_hash(PASSWORD),
            "role": "admin",
            "rules": {
                "allowed_playlists": ["*"]
            }
        }
        users = {USERNAME: admin_user}
        save_users(users)
        return users
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

def _make_token(username):
    payload = json.dumps({"u": username, "exp": int(time.time()) + TOKEN_TTL})
    b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(SECRET_KEY.encode(), b64.encode(), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"

def _verify_token(token):
    if not token:
        return None
    try:
        b64, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET_KEY.encode(), b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(b64 + "==").decode())
        if payload.get("exp", 0) < time.time():
            return None
        username = payload.get("u")
        users = load_users()
        if username not in users:
            return None
        return username
    except Exception:
        return None

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get("Authorization", "").replace("Bearer ", "")
        token = header or request.args.get("token", "")
        username = _verify_token(token)
        if not username:
            return jsonify({"error": "Unauthorized"}), 401
        users = load_users()
        g.username = username
        g.user = users.get(username)
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if g.user.get("role") != "admin":
            return jsonify({"error": "Forbidden - Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    
    users = load_users()
    user = users.get(username)
    if user and check_password_hash(user["password_hash"], password):
        return jsonify({
            "token": _make_token(username),
            "username": username,
            "role": user.get("role", "user")
        })
    return jsonify({"error": "Invalid username or password"}), 401

@app.route("/api/me")
@require_auth
def get_me():
    return jsonify({
        "username": g.username,
        "role": g.user.get("role", "user"),
        "rules": g.user.get("rules", {"allowed_playlists": ["*"]})
    })

@app.route("/api/playlists")
@require_auth
def get_playlists():
    result = {}
    username = g.user.get("username", "admin")
    
    # 1. Fetch user virtual reference playlists (Favorites first)
    conn = get_db()
    try:
        fav_rows = conn.execute(
            "SELECT track_path FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' ORDER BY added_at DESC, id DESC",
            (username,)
        ).fetchall()
        result["Favorites"] = [row["track_path"] for row in fav_rows]

        # Fetch other user custom virtual playlists
        custom_rows = conn.execute(
            "SELECT playlist_name, track_path FROM playlist_tracks WHERE username = ? AND playlist_name != 'Favorites' ORDER BY playlist_name ASC, added_at ASC, id ASC",
            (username,)
        ).fetchall()
        for row in custom_rows:
            pname = row["playlist_name"]
            if pname not in result:
                result[pname] = []
            result[pname].append(row["track_path"])

        # Also include any empty custom playlists created by user
        user_pl_rows = conn.execute(
            "SELECT name FROM user_playlists WHERE username = ? ORDER BY created_at ASC",
            (username,)
        ).fetchall()
        for row in user_pl_rows:
            pname = row["name"]
            if pname not in result:
                result[pname] = []
    except Exception as e:
        print(f"[Playlist DB Error] {e}")
    finally:
        conn.close()

    if not os.path.exists(MUSIC_DIR):
        return jsonify(result)
        
    allowed = g.user.get("rules", {}).get("allowed_playlists", ["*"])
    
    # Discover tracks in root (Library)
    if "*" in allowed or "Library" in allowed:
        root_tracks = sorted([
            f for f in os.listdir(MUSIC_DIR)
            if os.path.isfile(os.path.join(MUSIC_DIR, f)) and f.lower().endswith(AUDIO_EXTS)
        ])
        if root_tracks:
            result["Library"] = root_tracks
            
    # Discover playlists inside directories
    for folder in sorted(os.listdir(MUSIC_DIR)):
        folder_path = os.path.join(MUSIC_DIR, folder)
        if os.path.isdir(folder_path):
            if "*" in allowed or folder in allowed:
                tracks = sorted([
                    f for f in os.listdir(folder_path)
                    if f.lower().endswith(AUDIO_EXTS)
                ])
                if tracks:
                    result[folder] = [f"{folder}/{t}" for t in tracks]
    return jsonify(result)

@app.route("/api/favorites", methods=["GET"])
@require_auth
def get_favorites():
    username = g.user.get("username", "admin")
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT track_path FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' ORDER BY added_at DESC, id DESC",
            (username,)
        ).fetchall()
        return jsonify([r["track_path"] for r in rows])
    finally:
        conn.close()

@app.route("/api/favorites/toggle", methods=["POST"])
@require_auth
def toggle_favorite():
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    track_path = data.get("track_path")
    if not track_path:
        return jsonify({"error": "track_path is required"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' AND track_path = ?",
            (username, track_path)
        ).fetchone()

        if existing:
            conn.execute(
                "DELETE FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' AND track_path = ?",
                (username, track_path)
            )
            conn.commit()
            is_fav = False
        else:
            conn.execute(
                "INSERT INTO playlist_tracks (username, playlist_name, track_path) VALUES (?, 'Favorites', ?)",
                (username, track_path)
            )
            conn.commit()
            is_fav = True

        fav_rows = conn.execute(
            "SELECT track_path FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' ORDER BY added_at DESC, id DESC",
            (username,)
        ).fetchall()
        favorites_list = [r["track_path"] for r in fav_rows]

        return jsonify({
            "is_favorite": is_fav,
            "track_path": track_path,
            "favorites": favorites_list
        })
    finally:
        conn.close()

@app.route("/api/user-playlists", methods=["GET"])
@require_auth
def get_user_playlists():
    username = g.user.get("username", "admin")
    conn = get_db()
    try:
        created = [r["name"] for r in conn.execute("SELECT name FROM user_playlists WHERE username = ? ORDER BY name ASC", (username,)).fetchall()]
        tracks_pl = [r["playlist_name"] for r in conn.execute("SELECT DISTINCT playlist_name FROM playlist_tracks WHERE username = ? AND playlist_name != 'Favorites' ORDER BY playlist_name ASC", (username,)).fetchall()]
        all_custom = sorted(list(set(created + tracks_pl)))
        return jsonify({"playlists": all_custom})
    finally:
        conn.close()

@app.route("/api/user-playlists", methods=["POST"])
@require_auth
def create_user_playlist():
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or name == "Favorites" or name == "Library":
        return jsonify({"error": "Invalid playlist name"}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO user_playlists (username, name) VALUES (?, ?)",
            (username, name)
        )
        conn.commit()
        return jsonify({"status": "created", "name": name})
    finally:
        conn.close()

@app.route("/api/user-playlists/<name>/tracks", methods=["POST"])
@require_auth
def add_track_to_user_playlist(name):
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    track_path = data.get("track_path")
    if not track_path:
        return jsonify({"error": "track_path is required"}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO playlist_tracks (username, playlist_name, track_path) VALUES (?, ?, ?)",
            (username, name, track_path)
        )
        conn.commit()
        return jsonify({"status": "added", "playlist": name, "track_path": track_path})
    finally:
        conn.close()

@app.route("/api/user-playlists/<name>/tracks", methods=["DELETE"])
@require_auth
def remove_track_from_user_playlist(name):
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    track_path = data.get("track_path")
    if not track_path:
        return jsonify({"error": "track_path is required"}), 400

    conn = get_db()
    try:
        conn.execute(
            "DELETE FROM playlist_tracks WHERE username = ? AND playlist_name = ? AND track_path = ?",
            (username, name, track_path)
        )
        conn.commit()
        return jsonify({"status": "removed", "playlist": name, "track_path": track_path})
    finally:
        conn.close()

@app.route("/api/user-playlists/batch", methods=["POST"])
@require_auth
def create_user_playlist_batch():
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    track_paths = data.get("tracks") or []
    if not name or name == "Favorites" or name == "Library":
        return jsonify({"error": "Invalid playlist name"}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO user_playlists (username, name) VALUES (?, ?)",
            (username, name)
        )
        for idx, track_path in enumerate(track_paths):
            if track_path:
                conn.execute(
                    "INSERT OR IGNORE INTO playlist_tracks (username, playlist_name, track_path, position) VALUES (?, ?, ?, ?)",
                    (username, name, track_path, idx)
                )
        conn.commit()
        return jsonify({"status": "created", "name": name, "tracks_added": len(track_paths)})
    finally:
        conn.close()

@app.route("/api/user/stats", methods=["GET"])
@require_auth
def get_current_user_stats():
    username = g.username
    conn = get_db()
    try:
        # 1. Total listening time
        row_tot = conn.execute("SELECT total_seconds FROM user_totals WHERE username = ?", (username,)).fetchone()
        total_seconds = row_tot["total_seconds"] if row_tot else 0

        # 2. Unique tracks & total plays count
        row_counts = conn.execute("""
            SELECT COUNT(DISTINCT track_id) as unique_tracks, 
                   COALESCE(SUM(play_count), 0) as total_plays
            FROM user_track_totals
            WHERE username = ?
        """, (username,)).fetchone()
        unique_tracks = row_counts["unique_tracks"] if row_counts else 0
        total_plays = row_counts["total_plays"] if row_counts else 0

        # 3. Top 10 most played tracks
        top_rows = conn.execute("""
            SELECT track_id, playlist, total_seconds, play_count
            FROM user_track_totals
            WHERE username = ?
            ORDER BY play_count DESC, total_seconds DESC
            LIMIT 10
        """, (username,)).fetchall()
        
        top_tracks = []
        for r in top_rows:
            track_path = r["track_id"]
            base = os.path.basename(track_path)
            clean_name = os.path.splitext(base)[0]
            artist = "Unknown Artist"
            if " - " in clean_name:
                parts = clean_name.split(" - ", 1)
                artist = parts[0].strip()
                name = parts[1].strip()
            else:
                name = clean_name
            top_tracks.append({
                "path": track_path,
                "name": name,
                "artist": artist,
                "playlist": r["playlist"] or "Library",
                "total_seconds": r["total_seconds"],
                "play_count": r["play_count"]
            })

        # 4. Recently played (latest 10 play events)
        recent_rows = conn.execute("""
            SELECT track_id, playlist, duration_sec, timestamp
            FROM play_events
            WHERE username = ?
            ORDER BY id DESC
            LIMIT 10
        """, (username,)).fetchall()
        
        recently_played = []
        for r in recent_rows:
            track_path = r["track_id"]
            base = os.path.basename(track_path)
            clean_name = os.path.splitext(base)[0]
            artist = "Unknown Artist"
            if " - " in clean_name:
                parts = clean_name.split(" - ", 1)
                artist = parts[0].strip()
                name = parts[1].strip()
            else:
                name = clean_name
            recently_played.append({
                "path": track_path,
                "name": name,
                "artist": artist,
                "playlist": r["playlist"] or "Library",
                "duration_sec": r["duration_sec"],
                "played_at": r["timestamp"]
            })

        # 5. Top Artists
        artist_map = {}
        for r in conn.execute("SELECT track_id, play_count, total_seconds FROM user_track_totals WHERE username = ?", (username,)).fetchall():
            base = os.path.basename(r["track_id"])
            clean_name = os.path.splitext(base)[0]
            if " - " in clean_name:
                art = clean_name.split(" - ", 1)[0].strip()
            else:
                art = "Unknown Artist"
            if art not in artist_map:
                artist_map[art] = {"artist": art, "play_count": 0, "total_seconds": 0, "tracks": 0}
            artist_map[art]["play_count"] += r["play_count"]
            artist_map[art]["total_seconds"] += r["total_seconds"]
            artist_map[art]["tracks"] += 1
        
        top_artists = sorted(artist_map.values(), key=lambda x: (x["play_count"], x["total_seconds"]), reverse=True)[:6]

        return jsonify({
            "username": username,
            "total_seconds": total_seconds,
            "unique_tracks": unique_tracks,
            "total_plays": total_plays,
            "top_tracks": top_tracks,
            "recently_played": recently_played,
            "top_artists": top_artists
        })
    finally:
        conn.close()

@app.route("/api/user/listening-history", methods=["GET"])
@require_auth
def get_user_listening_history():
    username = g.username
    range_type = request.args.get("range", "24h") # '24h', '7d', 'custom'
    start_str = request.args.get("start", "")
    end_str = request.args.get("end", "")
    
    conn = get_db()
    try:
        now = datetime.now()
        data_points = []
        total_range_seconds = 0
        
        if range_type == "24h":
            cutoff = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d %H', timestamp) as hour_key,
                       SUM(duration_sec) as total_sec,
                       COUNT(id) as play_count
                FROM play_events
                WHERE username = ? AND timestamp >= ?
                GROUP BY hour_key
            """, (username, cutoff.strftime('%Y-%m-%d %H:%M:%S'))).fetchall()
            
            row_dict = {r["hour_key"]: (r["total_sec"], r["play_count"]) for r in rows}
            
            for i in range(24):
                slot_time = cutoff + timedelta(hours=i)
                slot_key = slot_time.strftime('%Y-%m-%d %H')
                sec, cnt = row_dict.get(slot_key, (0, 0))
                total_range_seconds += sec
                
                hour_val = slot_time.hour
                am_pm = "AM" if hour_val < 12 else "PM"
                hour_12 = 12 if hour_val % 12 == 0 else hour_val % 12
                label = f"{hour_12} {am_pm}"
                
                data_points.append({
                    "key": slot_key,
                    "label": label,
                    "full_label": slot_time.strftime('%b %d, %I:%M %p'),
                    "seconds": sec,
                    "minutes": round(sec / 60.0, 1),
                    "plays": cnt
                })
                
        elif range_type == "7d":
            cutoff = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d', timestamp) as day_key,
                       SUM(duration_sec) as total_sec,
                       COUNT(id) as play_count
                FROM play_events
                WHERE username = ? AND timestamp >= ?
                GROUP BY day_key
            """, (username, cutoff.strftime('%Y-%m-%d %H:%M:%S'))).fetchall()
            
            row_dict = {r["day_key"]: (r["total_sec"], r["play_count"]) for r in rows}
            
            for i in range(7):
                slot_time = cutoff + timedelta(days=i)
                slot_key = slot_time.strftime('%Y-%m-%d')
                sec, cnt = row_dict.get(slot_key, (0, 0))
                total_range_seconds += sec
                
                data_points.append({
                    "key": slot_key,
                    "label": slot_time.strftime('%a'),
                    "full_label": slot_time.strftime('%A, %b %d'),
                    "seconds": sec,
                    "minutes": round(sec / 60.0, 1),
                    "plays": cnt
                })
                
        else: # custom or 30d
            try:
                if start_str and end_str:
                    start_dt = datetime.strptime(start_str, '%Y-%m-%d').replace(hour=0, minute=0, second=0)
                    end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                else:
                    start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0)
                    end_dt = now
            except Exception:
                start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0)
                end_dt = now
                
            if start_dt > end_dt:
                start_dt, end_dt = end_dt, start_dt
                
            days_diff = min((end_dt - start_dt).days + 1, 90)
            
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d', timestamp) as day_key,
                       SUM(duration_sec) as total_sec,
                       COUNT(id) as play_count
                FROM play_events
                WHERE username = ? AND timestamp >= ? AND timestamp <= ?
                GROUP BY day_key
            """, (username, start_dt.strftime('%Y-%m-%d %H:%M:%S'), end_dt.strftime('%Y-%m-%d %H:%M:%S'))).fetchall()
            
            row_dict = {r["day_key"]: (r["total_sec"], r["play_count"]) for r in rows}
            
            for i in range(days_diff):
                slot_time = start_dt + timedelta(days=i)
                slot_key = slot_time.strftime('%Y-%m-%d')
                sec, cnt = row_dict.get(slot_key, (0, 0))
                total_range_seconds += sec
                
                data_points.append({
                    "key": slot_key,
                    "label": slot_time.strftime('%b %d'),
                    "full_label": slot_time.strftime('%A, %b %d, %Y'),
                    "seconds": sec,
                    "minutes": round(sec / 60.0, 1),
                    "plays": cnt
                })
                
        return jsonify({
            "range": range_type,
            "total_seconds": total_range_seconds,
            "data": data_points
        })
    finally:
        conn.close()

def get_track_durations():
    if not os.path.exists(MUSIC_DIR):
        return {}
    conn = get_db()
    cached = {}
    try:
        cached = {row["path"]: (row["mtime"], row["duration"]) for row in conn.execute("SELECT path, mtime, duration FROM track_cache").fetchall()}
    except Exception as e:
        print(f"[TrackCache Error] {e}")

    durations = {}
    to_insert = []

    for root, _, files in os.walk(MUSIC_DIR):
        for f in files:
            if f.lower().endswith(AUDIO_EXTS):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, MUSIC_DIR)
                try:
                    mtime = os.path.getmtime(full_path)
                    if rel_path in cached and cached[rel_path][0] == mtime and cached[rel_path][1] is not None:
                        durations[rel_path] = cached[rel_path][1]
                    else:
                        import mutagen
                        audio = mutagen.File(full_path)
                        dur = round(audio.info.length, 1) if (audio and hasattr(audio, 'info') and getattr(audio.info, 'length', None)) else None
                        durations[rel_path] = dur
                        to_insert.append((rel_path, mtime, dur))
                except Exception:
                    pass

    if to_insert:
        try:
            conn.executemany("""
                INSERT INTO track_cache (path, mtime, duration)
                VALUES (?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                mtime = excluded.mtime,
                duration = excluded.duration
            """, to_insert)
            conn.commit()
        except Exception as e:
            print(f"[TrackCache Save Error] {e}")
    conn.close()
    return durations

@app.route("/api/durations")
@require_auth
def get_durations():
    return jsonify(get_track_durations())

@app.route("/api/stream/<path:filepath>")
@require_auth
def stream_audio(filepath):
    import urllib.parse
    safe = os.path.normpath(urllib.parse.unquote(filepath))
    if safe.startswith("..") or safe.startswith("/"):
        abort(403)
        
    allowed = g.user.get("rules", {}).get("allowed_playlists", ["*"])
    if "*" not in allowed:
        parts = safe.split(os.sep)
        playlist_name = parts[0] if len(parts) > 1 else "Library"
        if playlist_name not in allowed:
            abort(403)
            
    full_path = os.path.join(MUSIC_DIR, safe)
    if not os.path.isfile(full_path):
        abort(404)
    return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path), conditional=True)

def process_cover_image(img_data):
    if not img_data:
        return None, None
    try:
        from PIL import Image, ImageChops, ImageStat
        import io

        img = Image.open(io.BytesIO(img_data))
        w, h = img.size
        
        rgb_img = img.convert("RGB")
        
        # 1. First check if top/bottom bars are solid or near-solid (e.g. YouTube 500x500 canvas)
        top_crop = rgb_img.crop((0, 0, w, int(h * 0.15)))
        bot_crop = rgb_img.crop((0, int(h * 0.85), w, h))
        top_std = max(ImageStat.Stat(top_crop).stddev)
        bot_std = max(ImageStat.Stat(bot_crop).stddev)
        
        best_cropped = None
        
        # If top and bottom 15% are nearly uniform (stddev < 8, e.g. white or black letterboxes)
        if top_std < 8 and bot_std < 8:
            for bg_color in [(255, 255, 255), (0, 0, 0), rgb_img.getpixel((0, 0)), rgb_img.getpixel((w - 1, h - 1))]:
                bg = Image.new("RGB", (w, h), bg_color)
                diff = ImageChops.difference(rgb_img, bg)
                diff = diff.point(lambda p: 255 if p > 15 else 0)
                bbox = diff.getbbox()
                if bbox and (bbox[3] - bbox[1] < h * 0.95):
                    v_cropped = img.crop(bbox)
                    cw, ch = v_cropped.size
                    if cw > ch * 1.08:
                        offset = (cw - ch) // 2
                        best_cropped = v_cropped.crop((offset, 0, offset + ch, ch))
                    else:
                        best_cropped = v_cropped
                    break
        
        # 2. General bounding box detection if not caught above
        if best_cropped is None:
            candidate_bg_colors = [
                rgb_img.getpixel((0, 0)),
                rgb_img.getpixel((w - 1, 0)),
                rgb_img.getpixel((0, h - 1)),
                rgb_img.getpixel((w - 1, h - 1)),
                (0, 0, 0),
                (255, 255, 255)
            ]
            for bg_color in candidate_bg_colors:
                bg = Image.new("RGB", (w, h), bg_color)
                diff = ImageChops.difference(rgb_img, bg)
                diff = diff.point(lambda p: 255 if p > 15 else 0)
                bbox = diff.getbbox()
                if bbox:
                    bw = bbox[2] - bbox[0]
                    bh = bbox[3] - bbox[1]
                    if (w - bw >= w * 0.05) or (h - bh >= h * 0.05):
                        cropped = img.crop(bbox)
                        cw, ch = cropped.size
                        if cw > ch * 1.08:
                            offset = (cw - ch) // 2
                            best_cropped = cropped.crop((offset, 0, offset + ch, ch))
                        elif ch > cw * 1.08:
                            offset = (ch - cw) // 2
                            best_cropped = cropped.crop((0, offset, cw, offset + cw))
                        else:
                            best_cropped = cropped
                        break

        # 3. If image itself is landscape/portrait without borders, center crop to 1:1 square
        if best_cropped is None:
            if w > h * 1.08:
                offset = (w - h) // 2
                best_cropped = img.crop((offset, 0, offset + h, h))
            elif h > w * 1.08:
                offset = (h - w) // 2
                best_cropped = img.crop((0, offset, w, offset + w))
            else:
                best_cropped = img

        out = io.BytesIO()
        if best_cropped.mode in ("RGBA", "LA", "P"):
            best_cropped.save(out, format="PNG")
            return out.getvalue(), "image/png"
        else:
            best_cropped.save(out, format="JPEG", quality=95)
            return out.getvalue(), "image/jpeg"
    except Exception as e:
        print(f"[CoverProcess Error] {e}")
    return img_data, "image/jpeg"

def extract_cover_art(full_path):
    raw_data, mime = None, None
    try:
        import mutagen
        audio = mutagen.File(full_path)
        if audio is not None and audio.tags:
            # 1. ID3 tags (MP3, AIFF)
            if hasattr(audio.tags, "getall"):
                apics = audio.tags.getall("APIC")
                if apics:
                    raw_data, mime = apics[0].data, apics[0].mime or "image/jpeg"
            # 2. Tag keys starting with APIC
            if not raw_data:
                for k, v in getattr(audio, "tags", {}).items():
                    if k.startswith("APIC"):
                        raw_data, mime = v.data, getattr(v, "mime", "image/jpeg") or "image/jpeg"
                        break
            # 3. FLAC pictures
            if not raw_data and hasattr(audio, "pictures") and audio.pictures:
                raw_data, mime = audio.pictures[0].data, audio.pictures[0].mime or "image/jpeg"
            # 4. MP4 / M4A covers
            if not raw_data and "covr" in audio.tags and audio.tags["covr"]:
                covr = audio.tags["covr"][0]
                mime = "image/png" if getattr(covr, "imageformat", None) == 14 else "image/jpeg"
                raw_data = bytes(covr)
            # 5. Ogg / Opus
            if not raw_data and "metadata_block_picture" in audio.tags:
                import base64
                from mutagen.flac import Picture
                pic_data = base64.b64decode(audio.tags["metadata_block_picture"][0])
                pic = Picture(pic_data)
                raw_data, mime = pic.data, pic.mime or "image/jpeg"
    except Exception as e:
        print(f"[CoverArt Error] {e}")

    # Check local image in same directory (cover.jpg, folder.jpg, etc.)
    if not raw_data:
        dir_path = os.path.dirname(full_path)
        for img_name in ("cover.jpg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png"):
            candidate = os.path.join(dir_path, img_name)
            if os.path.isfile(candidate):
                mime = "image/png" if img_name.endswith(".png") else "image/jpeg"
                try:
                    with open(candidate, "rb") as f:
                        raw_data = f.read()
                        break
                except Exception:
                    pass

    if raw_data:
        return process_cover_image(raw_data)
    return None, None

@app.route("/api/cover/<path:filepath>")
@require_auth
def get_cover_art(filepath):
    import urllib.parse
    from flask import Response
    safe = os.path.normpath(urllib.parse.unquote(filepath))
    if safe.startswith("..") or safe.startswith("/"):
        abort(403)

    allowed = g.user.get("rules", {}).get("allowed_playlists", ["*"])
    if "*" not in allowed:
        parts = safe.split(os.sep)
        playlist_name = parts[0] if len(parts) > 1 else "Library"
        if playlist_name not in allowed:
            abort(403)

    full_path = os.path.join(MUSIC_DIR, safe)
    # If filepath points to a playlist folder (e.g. "Alan Walker"), find the first audio file in it!
    if os.path.isdir(full_path):
        for root, _, files in os.walk(full_path):
            found = False
            for f in sorted(files):
                if f.lower().endswith(AUDIO_EXTS):
                    full_path = os.path.join(root, f)
                    found = True
                    break
            if found:
                break

    # If not a direct file or folder, check if it's a virtual playlist name in SQLite
    if not os.path.isfile(full_path):
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT track_path FROM playlist_tracks WHERE username = ? AND playlist_name = ? ORDER BY added_at DESC, id DESC LIMIT 1",
                (g.user.get("username", "admin"), safe)
            ).fetchone()
            if row:
                full_path = os.path.join(MUSIC_DIR, row["track_path"])
        finally:
            conn.close()

    if not os.path.isfile(full_path):
        abort(404)

    data, mime = extract_cover_art(full_path)
    if not data:
        abort(404)

    return Response(
        data,
        mimetype=mime,
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
            "Content-Length": str(len(data))
        }
    )

# Admin User Management Routes
@app.route("/api/admin/users", methods=["GET"])
@require_admin
def admin_get_users():
    users = load_users()
    user_list = []
    for username, u in users.items():
        user_list.append({
            "username": username,
            "role": u.get("role", "user"),
            "rules": u.get("rules", {"allowed_playlists": ["*"]})
        })
    return jsonify(user_list)

@app.route("/api/admin/users", methods=["POST"])
@require_admin
def admin_create_user():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    role = data.get("role", "user")
    rules = data.get("rules", {"allowed_playlists": ["*"]})
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    users = load_users()
    if username in users:
        return jsonify({"error": "User already exists"}), 400
        
    users[username] = {
        "username": username,
        "password_hash": generate_password_hash(password),
        "role": role,
        "rules": rules
    }
    save_users(users)
    return jsonify({"message": "User created successfully"}), 201

@app.route("/api/admin/users/<username>", methods=["PUT"])
@require_admin
def admin_update_user(username):
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    role = data.get("role")
    rules = data.get("rules")
    
    users = load_users()
    if username not in users:
        return jsonify({"error": "User not found"}), 404
        
    if username == g.username and role and role != "admin":
        admin_count = sum(1 for u in users.values() if u.get("role") == "admin")
        if admin_count <= 1:
            return jsonify({"error": "Cannot demote the only remaining admin user"}), 400
            
    user = users[username]
    if password:
        user["password_hash"] = generate_password_hash(password)
    if role:
        user["role"] = role
    if rules is not None:
        user["rules"] = rules
        
    users[username] = user
    save_users(users)
    return jsonify({"message": "User updated successfully"})

@app.route("/api/admin/users/<username>", methods=["DELETE"])
@require_admin
def admin_delete_user(username):
    if username == g.username:
        return jsonify({"error": "Cannot delete yourself"}), 400
        
    users = load_users()
    if username not in users:
        return jsonify({"error": "User not found"}), 404
        
    if users[username].get("role") == "admin":
        admin_count = sum(1 for u in users.values() if u.get("role") == "admin")
        if admin_count <= 1:
            return jsonify({"error": "Cannot delete the last remaining admin user"}), 400
            
    del users[username]
    save_users(users)
    return jsonify({"message": "User deleted successfully"})

# Usage Stats Tracking Routes
@app.route("/api/stats/ping", methods=["POST"])
@require_auth
def stats_ping():
    data = request.get_json(silent=True) or {}
    track_id = data.get("track_id")
    playlist = data.get("playlist")
    device_id = data.get("device_id")
    device_name = data.get("device_name", "Unknown")
    device_type = data.get("device_type", "desktop")
    browser = data.get("browser", "Unknown")
    os_name = data.get("os", "Unknown")
    duration = data.get("duration", 10)
    
    if not track_id:
        return jsonify({"error": "Missing track_id"}), 400
        
    conn = get_db()
    # Check if we should merge with the last event
    last_event = conn.execute("""
        SELECT id, track_id, duration_sec,
               (strftime('%s', 'now') - strftime('%s', timestamp)) as elapsed_sec
        FROM play_events
        WHERE username = ? AND device_id = ?
        ORDER BY id DESC LIMIT 1
    """, (g.username, device_id)).fetchone()
    
    should_merge = False
    if last_event and last_event["track_id"] == track_id:
        if last_event["elapsed_sec"] is not None and last_event["elapsed_sec"] < 120:
            should_merge = True

    # 1. Update user_totals
    conn.execute("""
        INSERT INTO user_totals (username, total_seconds)
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET
        total_seconds = total_seconds + ?
    """, (g.username, duration, duration))

    # 2. Update user_track_totals
    if should_merge:
        conn.execute("""
            INSERT INTO user_track_totals (username, track_id, playlist, total_seconds, play_count)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(username, track_id, playlist) DO UPDATE SET
            total_seconds = total_seconds + ?
        """, (g.username, track_id, playlist, duration, duration))
    else:
        conn.execute("""
            INSERT INTO user_track_totals (username, track_id, playlist, total_seconds, play_count)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(username, track_id, playlist) DO UPDATE SET
            total_seconds = total_seconds + ?,
            play_count = play_count + 1
        """, (g.username, track_id, playlist, duration, duration))

    # 3. Update user_device_totals
    conn.execute("""
        INSERT INTO user_device_totals (username, device_id, device_name, device_type, browser, os, total_seconds, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(username, device_id) DO UPDATE SET
        device_name = ?,
        device_type = ?,
        browser = ?,
        os = ?,
        total_seconds = total_seconds + ?,
        last_seen = datetime('now')
    """, (g.username, device_id, device_name, device_type, browser, os_name, duration, device_name, device_type, browser, os_name, duration))

    # 4. Insert or update play_event
    if should_merge:
        conn.execute("""
            UPDATE play_events
            SET duration_sec = duration_sec + ?, timestamp = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (duration, last_event["id"]))
    else:
        conn.execute("""
            INSERT INTO play_events (username, track_id, playlist, device_id, device_name, device_type, browser, os, duration_sec)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (g.username, track_id, playlist, device_id, device_name, device_type, browser, os_name, duration))

    # 5. Trim play_events for this user to keep only latest 1000 rows
    conn.execute("""
        DELETE FROM play_events
        WHERE username = ? AND id NOT IN (
            SELECT id FROM play_events
            WHERE username = ?
            ORDER BY id DESC
            LIMIT 1000
        )
    """, (g.username, g.username))

    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

@app.route("/api/admin/stats", methods=["GET"])
@require_admin
def admin_get_stats():
    username = request.args.get("username", "")
    conn = get_db()
    
    # 1. Total Listening Time per User
    if username:
        time_per_user = conn.execute("""
            SELECT username, total_seconds, 
                   (SELECT COUNT(*) FROM user_track_totals WHERE username = ?) as unique_tracks
            FROM user_totals
            WHERE username = ?
        """, (username, username)).fetchall()
    else:
        time_per_user = conn.execute("""
            SELECT t.username, t.total_seconds, COUNT(ut.track_id) as unique_tracks
            FROM user_totals t
            LEFT JOIN user_track_totals ut ON t.username = ut.username
            GROUP BY t.username
        """).fetchall()
    
    # 2. Most Played Songs (by listening time)
    if username:
        most_played = conn.execute("""
            SELECT track_id, playlist, total_seconds, play_count as pings
            FROM user_track_totals
            WHERE username = ?
            ORDER BY total_seconds DESC
            LIMIT 10
        """, (username,)).fetchall()
    else:
        most_played = conn.execute("""
            SELECT track_id, playlist, SUM(total_seconds) as total_seconds, SUM(play_count) as pings
            FROM user_track_totals
            GROUP BY track_id, playlist
            ORDER BY total_seconds DESC
            LIMIT 10
        """).fetchall()
    
    # 3. Usage by Device Type / Browser / OS
    if username:
        device_stats = conn.execute("""
            SELECT device_type, SUM(total_seconds) as total_seconds
            FROM user_device_totals
            WHERE username = ?
            GROUP BY device_type
        """, (username,)).fetchall()
        browser_stats = conn.execute("""
            SELECT browser, SUM(total_seconds) as total_seconds
            FROM user_device_totals
            WHERE username = ?
            GROUP BY browser
        """, (username,)).fetchall()
        os_stats = conn.execute("""
            SELECT os, SUM(total_seconds) as total_seconds
            FROM user_device_totals
            WHERE username = ?
            GROUP BY os
        """, (username,)).fetchall()
    else:
        device_stats = conn.execute("""
            SELECT device_type, SUM(total_seconds) as total_seconds
            FROM user_device_totals
            GROUP BY device_type
        """).fetchall()
        browser_stats = conn.execute("""
            SELECT browser, SUM(total_seconds) as total_seconds
            FROM user_device_totals
            GROUP BY browser
        """).fetchall()
        os_stats = conn.execute("""
            SELECT os, SUM(total_seconds) as total_seconds
            FROM user_device_totals
            GROUP BY os
        """).fetchall()
    
    # 4. User Device History (When, What device, Browser, For how much time)
    if username:
        history = conn.execute("""
            SELECT username, device_id, device_name, device_type, browser, os, 
                   last_seen, total_seconds
            FROM user_device_totals
            WHERE username = ?
            ORDER BY last_seen DESC
        """, (username,)).fetchall()
    else:
        history = conn.execute("""
            SELECT username, device_id, device_name, device_type, browser, os, 
                   last_seen, total_seconds
            FROM user_device_totals
            ORDER BY last_seen DESC
        """).fetchall()

    conn.close()
    
    return jsonify({
        "time_per_user": [dict(r) for r in time_per_user],
        "most_played": [dict(r) for r in most_played],
        "device_stats": [dict(r) for r in device_stats],
        "browser_stats": [dict(r) for r in browser_stats],
        "os_stats": [dict(r) for r in os_stats],
        "history": [dict(r) for r in history]
    })

@app.route("/api/admin/users/<username>/stats", methods=["GET"])
@require_admin
def get_user_stats(username):
    users = load_users()
    if username not in users:
        return jsonify({"error": "User not found"}), 404
        
    u = users[username]
    timeframe = request.args.get("timeframe", "7d")
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")
    
    conn = get_db()
    time_filter = ""
    params = [username]
    
    if timeframe == "24h":
        time_filter = "AND timestamp >= datetime('now', '-24 hours')"
    elif timeframe == "7d":
        time_filter = "AND timestamp >= datetime('now', '-7 days')"
    elif timeframe == "30d":
        time_filter = "AND timestamp >= datetime('now', '-30 days')"
    elif timeframe == "custom" and start_date and end_date:
        time_filter = "AND timestamp >= ? AND timestamp <= ?"
        params.extend([f"{start_date} 00:00:00", f"{end_date} 23:59:59"])
        
    # 1. Total usage time in period
    total_time_row = conn.execute(f"""
        SELECT SUM(duration_sec) as total_seconds
        FROM play_events
        WHERE username = ? {time_filter}
    """, params).fetchone()
    total_seconds = total_time_row["total_seconds"] or 0
    
    # 2. Last activity / login
    last_login_row = conn.execute("""
        SELECT MAX(last_seen) as last_seen
        FROM user_device_totals
        WHERE username = ?
    """, (username,)).fetchone()
    last_seen = last_login_row["last_seen"] or None
    
    # 3. Average daily use in period
    avg_daily_row = conn.execute(f"""
        SELECT AVG(daily_sum) as avg_seconds
        FROM (
            SELECT date(timestamp) as day, SUM(duration_sec) as daily_sum
            FROM play_events
            WHERE username = ? {time_filter}
            GROUP BY date(timestamp)
        )
    """, params).fetchone()
    avg_daily_seconds = avg_daily_row["avg_seconds"] or 0
    
    # 4. Most listened tracks in period
    most_played = conn.execute(f"""
        SELECT track_id, playlist, SUM(duration_sec) as total_seconds, COUNT(*) as pings
        FROM play_events
        WHERE username = ? {time_filter}
        GROUP BY track_id, playlist
        ORDER BY total_seconds DESC
        LIMIT 5
    """, params).fetchall()
    
    # 5. Graph Data: usage grouped by day or hour
    graph_data = []
    if timeframe == "24h":
        # Group by hour for the last 24 hours
        rows = conn.execute(f"""
            SELECT strftime('%H:00', timestamp) as label, SUM(duration_sec) as seconds
            FROM play_events
            WHERE username = ? {time_filter}
            GROUP BY label
            ORDER BY timestamp ASC
        """, params).fetchall()
        graph_data = [dict(r) for r in rows]
    else:
        # Group by day
        rows = conn.execute(f"""
            SELECT date(timestamp) as label, SUM(duration_sec) as seconds
            FROM play_events
            WHERE username = ? {time_filter}
            GROUP BY label
            ORDER BY label ASC
        """, params).fetchall()
        graph_data = [dict(r) for r in rows]
        
    conn.close()
    
    return jsonify({
        "username": username,
        "role": u.get("role", "user"),
        "rules": u.get("rules", {"allowed_playlists": ["*"]}),
        "total_seconds": total_seconds,
        "avg_daily_seconds": avg_daily_seconds,
        "last_seen": last_seen,
        "most_played": [dict(r) for r in most_played],
        "graph_data": graph_data
    })

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "static"))
    if path and os.path.isfile(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    return send_from_directory(static_dir, "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

import os
import hmac
import hashlib
import time
import json
import base64
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, abort, g
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder=None)

MUSIC_DIR  = os.environ.get("MUSIC_DIR", "./music")
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

@app.route("/api/stream/<path:filepath>")
@require_auth
def stream_audio(filepath):
    safe = os.path.normpath(filepath)
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
    # 1. Update user_totals
    conn.execute("""
        INSERT INTO user_totals (username, total_seconds)
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET
        total_seconds = total_seconds + ?
    """, (g.username, duration, duration))

    # 2. Update user_track_totals
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

    # 4. Insert play_event
    conn.execute("""
        INSERT INTO play_events (username, track_id, playlist, device_id, device_name, device_type, browser, os, duration_sec)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (g.username, track_id, playlist, device_id, device_name, device_type, browser, os_name, duration))

    # 5. Trim play_events for this user to keep only latest 100 rows
    conn.execute("""
        DELETE FROM play_events
        WHERE username = ? AND id NOT IN (
            SELECT id FROM play_events
            WHERE username = ?
            ORDER BY id DESC
            LIMIT 100
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

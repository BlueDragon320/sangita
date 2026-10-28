import os
import sys
import subprocess
import signal
import csv
import hmac
import hashlib
import time
import json
import base64
import sqlite3
import re
import threading
import secrets
import io
import glob
import urllib.parse
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, abort, g, has_request_context, Response, send_file
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import psutil

try:
    import mutagen
    from mutagen.flac import Picture
except ImportError:
    mutagen = None
    Picture = None

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError:
    Image = None
    ImageChops = None
    ImageStat = None

app = Flask(__name__, static_folder=None)
# Hardened production configuration (Items 10, 11, 12)
app.config["DEBUG"] = False
app.config["ENV"] = os.environ.get("FLASK_ENV", "production")

MUSIC_DIR  = os.path.abspath(os.environ.get("MUSIC_DIR", "./music"))
USERNAME   = os.environ.get("SANGITA_USER", "admin")
PASSWORD   = os.environ.get("SANGITA_PASS", "sangita123")

DEFAULT_TIMEZONE = "Asia/Kolkata"

def get_tz_from_request():
    tz_name = None
    try:
        from flask import has_request_context
        if has_request_context():
            tz_name = request.args.get("tz") or request.headers.get("X-Timezone")
    except Exception:
        pass
    if not tz_name:
        tz_name = DEFAULT_TIMEZONE
    try:
        return ZoneInfo(tz_name), tz_name
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE), DEFAULT_TIMEZONE

def get_tz_offset_minutes(tz_obj, dt=None):
    if dt is None:
        dt = datetime.now(tz_obj)
    offset = dt.utcoffset()
    return int(offset.total_seconds() / 60) if offset else 0

def format_tz_offset_sql(offset_minutes):
    return f"{offset_minutes:+d} minutes"

def format_timestamp_tz(ts_str, tz_obj):
    if not ts_str:
        return ""
    try:
        dt_utc = datetime.strptime(ts_str.split(".")[0], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        dt_local = dt_utc.astimezone(tz_obj)
        return dt_local.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ts_str

AUDIO_EXTS = (".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus")

def parse_track_name(track_path):
    """Returns (name, artist) from a file path like 'Artist - Song.mp3'."""
    base = os.path.basename(track_path)
    clean_name = os.path.splitext(base)[0]
    if " - " in clean_name:
        parts = clean_name.split(" - ", 1)
        return parts[1].strip(), parts[0].strip()
    return clean_name, "Unknown Artist"

# User Database Persistence setup
DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
if not os.path.exists(DATA_DIR):
    cand_root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    if os.path.exists(cand_root):
        DATA_DIR = cand_root
    else:
        DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
USERS_FILE = os.path.join(DATA_DIR, "users.json")
STATS_DB = os.path.join(DATA_DIR, "stats.db")

def _load_or_generate_secret_key():
    """Ensure cryptographically secure persistent SECRET_KEY if not configured via environment (Items 1, 2, 4)."""
    env_secret = (os.environ.get("SECRET_KEY") or "").strip()
    if env_secret and env_secret != "change-this-secret":
        return env_secret
    key_path = os.path.join(DATA_DIR, ".secret_key")
    if os.path.isfile(key_path):
        try:
            with open(key_path, "r", encoding="utf-8") as f:
                saved = f.read().strip()
                if len(saved) >= 32:
                    return saved
        except Exception:
            pass
    new_secret = secrets.token_hex(32)
    try:
        with open(key_path, "w", encoding="utf-8") as f:
            f.write(new_secret)
        try:
            os.chmod(key_path, 0o600)
        except Exception:
            pass
    except Exception:
        pass
    return new_secret

SECRET_KEY = _load_or_generate_secret_key()
TOKEN_TTL  = 86400 * 7

if PASSWORD == "sangita123":
    print("[SECURITY WARNING] Default admin password 'sangita123' is active. Set SANGITA_PASS in production.")

class _RequestDbProxy:
    """Wraps sqlite3.Connection so explicit .close() calls inside request routes are no-ops, allowing the connection to be shared per request and closed on app context teardown."""
    def __init__(self, conn):
        self._conn = conn
    def close(self):
        pass
    def __getattr__(self, name):
        return getattr(self._conn, name)

def get_db():
    if has_request_context():
        if "db" not in g:
            raw_conn = sqlite3.connect(STATS_DB)
            raw_conn.row_factory = sqlite3.Row
            g.raw_db = raw_conn
            g.db = _RequestDbProxy(raw_conn)
        return g.db
    conn = sqlite3.connect(STATS_DB)
    conn.row_factory = sqlite3.Row
    return conn

@app.teardown_appcontext
def close_db(error=None):
    raw_db = g.pop("raw_db", None)
    g.pop("db", None)
    if raw_db is not None:
        try:
            raw_db.close()
        except Exception:
            pass

def init_db():
    conn = get_db()
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=-8000")
    except Exception as e:
        print(f"[DB Pragma Warning] {e}")

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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS login_lockouts (
            lock_key TEXT PRIMARY KEY,
            failed_attempts INTEGER DEFAULT 0,
            locked_until REAL DEFAULT 0,
            last_attempt REAL DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_daily_data (
            username TEXT NOT NULL,
            date TEXT NOT NULL,
            bytes_consumed INTEGER DEFAULT 0,
            stream_requests INTEGER DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, date)
        )
    """)
    try:
        conn.execute("ALTER TABLE user_totals ADD COLUMN total_bytes INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE user_device_totals ADD COLUMN bytes_consumed INTEGER DEFAULT 0")
    except Exception:
        pass
    
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

    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_play_events_user_ts ON play_events (username, timestamp DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_play_events_user_device ON play_events (username, device_id, id DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_user_track_totals_user ON user_track_totals (username, total_seconds DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_playlist_tracks_user_playlist ON playlist_tracks (username, playlist_name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_user_daily_data_user_date ON user_daily_data (username, date)")
    except Exception as e:
        print(f"[DB Index Creation Warning] {e}")

    conn.commit()
    conn.close()

init_db()

def format_bytes(b):
    if not b or b <= 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024.0:
            return f"{b:.1f} {unit}" if unit != "B" else f"{int(b)} B"
        b /= 1024.0
    return f"{b:.1f} PB"

def record_user_data_consumption(username, num_bytes, device_id=None):
    if not username or not num_bytes or num_bytes <= 0:
        return
    try:
        tz_obj, _ = get_tz_from_request()
        today_str = datetime.now(tz_obj).strftime('%Y-%m-%d')
        conn = get_db()
        conn.execute("""
            INSERT INTO user_daily_data (username, date, bytes_consumed, stream_requests, last_updated)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(username, date) DO UPDATE SET
                bytes_consumed = bytes_consumed + ?,
                stream_requests = stream_requests + 1,
                last_updated = CURRENT_TIMESTAMP
        """, (username, today_str, int(num_bytes), int(num_bytes)))

        conn.execute("""
            INSERT INTO user_totals (username, total_seconds, total_bytes)
            VALUES (?, 0, ?)
            ON CONFLICT(username) DO UPDATE SET
                total_bytes = COALESCE(total_bytes, 0) + ?
        """, (username, int(num_bytes), int(num_bytes)))

        if device_id:
            try:
                conn.execute("""
                    UPDATE user_device_totals
                    SET bytes_consumed = COALESCE(bytes_consumed, 0) + ?
                    WHERE username = ? AND device_id = ?
                """, (int(num_bytes), username, device_id))
            except Exception:
                pass

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[RecordDataConsumption Error] {e}")

_users_cache = {"mtime": 0, "data": None}

def load_users():
    global _users_cache
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
        mtime = os.path.getmtime(USERS_FILE)
        if _users_cache["data"] is not None and _users_cache["mtime"] == mtime:
            return _users_cache["data"]
        with open(USERS_FILE, "r") as f:
            data = json.load(f)
        _users_cache = {"mtime": mtime, "data": data}
        return data
    except Exception:
        return _users_cache["data"] if _users_cache["data"] is not None else {}

def save_users(users):
    global _users_cache
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)
    try:
        _users_cache = {"mtime": os.path.getmtime(USERS_FILE), "data": users}
    except Exception:
        _users_cache = {"mtime": 0, "data": users}


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

MAX_FAILED_LOGIN_ATTEMPTS = 3
LOGIN_LOCKOUT_SECONDS = 300  # 5-minute break if password attempts fail 3 times

def _get_client_ip():
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"

def _check_login_lockout(username, ip):
    """
    Checks if client IP or username@IP is currently locked out.
    Returns (is_locked, remaining_seconds).
    """
    now = time.time()
    user_norm = (username or "").strip().lower()
    keys = [f"ip:{ip}"]
    if user_norm:
        keys.append(f"user_ip:{user_norm}@{ip}")

    try:
        conn = get_db()
        placeholders = ",".join("?" for _ in keys)
        rows = conn.execute(
            f"SELECT lock_key, failed_attempts, locked_until FROM login_lockouts WHERE lock_key IN ({placeholders})",
            keys
        ).fetchall()
        conn.close()

        max_remaining = 0
        for r in rows:
            locked_until = r["locked_until"] or 0
            if locked_until > now:
                rem = locked_until - now
                if rem > max_remaining:
                    max_remaining = rem

        if max_remaining > 0:
            return True, int(max_remaining)
        return False, 0
    except Exception as e:
        print(f"[Lockout Check Error] {e}")
        return False, 0

def _record_failed_login(username, ip):
    """
    Increments failed attempts for IP and username@IP.
    If failed_attempts >= MAX_FAILED_LOGIN_ATTEMPTS, locks for 5 minutes.
    Returns (is_locked, remaining_seconds, remaining_attempts).
    """
    now = time.time()
    user_norm = (username or "").strip().lower()
    keys = [f"ip:{ip}"]
    if user_norm:
        keys.append(f"user_ip:{user_norm}@{ip}")

    try:
        conn = get_db()
        max_attempts = 0
        is_locked = False
        remaining = 0

        for key in keys:
            row = conn.execute(
                "SELECT failed_attempts, locked_until FROM login_lockouts WHERE lock_key = ?",
                (key,)
            ).fetchone()

            current_count = 0
            if row:
                if (row["locked_until"] or 0) > 0 and (row["locked_until"] or 0) <= now:
                    current_count = 0
                else:
                    current_count = row["failed_attempts"] or 0

            new_count = current_count + 1
            max_attempts = max(max_attempts, new_count)

            locked_until = 0
            if new_count >= MAX_FAILED_LOGIN_ATTEMPTS:
                locked_until = now + LOGIN_LOCKOUT_SECONDS
                is_locked = True
                remaining = LOGIN_LOCKOUT_SECONDS

            conn.execute("""
                INSERT INTO login_lockouts (lock_key, failed_attempts, locked_until, last_attempt)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(lock_key) DO UPDATE SET
                    failed_attempts = excluded.failed_attempts,
                    locked_until = excluded.locked_until,
                    last_attempt = excluded.last_attempt
            """, (key, new_count, locked_until, now))

        conn.commit()
        conn.close()

        remaining_attempts = max(0, MAX_FAILED_LOGIN_ATTEMPTS - max_attempts)
        return is_locked, remaining, remaining_attempts
    except Exception as e:
        print(f"[Record Failed Login Error] {e}")
        return False, 0, 0

def _clear_login_lockout(username, ip):
    """
    Resets failed login attempts upon successful login.
    """
    user_norm = (username or "").strip().lower()
    keys = [f"ip:{ip}"]
    if user_norm:
        keys.append(f"user_ip:{user_norm}@{ip}")

    try:
        conn = get_db()
        placeholders = ",".join("?" for _ in keys)
        conn.execute(f"DELETE FROM login_lockouts WHERE lock_key IN ({placeholders})", keys)
        conn.commit()
        conn.close()
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Rate Limiting, Security Headers & Input Sanitization (Items 6, 7, 8, 9, 10, 11)
# ---------------------------------------------------------------------------

class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window IP rate limiter (Item 8)."""
    def __init__(self):
        self._records = {}
        self._lock = threading.Lock()

    def is_allowed(self, key, limit, window):
        if app.config.get("TESTING"):
            return True, 0
        now = time.time()
        with self._lock:
            timestamps = self._records.get(key, [])
            timestamps = [t for t in timestamps if t > now - window]
            if len(timestamps) >= limit:
                oldest = timestamps[0]
                retry_after = max(1, int(window - (now - oldest)))
                self._records[key] = timestamps
                return False, retry_after
            timestamps.append(now)
            self._records[key] = timestamps
            if len(self._records) > 5000:
                self._records = {k: v for k, v in self._records.items() if v and v[-1] > now - 3600}
            return True, 0

rate_limiter = SlidingWindowRateLimiter()

def rate_limit(limit=60, window=60, key_prefix="general"):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = _get_client_ip()
            allowed, retry_after = rate_limiter.is_allowed(f"{key_prefix}:{ip}", limit, window)
            if not allowed:
                resp = jsonify({
                    "error": "Too many requests. Please slow down.",
                    "retry_after": retry_after
                })
                resp.headers["Retry-After"] = str(retry_after)
                return resp, 429
            return f(*args, **kwargs)
        return wrapped
    return decorator

@app.after_request
def add_security_headers(response):
    """OWASP Security Headers and strict CORS (Items 7, 10, 11)."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "media-src 'self' blob:; "
        "connect-src 'self' ws: wss: http: https:; "
        "font-src 'self' data:; "
        "frame-ancestors 'self';"
    )
    cors_env = (os.environ.get("CORS_ORIGIN") or "").strip()
    req_origin = request.headers.get("Origin")
    if cors_env == "*":
        response.headers["Access-Control-Allow-Origin"] = "*"
    elif cors_env and req_origin == cors_env:
        response.headers["Access-Control-Allow-Origin"] = req_origin
        response.headers["Vary"] = "Origin"
    elif req_origin:
        host = request.host.split(":")[0]
        if "localhost" in req_origin or "127.0.0.1" in req_origin or host in req_origin:
            response.headers["Access-Control-Allow-Origin"] = req_origin
            response.headers["Vary"] = "Origin"

    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Forwarded-For, X-Timezone, X-Sangita-Node-Secret"
    )
    return response

@app.route("/<path:path>", methods=["OPTIONS"])
@app.route("/", methods=["OPTIONS"])
def handle_options(path=""):
    return jsonify({"status": "ok"}), 200

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.@]{2,32}$")

def sanitize_name(name, max_len=64):
    """Sanitizes user playlist and identifier strings against injection and traversal (Item 6)."""
    if not name or not isinstance(name, str):
        return None
    cleaned = "".join(ch for ch in name.strip() if ch.isprintable() and ch not in ("\n", "\r", "\t", "\0"))
    if not cleaned or len(cleaned) > max_len or "/" in cleaned or "\\" in cleaned or ".." in cleaned:
        return None
    return cleaned

def _is_authorized_node_or_admin():
    """Verify authorization via Bearer JWT, internal node cluster secret, or loopback (Items 3, 4, 9)."""
    if app.config.get("TESTING"):
        return True
    header = request.headers.get("Authorization", "").replace("Bearer ", "")
    token = header or request.args.get("token", "")
    if token and _verify_token(token):
        return True
    node_secret = request.headers.get("X-Sangita-Node-Secret") or request.args.get("node_secret")
    if node_secret and hmac.compare_digest(node_secret, SECRET_KEY):
        return True
    client_ip = _get_client_ip()
    if client_ip in ("127.0.0.1", "::1", "localhost"):
        return True
    return False

@app.route("/api/login", methods=["POST"])
@rate_limit(limit=15, window=60, key_prefix="login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    ip = _get_client_ip()

    # 1. Enforce 5-minute lockout if already triggered
    is_locked, remaining_sec = _check_login_lockout(username, ip)
    if is_locked:
        mins = remaining_sec // 60
        secs = remaining_sec % 60
        time_msg = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
        resp = jsonify({
            "error": f"Too many failed login attempts. Locked out for {time_msg}. Please wait before trying again.",
            "retry_after": remaining_sec
        })
        resp.headers["Retry-After"] = str(remaining_sec)
        return resp, 429

    users = load_users()
    user = users.get(username)
    if user and check_password_hash(user["password_hash"], password):
        # Successful login: clear failed attempts
        _clear_login_lockout(username, ip)
        return jsonify({
            "token": _make_token(username),
            "username": username,
            "role": user.get("role", "user")
        })

    # 2. Record failed attempt and lock out if threshold reached
    is_now_locked, remaining_sec, remaining_attempts = _record_failed_login(username, ip)
    if is_now_locked:
        mins = remaining_sec // 60
        secs = remaining_sec % 60
        time_msg = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
        resp = jsonify({
            "error": f"Too many failed login attempts. Locked out for {time_msg}. Please wait before trying again.",
            "retry_after": remaining_sec
        })
        resp.headers["Retry-After"] = str(remaining_sec)
        return resp, 429

    if remaining_attempts > 0:
        msg = f"Invalid username or password ({remaining_attempts} attempt{'s' if remaining_attempts > 1 else ''} remaining before 5-minute lockout)"
    else:
        msg = "Invalid username or password"
    return jsonify({"error": msg}), 401

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

# Cache parsed tags by file modification time; only return tracks the user can stream.
_track_metadata_cache = {}

@app.route("/api/track-metadata")
@require_auth
def get_track_metadata():
    playlists = get_playlists().get_json()
    allowed = g.user.get("rules", {}).get("allowed_playlists", ["*"])
    root = os.path.realpath(MUSIC_DIR)
    result = {}
    for paths in playlists.values():
        for track_path in paths:
            safe = os.path.normpath(track_path)
            parts = safe.split(os.sep)
            folder = parts[0] if len(parts) > 1 else "Library"
            if safe.startswith("..") or os.path.isabs(safe) or ("*" not in allowed and folder not in allowed):
                continue
            full_path = os.path.realpath(os.path.join(root, safe))
            if not full_path.startswith(root + os.sep) or not os.path.isfile(full_path):
                continue
            try:
                stamp = os.stat(full_path).st_mtime_ns
                cached = _track_metadata_cache.get(full_path)
                if not cached or cached[0] != stamp:
                    tags = mutagen.File(full_path, easy=True) if mutagen else None
                    metadata = {key: str(tags.get(key, [""])[0]) for key in ("title", "artist", "album") if tags and tags.get(key)}
                    cached = (stamp, metadata)
                    _track_metadata_cache[full_path] = cached
                result[track_path] = cached[1]
            except (OSError, ValueError, TypeError):
                continue
            except Exception:
                continue
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

@app.route("/api/favorites/set", methods=["POST"])
@require_auth
def set_favorite():
    """Set a favorite to a desired state; repeating a request is safe."""
    data = request.get_json(silent=True) or {}
    track_path = data.get("track_path")
    desired = data.get("is_favorite")
    if not isinstance(track_path, str) or not track_path.strip() or not isinstance(desired, bool):
        return jsonify({"error": "track_path and boolean is_favorite are required"}), 400
    username = g.user.get("username", "admin")
    conn = get_db()
    try:
        if desired:
            conn.execute("INSERT OR IGNORE INTO playlist_tracks (username, playlist_name, track_path) VALUES (?, 'Favorites', ?)", (username, track_path))
        else:
            conn.execute("DELETE FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' AND track_path = ?", (username, track_path))
        conn.commit()
        rows = conn.execute("SELECT track_path FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites' ORDER BY added_at DESC, id DESC", (username,)).fetchall()
        return jsonify({"track_path": track_path, "is_favorite": desired, "favorites": [row["track_path"] for row in rows]})
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
    name = sanitize_name(data.get("name"))
    if not name or name in ("Favorites", "Library"):
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
    name = sanitize_name(name)
    if not name or name in ("Favorites", "Library"):
        return jsonify({"error": "Invalid playlist name"}), 400
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    track_path = data.get("track_path")
    if not track_path or ".." in track_path or track_path.startswith("/"):
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
    name = sanitize_name(name)
    if not name or name in ("Favorites", "Library"):
        return jsonify({"error": "Invalid playlist name"}), 400
    username = g.user.get("username", "admin")
    data = request.get_json(force=True, silent=True) or {}
    track_path = data.get("track_path")
    if not track_path or ".." in track_path or track_path.startswith("/"):
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
    name = sanitize_name(data.get("name"))
    track_paths = data.get("tracks") or []
    if not name or name in ("Favorites", "Library"):
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
            name, artist = parse_track_name(track_path)
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
            name, artist = parse_track_name(track_path)
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
            _, art = parse_track_name(r["track_id"])
            if art not in artist_map:
                artist_map[art] = {"artist": art, "play_count": 0, "total_seconds": 0, "tracks": 0}
            artist_map[art]["play_count"] += r["play_count"]
            artist_map[art]["total_seconds"] += r["total_seconds"]
            artist_map[art]["tracks"] += 1
        
        top_artists = sorted(artist_map.values(), key=lambda x: (x["play_count"], x["total_seconds"]), reverse=True)[:6]

        # 6. Data Consumed
        tz_obj, _ = get_tz_from_request()
        today_str = datetime.now(tz_obj).strftime('%Y-%m-%d')
        daily_row = conn.execute("""
            SELECT bytes_consumed, stream_requests
            FROM user_daily_data
            WHERE username = ? AND date = ?
        """, (username, today_str)).fetchone()
        today_bytes = daily_row["bytes_consumed"] if daily_row else 0
        total_bytes = (row_tot["total_bytes"] if row_tot and "total_bytes" in row_tot.keys() and row_tot["total_bytes"] is not None else 0)

        return jsonify({
            "username": username,
            "total_seconds": total_seconds,
            "unique_tracks": unique_tracks,
            "total_plays": total_plays,
            "top_tracks": top_tracks,
            "recently_played": recently_played,
            "top_artists": top_artists,
            "data_consumed_today": {
                "bytes": today_bytes,
                "formatted": format_bytes(today_bytes),
                "date": today_str
            },
            "data_consumed_total": {
                "bytes": total_bytes,
                "formatted": format_bytes(total_bytes)
            }
        })
    finally:
        conn.close()

@app.route("/api/user/data-usage", methods=["GET", "POST"])
@require_auth
def user_data_usage():
    username = g.username
    tz_obj, _ = get_tz_from_request()
    today_str = datetime.now(tz_obj).strftime('%Y-%m-%d')
    
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        inc_bytes = int(data.get("bytes", 0))
        dev_id = data.get("device_id")
        if inc_bytes > 0:
            record_user_data_consumption(username, inc_bytes, dev_id)

    conn = get_db()
    try:
        today_row = conn.execute("""
            SELECT bytes_consumed, stream_requests, last_updated
            FROM user_daily_data
            WHERE username = ? AND date = ?
        """, (username, today_str)).fetchone()
        
        today_bytes = today_row["bytes_consumed"] if today_row else 0
        today_reqs = today_row["stream_requests"] if today_row else 0
        last_updated = today_row["last_updated"] if today_row else None

        tot_row = conn.execute("""
            SELECT total_bytes
            FROM user_totals
            WHERE username = ?
        """, (username,)).fetchone()
        total_bytes = (tot_row["total_bytes"] if tot_row and "total_bytes" in tot_row.keys() and tot_row["total_bytes"] is not None else 0)

        # Historical daily usage for recent days (up to 7 days)
        history_rows = conn.execute("""
            SELECT date, bytes_consumed, stream_requests
            FROM user_daily_data
            WHERE username = ?
            ORDER BY date DESC
            LIMIT 7
        """, (username,)).fetchall()
        
        history = [
            {
                "date": r["date"],
                "bytes": r["bytes_consumed"],
                "formatted": format_bytes(r["bytes_consumed"]),
                "requests": r["stream_requests"]
            }
            for r in history_rows
        ]

        return jsonify({
            "username": username,
            "today": {
                "date": today_str,
                "bytes": today_bytes,
                "formatted": format_bytes(today_bytes),
                "requests": today_reqs,
                "last_updated": last_updated
            },
            "total": {
                "bytes": total_bytes,
                "formatted": format_bytes(total_bytes)
            },
            "history": history
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
    
    tz_obj, tz_name = get_tz_from_request()
    conn = get_db()
    try:
        now = datetime.now(tz_obj)
        offset_minutes = get_tz_offset_minutes(tz_obj, now)
        offset_sql = format_tz_offset_sql(offset_minutes)
        data_points = []
        total_range_seconds = 0
        
        if range_type == "24h":
            cutoff = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
            cutoff_utc = cutoff.astimezone(timezone.utc)
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d %H', datetime(timestamp, ?)) as hour_key,
                       SUM(duration_sec) as total_sec,
                       COUNT(id) as play_count
                FROM play_events
                WHERE username = ? AND timestamp >= ?
                GROUP BY hour_key
            """, (offset_sql, username, cutoff_utc.strftime('%Y-%m-%d %H:%M:%S'))).fetchall()
            
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
            cutoff_utc = cutoff.astimezone(timezone.utc)
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d', datetime(timestamp, ?)) as day_key,
                       SUM(duration_sec) as total_sec,
                       COUNT(id) as play_count
                FROM play_events
                WHERE username = ? AND timestamp >= ?
                GROUP BY day_key
            """, (offset_sql, username, cutoff_utc.strftime('%Y-%m-%d %H:%M:%S'))).fetchall()
            
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
                    start_dt = datetime.strptime(start_str, '%Y-%m-%d').replace(hour=0, minute=0, second=0, tzinfo=tz_obj)
                    end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=tz_obj)
                else:
                    start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0)
                    end_dt = now
            except Exception:
                start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0)
                end_dt = now
                
            if start_dt > end_dt:
                start_dt, end_dt = end_dt, start_dt
                
            days_diff = min((end_dt - start_dt).days + 1, 90)
            start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            end_utc = end_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d', datetime(timestamp, ?)) as day_key,
                       SUM(duration_sec) as total_sec,
                       COUNT(id) as play_count
                FROM play_events
                WHERE username = ? AND timestamp >= ? AND timestamp <= ?
                GROUP BY day_key
            """, (offset_sql, username, start_utc, end_utc)).fetchall()
            
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
            "timezone": tz_name,
            "total_seconds": total_range_seconds,
            "data": data_points
        })
    finally:
        conn.close()

_durations_cache = {"ts": 0, "data": None}

def get_track_durations():
    global _durations_cache
    if _durations_cache["data"] is not None and (time.time() - _durations_cache["ts"] < 60):
        return _durations_cache["data"]
    if not os.path.exists(MUSIC_DIR):
        return {}
    conn = get_db()
    cached = {}
    try:
        cached = {row["path"].replace('\\', '/'): (row["mtime"], row["duration"]) for row in conn.execute("SELECT path, mtime, duration FROM track_cache").fetchall()}
    except Exception as e:
        print(f"[TrackCache Error] {e}")

    durations = {}
    to_insert = []

    for root, _, files in os.walk(MUSIC_DIR):
        for f in files:
            if f.lower().endswith(AUDIO_EXTS):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, MUSIC_DIR).replace('\\', '/')
                try:
                    mtime = os.path.getmtime(full_path)
                    if rel_path in cached and cached[rel_path][0] == mtime and cached[rel_path][1] is not None:
                        durations[rel_path] = cached[rel_path][1]
                    else:
                        if mutagen is not None:
                            audio = mutagen.File(full_path)
                            dur = round(audio.info.length, 1) if (audio and hasattr(audio, 'info') and getattr(audio.info, 'length', None)) else None
                        else:
                            dur = None
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
    _durations_cache = {"ts": time.time(), "data": durations}
    return durations

@app.route("/api/durations")
@require_auth
def get_durations():
    return jsonify(get_track_durations())

@app.route("/api/stream/<path:filepath>")
@require_auth
def stream_audio(filepath):
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
    real_music_dir = os.path.realpath(MUSIC_DIR)
    real_target = os.path.realpath(full_path)
    if not (real_target == real_music_dir or real_target.startswith(real_music_dir + os.sep)):
        abort(403)
    if not any(real_target.lower().endswith(ext) for ext in AUDIO_EXTS):
        abort(403)
    if not os.path.isfile(full_path):
        abort(404)
    resp = send_from_directory(os.path.dirname(full_path), os.path.basename(full_path), conditional=True)
    resp.headers["Cache-Control"] = "public, max-age=86400"
    
    # Record data consumption for this user
    try:
        bytes_count = resp.calculate_content_length() or resp.content_length
        if not bytes_count and os.path.isfile(full_path):
            bytes_count = os.path.getsize(full_path)
        if bytes_count and hasattr(g, "username") and g.username:
            dev_id = request.args.get("device_id") or request.headers.get("X-Device-Id")
            record_user_data_consumption(g.username, bytes_count, dev_id)
    except Exception as e:
        print(f"[Stream Data Tracking Error] {e}")

    return resp

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
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = data.get("role", "user")
    rules = data.get("rules", {"allowed_playlists": ["*"]})
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if not USERNAME_REGEX.match(username):
        return jsonify({"error": "Username must be 2-32 characters and contain only letters, numbers, _, -, ., @"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400
    if role not in ("admin", "user"):
        return jsonify({"error": "Role must be 'admin' or 'user'"}), 400
    if not isinstance(rules, dict):
        rules = {"allowed_playlists": ["*"]}
    
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
    
    if password and len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400
    if role and role not in ("admin", "user"):
        return jsonify({"error": "Role must be 'admin' or 'user'"}), 400

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
    if rules is not None and isinstance(rules, dict):
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

    # 6. Record optional client-reported bytes consumed
    try:
        bytes_consumed = data.get("bytes_consumed")
        if bytes_consumed and int(bytes_consumed) > 0:
            record_user_data_consumption(g.username, int(bytes_consumed), device_id)
    except Exception as e:
        print(f"[Ping Data Tracking Error] {e}")

    return jsonify({"status": "ok"})

@app.route("/api/admin/analytics", methods=["GET"])
@require_admin
def admin_get_analytics():
    timeframe = request.args.get("timeframe", "7d")  # 24h, 7d, 30d, 90d, all, custom
    start_str = request.args.get("start_date", "")
    end_str = request.args.get("end_date", "")
    
    tz_obj, tz_name = get_tz_from_request()
    conn = get_db()
    try:
        now = datetime.now(tz_obj)
        offset_minutes = get_tz_offset_minutes(tz_obj, now)
        offset_sql = format_tz_offset_sql(offset_minutes)
        
        # 1. Determine date range
        if timeframe == "24h":
            start_dt = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
            end_dt = now
            group_type = "hourly"
            num_slots = 24
        elif timeframe == "7d":
            start_dt = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = now
            group_type = "daily"
            num_slots = 7
        elif timeframe == "30d":
            start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = now
            group_type = "daily"
            num_slots = 30
        elif timeframe == "90d":
            start_dt = (now - timedelta(days=89)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = now
            group_type = "daily"
            num_slots = 90
        elif timeframe == "all":
            row_min = conn.execute("SELECT MIN(timestamp) as min_ts FROM play_events").fetchone()
            if row_min and row_min["min_ts"]:
                try:
                    dt_utc = datetime.strptime(row_min["min_ts"].split(".")[0], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                    start_dt = dt_utc.astimezone(tz_obj).replace(hour=0, minute=0, second=0)
                except Exception:
                    start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0)
            else:
                start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0)
            end_dt = now
            group_type = "daily"
            num_slots = min((end_dt - start_dt).days + 1, 365)
        else:  # custom
            try:
                if start_str and end_str:
                    start_dt = datetime.strptime(start_str, '%Y-%m-%d').replace(hour=0, minute=0, second=0, tzinfo=tz_obj)
                    end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=tz_obj)
                else:
                    start_dt = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0)
                    end_dt = now
            except Exception:
                start_dt = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0)
                end_dt = now
            if start_dt > end_dt:
                start_dt, end_dt = end_dt, start_dt
            days_diff = (end_dt - start_dt).days + 1
            if days_diff <= 2:
                group_type = "hourly"
                num_slots = days_diff * 24
            else:
                group_type = "daily"
                num_slots = min(days_diff, 365)

        start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        end_utc = end_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        start_query_str = start_dt.strftime('%Y-%m-%d %H:%M:%S')
        end_query_str = end_dt.strftime('%Y-%m-%d %H:%M:%S')
        date_params = [start_utc, end_utc]

        # 2. Executive KPIs
        kpi_row = conn.execute("""
            SELECT COALESCE(SUM(duration_sec), 0) as total_seconds,
                   COUNT(id) as total_plays,
                   COUNT(DISTINCT username) as unique_listeners,
                   COUNT(DISTINCT device_id) as active_devices,
                   COALESCE(AVG(duration_sec), 0) as avg_session_sec
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
        """, date_params).fetchone()

        total_seconds = kpi_row["total_seconds"]
        total_plays = kpi_row["total_plays"]
        unique_listeners = kpi_row["unique_listeners"]
        active_devices = kpi_row["active_devices"]
        avg_session_sec = round(kpi_row["avg_session_sec"], 1)

        # Average daily listening time per user
        avg_daily_row = conn.execute("""
            SELECT COALESCE(AVG(daily_user_sec), 0) as avg_daily_sec
            FROM (
                SELECT date(datetime(timestamp, ?)) as day, username, SUM(duration_sec) as daily_user_sec
                FROM play_events
                WHERE timestamp >= ? AND timestamp <= ?
                GROUP BY day, username
            )
        """, [offset_sql, start_utc, end_utc]).fetchone()
        avg_daily_seconds = round(avg_daily_row["avg_daily_sec"], 1)

        # 3. Timeline Time-Series
        timeline = []
        if group_type == "hourly":
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d %H', datetime(timestamp, ?)) as slot_key,
                       COALESCE(SUM(duration_sec), 0) as sec,
                       COUNT(id) as plays,
                       COUNT(DISTINCT username) as users
                FROM play_events
                WHERE timestamp >= ? AND timestamp <= ?
                GROUP BY slot_key
            """, [offset_sql, start_utc, end_utc]).fetchall()
            row_dict = {r["slot_key"]: (r["sec"], r["plays"], r["users"]) for r in rows}

            for i in range(num_slots):
                slot_time = start_dt + timedelta(hours=i)
                if slot_time > end_dt + timedelta(hours=1):
                    break
                slot_key = slot_time.strftime('%Y-%m-%d %H')
                sec, plays, users = row_dict.get(slot_key, (0, 0, 0))
                h = slot_time.hour
                am_pm = "AM" if h < 12 else "PM"
                h12 = 12 if h % 12 == 0 else h % 12
                timeline.append({
                    "key": slot_key,
                    "label": f"{h12} {am_pm}",
                    "full_label": slot_time.strftime('%b %d, %I:%M %p'),
                    "seconds": sec,
                    "minutes": round(sec / 60.0, 1),
                    "hours": round(sec / 3600.0, 2),
                    "plays": plays,
                    "active_users": users
                })
        else:
            rows = conn.execute("""
                SELECT strftime('%Y-%m-%d', datetime(timestamp, ?)) as slot_key,
                       COALESCE(SUM(duration_sec), 0) as sec,
                       COUNT(id) as plays,
                       COUNT(DISTINCT username) as users
                FROM play_events
                WHERE timestamp >= ? AND timestamp <= ?
                GROUP BY slot_key
            """, [offset_sql, start_utc, end_utc]).fetchall()
            row_dict = {r["slot_key"]: (r["sec"], r["plays"], r["users"]) for r in rows}

            for i in range(num_slots):
                slot_time = start_dt + timedelta(days=i)
                if slot_time > end_dt + timedelta(days=1):
                    break
                slot_key = slot_time.strftime('%Y-%m-%d')
                sec, plays, users = row_dict.get(slot_key, (0, 0, 0))
                timeline.append({
                    "key": slot_key,
                    "label": slot_time.strftime('%b %d') if num_slots > 7 else slot_time.strftime('%a'),
                    "full_label": slot_time.strftime('%A, %b %d, %Y'),
                    "seconds": sec,
                    "minutes": round(sec / 60.0, 1),
                    "hours": round(sec / 3600.0, 2),
                    "plays": plays,
                    "active_users": users
                })

        # 4. 24-Hour Diurnal Heatmap (Hourly Distribution across all days in timeframe)
        hour_rows = conn.execute("""
            SELECT CAST(strftime('%H', datetime(timestamp, ?)) AS INTEGER) as hr,
                   COALESCE(SUM(duration_sec), 0) as total_sec,
                   COUNT(id) as play_count
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY hr
        """, [offset_sql, start_utc, end_utc]).fetchall()
        hour_dict = {r["hr"]: (r["total_sec"], r["play_count"]) for r in hour_rows}

        hourly_distribution = []
        max_hour_sec = 0
        peak_hour_index = 0
        for h in range(24):
            sec, cnt = hour_dict.get(h, (0, 0))
            if sec > max_hour_sec:
                max_hour_sec = sec
                peak_hour_index = h
            am_pm = "AM" if h < 12 else "PM"
            h12 = 12 if h % 12 == 0 else h % 12
            pct = round((sec / total_seconds * 100), 1) if total_seconds > 0 else 0
            hourly_distribution.append({
                "hour": h,
                "label": f"{h12} {am_pm}",
                "full_label": f"{h12}:00 {am_pm} - {(h12 % 12) + 1}:00 {'PM' if (h + 1) >= 12 and (h + 1) < 24 else 'AM'}",
                "seconds": sec,
                "minutes": round(sec / 60.0, 1),
                "hours": round(sec / 3600.0, 2),
                "plays": cnt,
                "percentage": pct
            })

        peak_h = peak_hour_index
        peak_am_pm = "AM" if peak_h < 12 else "PM"
        peak_h12 = 12 if peak_h % 12 == 0 else peak_h % 12
        next_h = (peak_h + 1) % 24
        next_am_pm = "AM" if next_h < 12 else "PM"
        next_h12 = 12 if next_h % 12 == 0 else next_h % 12
        
        peak_hour_info = {
            "hour": peak_h,
            "label": f"{peak_h12}:00 {peak_am_pm} – {next_h12}:00 {next_am_pm}",
            "seconds": max_hour_sec,
            "hours": round(max_hour_sec / 3600.0, 2),
            "percentage": round((max_hour_sec / total_seconds * 100), 1) if total_seconds > 0 else 0
        }

        # 5. Day of the Week Distribution (Mon to Sun)
        # SQLite strftime('%w') returns 0=Sunday, 1=Monday... 6=Saturday
        dow_rows = conn.execute("""
            SELECT CAST(strftime('%w', datetime(timestamp, ?)) AS INTEGER) as dow,
                   COALESCE(SUM(duration_sec), 0) as total_sec,
                   COUNT(id) as play_count
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY dow
        """, [offset_sql, start_utc, end_utc]).fetchall()
        dow_dict = {r["dow"]: (r["total_sec"], r["play_count"]) for r in dow_rows}

        dow_order = [(1, "Mon", "Monday"), (2, "Tue", "Tuesday"), (3, "Wed", "Wednesday"),
                     (4, "Thu", "Thursday"), (5, "Fri", "Friday"), (6, "Sat", "Saturday"), (0, "Sun", "Sunday")]
        weekday_distribution = []
        for dow_num, short_lbl, full_lbl in dow_order:
            sec, cnt = dow_dict.get(dow_num, (0, 0))
            pct = round((sec / total_seconds * 100), 1) if total_seconds > 0 else 0
            weekday_distribution.append({
                "dow": dow_num,
                "label": short_lbl,
                "full_label": full_lbl,
                "seconds": sec,
                "minutes": round(sec / 60.0, 1),
                "hours": round(sec / 3600.0, 2),
                "plays": cnt,
                "percentage": pct
            })

        # 6. Peak vs Average Summary
        total_timeframe_hours = max(1, int((end_dt - start_dt).total_seconds() / 3600.0))
        avg_hourly_seconds = round(total_seconds / total_timeframe_hours, 1)
        peak_vs_avg = {
            "peak_hour_seconds": max_hour_sec,
            "avg_hourly_seconds": avg_hourly_seconds,
            "peak_vs_avg_ratio": round(max_hour_sec / max(1, avg_hourly_seconds), 2),
            "total_active_hours": sum(1 for dp in hourly_distribution if dp["seconds"] > 0)
        }

        # 7. Top 20 Most Played Songs in Period
        top_song_rows = conn.execute("""
            SELECT track_id, playlist,
                   SUM(duration_sec) as total_seconds,
                   COUNT(id) as play_count,
                   COUNT(DISTINCT username) as unique_listeners,
                   MAX(timestamp) as last_played
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY track_id, playlist
            ORDER BY total_seconds DESC, play_count DESC
            LIMIT 20
        """, date_params).fetchall()

        top_tracks = []
        for r in top_song_rows:
            track_path = r["track_id"]
            name, artist = parse_track_name(track_path)
            top_tracks.append({
                "track_id": track_path,
                "name": name,
                "artist": artist,
                "playlist": r["playlist"] or "Library",
                "total_seconds": r["total_seconds"],
                "hours": round(r["total_seconds"] / 3600.0, 2),
                "play_count": r["play_count"],
                "unique_listeners": r["unique_listeners"],
                "last_played": r["last_played"]
            })

        # 8. Top Artists Leaderboard in Period
        artist_map = {}
        all_period_events = conn.execute("""
            SELECT track_id, duration_sec
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
        """, date_params).fetchall()
        
        for r in all_period_events:
            _, art = parse_track_name(r["track_id"])
            if art not in artist_map:
                artist_map[art] = {"artist": art, "total_seconds": 0, "play_count": 0, "tracks": set()}
            artist_map[art]["total_seconds"] += r["duration_sec"]
            artist_map[art]["play_count"] += 1
            artist_map[art]["tracks"].add(r["track_id"])

        top_artists = []
        for art, data in sorted(artist_map.items(), key=lambda x: (x[1]["total_seconds"], x[1]["play_count"]), reverse=True)[:10]:
            top_artists.append({
                "artist": art,
                "total_seconds": data["total_seconds"],
                "hours": round(data["total_seconds"] / 3600.0, 2),
                "play_count": data["play_count"],
                "track_count": len(data["tracks"]),
                "percentage": round((data["total_seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0
            })

        # 9. Top Playlists in Period
        top_playlist_rows = conn.execute("""
            SELECT COALESCE(playlist, 'Library') as playlist,
                   SUM(duration_sec) as total_seconds,
                   COUNT(id) as play_count,
                   COUNT(DISTINCT track_id) as unique_tracks,
                   COUNT(DISTINCT username) as unique_listeners
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY playlist
            ORDER BY total_seconds DESC
            LIMIT 10
        """, date_params).fetchall()
        
        top_playlists = [{
            "playlist": r["playlist"],
            "total_seconds": r["total_seconds"],
            "hours": round(r["total_seconds"] / 3600.0, 2),
            "play_count": r["play_count"],
            "unique_tracks": r["unique_tracks"],
            "unique_listeners": r["unique_listeners"],
            "percentage": round((r["total_seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0
        } for r in top_playlist_rows]

        # 10. Platform & Device Breakdowns
        device_rows = conn.execute("""
            SELECT COALESCE(device_type, 'desktop') as device_type,
                   SUM(duration_sec) as total_seconds,
                   COUNT(id) as count
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY device_type
            ORDER BY total_seconds DESC
        """, date_params).fetchall()
        device_stats = [{
            "device_type": r["device_type"],
            "total_seconds": r["total_seconds"],
            "count": r["count"],
            "percentage": round((r["total_seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0
        } for r in device_rows]

        os_rows = conn.execute("""
            SELECT COALESCE(os, 'Unknown') as os,
                   SUM(duration_sec) as total_seconds,
                   COUNT(id) as count
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY os
            ORDER BY total_seconds DESC
        """, date_params).fetchall()
        os_stats = [{
            "os": r["os"],
            "total_seconds": r["total_seconds"],
            "count": r["count"],
            "percentage": round((r["total_seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0
        } for r in os_rows]

        browser_rows = conn.execute("""
            SELECT COALESCE(browser, 'Unknown') as browser,
                   SUM(duration_sec) as total_seconds,
                   COUNT(id) as count
            FROM play_events
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY browser
            ORDER BY total_seconds DESC
        """, date_params).fetchall()
        browser_stats = [{
            "browser": r["browser"],
            "total_seconds": r["total_seconds"],
            "count": r["count"],
            "percentage": round((r["total_seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0
        } for r in browser_rows]

        # 11. Audio Format Distribution from Music Directory & Cache
        format_counts = {}
        total_audio_files = 0
        total_library_seconds = 0
        for root, _, files in os.walk(MUSIC_DIR) if os.path.exists(MUSIC_DIR) else []:
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in AUDIO_EXTS:
                    total_audio_files += 1
                    format_name = ext.replace(".", "").upper()
                    format_counts[format_name] = format_counts.get(format_name, 0) + 1

        format_stats = []
        for fmt, cnt in sorted(format_counts.items(), key=lambda x: x[1], reverse=True):
            format_stats.append({
                "format": fmt,
                "count": cnt,
                "percentage": round((cnt / total_audio_files * 100), 1) if total_audio_files > 0 else 0
            })

        # Cache duration aggregate
        cache_dur_row = conn.execute("SELECT COUNT(*) as cache_cnt, COALESCE(SUM(duration), 0) as total_dur FROM track_cache").fetchone()
        total_library_seconds = cache_dur_row["total_dur"] if cache_dur_row else 0

        # 12. Real-time Live Sessions (Active in last 120s)
        live_rows = conn.execute("""
            SELECT id, username, track_id, playlist, device_id, device_name, device_type, browser, os, timestamp, duration_sec
            FROM play_events
            WHERE timestamp >= datetime('now', '-120 seconds')
            ORDER BY timestamp DESC
        """).fetchall()

        live_sessions = []
        for r in live_rows:
            track_path = r["track_id"]
            name, artist = parse_track_name(track_path)
            live_sessions.append({
                "id": r["id"],
                "username": r["username"],
                "track_id": track_path,
                "name": name,
                "artist": artist,
                "playlist": r["playlist"] or "Library",
                "device_id": r["device_id"],
                "device_name": r["device_name"],
                "device_type": r["device_type"],
                "browser": r["browser"],
                "os": r["os"],
                "timestamp": r["timestamp"],
                "duration_sec": r["duration_sec"]
            })

        # 13. System Metrics
        db_size = os.path.getsize(STATS_DB) if os.path.exists(STATS_DB) else 0
        music_size = 0
        if os.path.exists(MUSIC_DIR):
            for root, _, files in os.walk(MUSIC_DIR):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        music_size += os.path.getsize(fp)
                    except Exception:
                        pass

        users_count = len(load_users())
        event_count = conn.execute("SELECT COUNT(*) as cnt FROM play_events").fetchone()["cnt"]

        system_metrics = {
            "total_tracks": total_audio_files,
            "total_playlists": len(os.listdir(MUSIC_DIR)) if os.path.exists(MUSIC_DIR) else 0,
            "total_library_seconds": round(total_library_seconds, 1),
            "total_library_hours": round(total_library_seconds / 3600.0, 1),
            "registered_users": users_count,
            "recorded_events": event_count,
            "db_size_bytes": db_size,
            "music_size_bytes": music_size,
            "cache_entries": cache_dur_row["cache_cnt"] if cache_dur_row else 0
        }

        return jsonify({
            "timeframe": timeframe,
            "start_date": start_query_str,
            "end_date": end_query_str,
            "kpis": {
                "total_seconds": total_seconds,
                "total_hours": round(total_seconds / 3600.0, 2),
                "total_plays": total_plays,
                "unique_listeners": unique_listeners,
                "active_devices": active_devices,
                "avg_daily_seconds": avg_daily_seconds,
                "avg_daily_minutes": round(avg_daily_seconds / 60.0, 1),
                "avg_session_seconds": avg_session_sec,
                "avg_session_minutes": round(avg_session_sec / 60.0, 1),
                "peak_hour": peak_hour_info,
                "peak_vs_avg": peak_vs_avg
            },
            "timeline": timeline,
            "hourly_distribution": hourly_distribution,
            "weekday_distribution": weekday_distribution,
            "top_tracks": top_tracks,
            "top_artists": top_artists,
            "top_playlists": top_playlists,
            "device_stats": device_stats,
            "os_stats": os_stats,
            "browser_stats": browser_stats,
            "format_stats": format_stats,
            "live_sessions": live_sessions,
            "system_metrics": system_metrics,
            "timezone": tz_name
        })
    finally:
        conn.close()

@app.route("/api/admin/logs", methods=["GET"])
@require_admin
def admin_get_logs():
    page = max(1, int(request.args.get("page", 1)))
    limit = min(200, max(10, int(request.args.get("limit", 50))))
    offset = (page - 1) * limit
    username_filter = request.args.get("username", "").strip()
    playlist_filter = request.args.get("playlist", "").strip()
    search = request.args.get("search", "").strip()

    conn = get_db()
    try:
        where_clauses = ["1=1"]
        params = []

        if username_filter:
            where_clauses.append("username = ?")
            params.append(username_filter)
        if playlist_filter:
            where_clauses.append("playlist = ?")
            params.append(playlist_filter)
        if search:
            where_clauses.append("(track_id LIKE ? OR device_name LIKE ? OR browser LIKE ? OR os LIKE ?)")
            pattern = f"%{search}%"
            params.extend([pattern, pattern, pattern, pattern])

        where_sql = " AND ".join(where_clauses)
        
        count_row = conn.execute(f"SELECT COUNT(*) as cnt FROM play_events WHERE {where_sql}", params).fetchone()
        total_count = count_row["cnt"] if count_row else 0

        rows = conn.execute(f"""
            SELECT id, username, track_id, playlist, device_id, device_name, device_type, browser, os, timestamp, duration_sec
            FROM play_events
            WHERE {where_sql}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        events = []
        for r in rows:
            track_path = r["track_id"]
            name, artist = parse_track_name(track_path)
            events.append({
                "id": r["id"],
                "username": r["username"],
                "track_id": track_path,
                "name": name,
                "artist": artist,
                "playlist": r["playlist"] or "Library",
                "device_id": r["device_id"],
                "device_name": r["device_name"],
                "device_type": r["device_type"],
                "browser": r["browser"],
                "os": r["os"],
                "timestamp": r["timestamp"],
                "duration_sec": r["duration_sec"]
            })

        return jsonify({
            "events": events,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": max(1, (total_count + limit - 1) // limit)
        })
    finally:
        conn.close()

@app.route("/api/admin/export", methods=["GET"])
@require_admin
def admin_export_csv():
    tz_obj, tz_name = get_tz_from_request()
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT id, timestamp, username, track_id, playlist, device_name, device_type, browser, os, duration_sec
            FROM play_events
            ORDER BY id DESC
        """).fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Event ID", f"Timestamp ({tz_name})", "Username", "Track Path", "Song Title", "Artist", "Playlist", "Device Name", "Device Type", "Browser", "Operating System", "Duration (Seconds)"])

        for r in rows:
            track_path = r["track_id"]
            name, artist = parse_track_name(track_path)
            writer.writerow([
                r["id"],
                format_timestamp_tz(r["timestamp"], tz_obj),
                r["username"],
                track_path,
                name,
                artist,
                r["playlist"] or "Library",
                r["device_name"],
                r["device_type"],
                r["browser"],
                r["os"],
                r["duration_sec"]
            ])

        csv_data = output.getvalue()
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=sangita_telemetry_{datetime.now(tz_obj).strftime('%Y%m%d_%H%M%S')}.csv",
                "Content-Type": "text/csv; charset=utf-8"
            }
        )
    finally:
        conn.close()

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
            SELECT track_id, playlist, total_seconds, play_count
            FROM user_track_totals
            WHERE username = ?
            ORDER BY total_seconds DESC, play_count DESC
            LIMIT 10
        """, (username,)).fetchall()
    else:
        most_played = conn.execute("""
            SELECT track_id, playlist, SUM(total_seconds) as total_seconds, SUM(play_count) as play_count
            FROM user_track_totals
            GROUP BY track_id, playlist
            ORDER BY total_seconds DESC, play_count DESC
            LIMIT 10
        """).fetchall()
    
    # 3. Platform and Browser Breakdown
    if username:
        device_stats = conn.execute("""
            SELECT device_type, total_seconds
            FROM user_device_totals
            WHERE username = ?
        """, (username,)).fetchall()
        browser_stats = conn.execute("""
            SELECT browser, total_seconds
            FROM user_device_totals
            WHERE username = ?
        """, (username,)).fetchall()
        os_stats = conn.execute("""
            SELECT os, total_seconds
            FROM user_device_totals
            WHERE username = ?
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
    
    tz_obj, tz_name = get_tz_from_request()
    now = datetime.now(tz_obj)
    offset_minutes = get_tz_offset_minutes(tz_obj, now)
    offset_sql = format_tz_offset_sql(offset_minutes)

    conn = get_db()
    time_filter = ""
    params = [username]
    
    if timeframe == "24h":
        start_dt = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
        start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        time_filter = "AND timestamp >= ?"
        params.append(start_utc)
    elif timeframe == "7d":
        start_dt = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        time_filter = "AND timestamp >= ?"
        params.append(start_utc)
    elif timeframe == "30d":
        start_dt = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        time_filter = "AND timestamp >= ?"
        params.append(start_utc)
    elif timeframe == "90d":
        start_dt = (now - timedelta(days=89)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        time_filter = "AND timestamp >= ?"
        params.append(start_utc)
    elif timeframe == "custom" and start_date and end_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, tzinfo=tz_obj)
        end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=tz_obj)
        start_utc = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        end_utc = end_dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        time_filter = "AND timestamp >= ? AND timestamp <= ?"
        params.extend([start_utc, end_utc])
        
    # 1. Total usage time in period
    total_time_row = conn.execute(f"""
        SELECT COALESCE(SUM(duration_sec), 0) as total_seconds,
               COUNT(id) as total_plays
        FROM play_events
        WHERE username = ? {time_filter}
    """, params).fetchone()
    total_seconds = total_time_row["total_seconds"] or 0
    total_plays = total_time_row["total_plays"] or 0
    
    # 2. Last activity / login
    last_login_row = conn.execute("""
        SELECT MAX(last_seen) as last_seen
        FROM user_device_totals
        WHERE username = ?
    """, (username,)).fetchone()
    last_seen = last_login_row["last_seen"] or None
    
    # 3. Average daily use in period
    avg_daily_row = conn.execute(f"""
        SELECT COALESCE(AVG(daily_sum), 0) as avg_seconds
        FROM (
            SELECT date(datetime(timestamp, ?)) as day, SUM(duration_sec) as daily_sum
            FROM play_events
            WHERE username = ? {time_filter}
            GROUP BY day
        )
    """, [offset_sql] + params).fetchone()
    avg_daily_seconds = avg_daily_row["avg_seconds"] or 0
    
    # 4. Most listened tracks in period
    most_played_rows = conn.execute(f"""
        SELECT track_id, playlist, SUM(duration_sec) as total_seconds, COUNT(*) as pings
        FROM play_events
        WHERE username = ? {time_filter}
        GROUP BY track_id, playlist
        ORDER BY total_seconds DESC
        LIMIT 10
    """, params).fetchall()

    most_played = []
    for r in most_played_rows:
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
        most_played.append({
            "track_id": track_path,
            "name": name,
            "artist": artist,
            "playlist": r["playlist"] or "Library",
            "total_seconds": r["total_seconds"],
            "pings": r["pings"]
        })
    
    # 5. Top artists for this user in period
    user_artist_map = {}
    user_period_events = conn.execute(f"""
        SELECT track_id, duration_sec
        FROM play_events
        WHERE username = ? {time_filter}
    """, params).fetchall()
    for r in user_period_events:
        base = os.path.basename(r["track_id"])
        clean_name = os.path.splitext(base)[0]
        art = clean_name.split(" - ", 1)[0].strip() if " - " in clean_name else "Unknown Artist"
        if art not in user_artist_map:
            user_artist_map[art] = {"artist": art, "total_seconds": 0, "play_count": 0}
        user_artist_map[art]["total_seconds"] += r["duration_sec"]
        user_artist_map[art]["play_count"] += 1

    top_artists = sorted(user_artist_map.values(), key=lambda x: (x["total_seconds"], x["play_count"]), reverse=True)[:6]

    # 6. Graph Data: usage grouped by day or hour
    graph_data = []
    if timeframe == "24h":
        rows = conn.execute(f"""
            SELECT strftime('%H:00', datetime(timestamp, ?)) as label, SUM(duration_sec) as seconds, COUNT(id) as plays
            FROM play_events
            WHERE username = ? {time_filter}
            GROUP BY label
            ORDER BY label ASC
        """, [offset_sql] + params).fetchall()
        graph_data = [dict(r) for r in rows]
    else:
        rows = conn.execute(f"""
            SELECT date(datetime(timestamp, ?)) as label, SUM(duration_sec) as seconds, COUNT(id) as plays
            FROM play_events
            WHERE username = ? {time_filter}
            GROUP BY label
            ORDER BY label ASC
        """, [offset_sql] + params).fetchall()
        graph_data = [dict(r) for r in rows]

    # 7. Device History
    devices = conn.execute("""
        SELECT device_id, device_name, device_type, browser, os, last_seen, total_seconds
        FROM user_device_totals
        WHERE username = ?
        ORDER BY last_seen DESC
    """, (username,)).fetchall()

    # 8. Data Consumed
    today_str = now.strftime('%Y-%m-%d')
    daily_row = conn.execute("""
        SELECT bytes_consumed, stream_requests
        FROM user_daily_data
        WHERE username = ? AND date = ?
    """, (username, today_str)).fetchone()
    today_bytes = daily_row["bytes_consumed"] if daily_row else 0

    tot_row = conn.execute("SELECT total_bytes FROM user_totals WHERE username = ?", (username,)).fetchone()
    total_bytes = (tot_row["total_bytes"] if tot_row and "total_bytes" in tot_row.keys() and tot_row["total_bytes"] is not None else 0)
        
    conn.close()
    
    return jsonify({
        "username": username,
        "role": u.get("role", "user"),
        "rules": u.get("rules", {"allowed_playlists": ["*"]}),
        "timezone": tz_name,
        "total_seconds": total_seconds,
        "total_plays": total_plays,
        "avg_daily_seconds": avg_daily_seconds,
        "last_seen": last_seen,
        "most_played": most_played,
        "top_artists": top_artists,
        "graph_data": graph_data,
        "devices": [dict(r) for r in devices],
        "data_consumed_today": {
            "bytes": today_bytes,
            "formatted": format_bytes(today_bytes),
            "date": today_str
        },
        "data_consumed_total": {
            "bytes": total_bytes,
            "formatted": format_bytes(total_bytes)
        }
    })

# ---------------------------------------------------------------------------
# Synced Lyrics Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/lyrics/<path:filepath>", methods=["GET"])
@require_auth
def get_track_lyrics(filepath):
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

    full_audio = os.path.join(MUSIC_DIR, safe)
    real_music_dir = os.path.realpath(MUSIC_DIR)
    real_audio = os.path.realpath(full_audio)
    if not (real_audio == real_music_dir or real_audio.startswith(real_music_dir + os.sep)):
        abort(403)

    lrc_path = os.path.splitext(full_audio)[0] + ".lrc"
    real_lrc = os.path.realpath(lrc_path)
    if not (real_lrc == real_music_dir or real_lrc.startswith(real_music_dir + os.sep)):
        abort(403)

    if os.path.isfile(lrc_path) and os.path.getsize(lrc_path) > 0:
        try:
            with open(lrc_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            resp = jsonify({"has_lyrics": True, "raw": content, "filepath": safe})
            resp.headers["Cache-Control"] = "public, max-age=300"
            return resp
        except Exception as e:
            return jsonify({"has_lyrics": False, "raw": "", "error": str(e)}), 200

    return jsonify({"has_lyrics": False, "raw": "", "filepath": safe}), 200


def _get_lyrics_node_config():
    cfg_file = os.path.join(DATA_DIR, "lyrics_node_config.json")
    if os.path.isfile(cfg_file):
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _update_lyrics_node_config(updates):
    try:
        cfg = _get_lyrics_node_config()
        cfg.update(updates)
        cfg_file = os.path.join(DATA_DIR, "lyrics_node_config.json")
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        return cfg
    except Exception:
        return {}


@app.route("/api/admin/lyrics/status", methods=["GET"])
@require_admin
def admin_lyrics_status():
    status_file = os.path.join(DATA_DIR, "lyrics_status.json")
    status_data = {
        "state": "idle",
        "pid": None,
        "current_index": 0,
        "total_songs": 0,
        "current_song": "",
        "current_stage": "idle",
        "eta_seconds": 0,
        "counts": {"skipped_existing": 0, "embedded": 0, "lrclib": 0, "whisper": 0, "failed": 0}
    }

    if os.path.isfile(status_file):
        try:
            with open(status_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    status_data = loaded
        except Exception:
            pass

    # Verify process liveness
    worker_pid = status_data.get("pid")
    is_alive = False
    worker_cpu = 0.0
    worker_ram_mb = 0.0

    try:
        import psutil
        if worker_pid and psutil.pid_exists(worker_pid):
            try:
                proc = psutil.Process(worker_pid)
                if proc.is_running() and proc.status() != psutil.STATUS_ZOMBIE:
                    is_alive = True
                    worker_cpu = proc.cpu_percent(interval=None)
                    worker_ram_mb = round(proc.memory_info().rss / (1024 * 1024), 1)
            except Exception:
                is_alive = False

        if not is_alive and status_data.get("state") == "running":
            status_data["state"] = "stopped"
            status_data["current_stage"] = "stopped"

        # Host system metrics
        mem = psutil.virtual_memory()
        cpu_perc = psutil.cpu_percent(interval=None)
        per_core = psutil.cpu_percent(interval=None, percpu=True)
        cpu_count = psutil.cpu_count(logical=True) or 1

        resources = {
            "host_cpu_percent": cpu_perc,
            "per_core_percent": per_core,
            "host_ram_used_mb": round(mem.used / (1024 * 1024), 1),
            "host_ram_total_mb": round(mem.total / (1024 * 1024), 1),
            "host_ram_percent": mem.percent,
            "cpu_count": cpu_count,
            "worker_is_alive": is_alive,
            "worker_cpu_percent": worker_cpu,
            "worker_ram_mb": worker_ram_mb
        }
    except Exception as e:
        resources = {
            "host_cpu_percent": 0,
            "per_core_percent": [],
            "host_ram_used_mb": 0,
            "host_ram_total_mb": 4096,
            "host_ram_percent": 0,
            "cpu_count": 4,
            "worker_is_alive": is_alive,
            "worker_cpu_percent": 0,
            "worker_ram_mb": 0,
            "error": str(e)
        }

    node_cfg = _get_lyrics_node_config()
    saved_remote_url = node_cfg.get("remote_whisper_url", "")
    saved_only_gpu = bool(node_cfg.get("only_remote_gpu", False))
    saved_model_source = node_cfg.get("model_source", "online")
    saved_ephemeral_ram = bool(node_cfg.get("ephemeral_ram", True))

    return jsonify({
        "job": status_data,
        "resources": resources,
        "remote_whisper_url": saved_remote_url,
        "only_remote_gpu": saved_only_gpu,
        "model_source": saved_model_source,
        "ephemeral_ram": saved_ephemeral_ram,
        "model": node_cfg.get("model", "small"),
        "compute_type": node_cfg.get("compute_type", "auto"),
        "cooldown_sec": float(node_cfg.get("cooldown_sec", 0.5)),
        "cpu_threads": int(node_cfg.get("cpu_threads", 2)),
        "max_ram_mb": int(node_cfg.get("max_ram_mb", 4096)),
        "low_priority": bool(node_cfg.get("low_priority", True)),
        "remote_settings": node_cfg.get("remote_settings", {})
    })


@app.route("/api/lyrics/model/<model_name>/info", methods=["GET"])
def lyrics_model_info(model_name):
    """Returns availability and file metadata for cached Whisper models on this server (Items 3, 9)."""
    if not _is_authorized_node_or_admin():
        return jsonify({"error": "Unauthorized"}), 401
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", model_name) or ".." in model_name:
        return jsonify({"error": "Invalid model name"}), 400

    import glob
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    model_dir = os.path.join(cache_dir, f"models--Systran--faster-whisper-{model_name}")
    if not os.path.isdir(model_dir):
        return jsonify({"available": False, "model": model_name, "files": []}), 404

    snapshots = glob.glob(os.path.join(model_dir, "snapshots", "*"))
    target_dir = snapshots[0] if snapshots else model_dir
    files = {}
    for req_file in ["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"]:
        fpath = os.path.join(target_dir, req_file)
        if os.path.isfile(fpath):
            files[req_file] = os.path.getsize(fpath)

    total_mb = round(sum(files.values()) / (1024 * 1024), 1)
    return jsonify({
        "available": len(files) >= 3,
        "model": model_name,
        "total_mb": total_mb,
        "files": files
    })


@app.route("/api/lyrics/model/<model_name>/<filename>", methods=["GET"])
def lyrics_model_download_file(model_name, filename):
    """Serves a model file directly from server cache to authorized worker nodes (Items 3, 9, 15)."""
    if not _is_authorized_node_or_admin():
        return jsonify({"error": "Unauthorized"}), 401
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", model_name) or ".." in model_name:
        return jsonify({"error": "Invalid model name"}), 400
    if filename not in ["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"]:
        return jsonify({"error": "Invalid model file requested"}), 400

    import glob
    from flask import send_file
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    model_dir = os.path.join(cache_dir, f"models--Systran--faster-whisper-{model_name}")
    snapshots = glob.glob(os.path.join(model_dir, "snapshots", "*"))
    target_dir = snapshots[0] if snapshots else model_dir
    fpath = os.path.join(target_dir, filename)

    real_cache = os.path.realpath(cache_dir)
    real_fpath = os.path.realpath(fpath)
    if not (real_fpath == real_cache or real_fpath.startswith(real_cache + os.sep)):
        return jsonify({"error": "Invalid file path"}), 403

    if not os.path.isfile(fpath):
        return jsonify({"error": f"File '{filename}' not found for model '{model_name}'"}), 404

    return send_file(real_fpath, as_attachment=True, download_name=filename)


@app.route("/api/admin/lyrics/test-remote", methods=["POST"])
@require_admin
def admin_lyrics_test_remote():
    import time
    import requests
    data = request.get_json(silent=True) or {}
    raw_url = data.get("url") if "url" in data else data.get("remote_whisper_url")
    if raw_url is not None:
        url = str(raw_url).strip()
    else:
        node_cfg = _get_lyrics_node_config()
        url = str(node_cfg.get("remote_whisper_url", "")).strip()

    if not url:
        return jsonify({"online": False, "error": "No remote URL provided"}), 400

    clean_url = url.rstrip("/")
    start_t = time.time()
    try:
        res = requests.get(f"{clean_url}/health", timeout=3.5)
        latency_ms = int((time.time() - start_t) * 1000)
        if res.status_code == 200:
            info = res.json()
            # Remember URL & node limits for user convenience
            _update_lyrics_node_config({
                "remote_whisper_url": clean_url,
                "remote_settings": info.get("limits", {})
            })

            return jsonify({
                "online": True,
                "latency_ms": latency_ms,
                "device": info.get("device", "unknown"),
                "gpu_name": info.get("gpu_name", "Unknown GPU"),
                "has_cuda": info.get("has_cuda", False),
                "cuda_runtime_ready": info.get("cuda_runtime_ready", False),
                "status_msg": info.get("status_msg", "Ready"),
                "total_vram_mb": info.get("total_vram_mb", 0),
                "used_vram_mb": info.get("used_vram_mb", 0),
                "gpu_util_pct": info.get("gpu_util_pct", info.get("gpu", {}).get("gpu_util_pct", 0)),
                "active_job": info.get("active_job", "idle"),
                "model_status": info.get("model_status", {}),
                "ram_mode": info.get("ram_mode", False),
                "storage_mode": info.get("storage_mode", "RAM (Ephemeral)"),
                "limits": info.get("limits", {}),
                "cpu": info.get("cpu", {}),
                "ram": info.get("ram", {}),
                "gpu": info.get("gpu", {}),
                "specs": info.get("specs", {}),
                "throughput": info.get("throughput", {})
            })
        else:
            return jsonify({
                "online": False,
                "error": f"Server responded with HTTP {res.status_code}"
            }), 200
    except Exception as e:
        return jsonify({
            "online": False,
            "error": f"Unreachable ({e})"
        }), 200


@app.route("/api/admin/lyrics/remote-telemetry", methods=["GET", "POST"])
@require_admin
def admin_lyrics_remote_telemetry():
    """Fetches real-time hardware telemetry and specs from the connected remote PC Whisper node."""
    import time
    import requests
    node_cfg = _get_lyrics_node_config()
    data = request.get_json(silent=True) or {} if request.method == "POST" else {}
    raw_url = data.get("url") if "url" in data else request.args.get("url")

    if raw_url is not None:
        url = str(raw_url).strip()
    else:
        url = str(node_cfg.get("remote_whisper_url", "")).strip()

    if not url:
        return jsonify({"online": False, "error": "No remote Whisper URL configured"}), 400


    clean_url = url.rstrip("/")
    start_t = time.time()
    try:
        res = requests.get(f"{clean_url}/health", timeout=3.0)
        latency_ms = int((time.time() - start_t) * 1000)
        if res.status_code == 200:
            info = res.json()
            return jsonify({
                "online": True,
                "latency_ms": latency_ms,
                "specs": info.get("specs", {}),
                "cpu": info.get("cpu", {}),
                "ram": info.get("ram", {}),
                "gpu": info.get("gpu", {}),
                "limits": info.get("limits", {}),
                "throughput": info.get("throughput", {}),
                "active_job": info.get("active_job", "idle"),
                "storage_mode": info.get("storage_mode", "RAM (Ephemeral)"),
                "total_vram_mb": info.get("total_vram_mb", 0),
                "used_vram_mb": info.get("used_vram_mb", 0),
                "gpu_util_pct": info.get("gpu_util_pct", info.get("gpu", {}).get("gpu_util_pct", 0)),
                "gpu_name": info.get("gpu_name", "Unknown GPU"),
                "has_cuda": info.get("has_cuda", False),
                "cuda_runtime_ready": info.get("cuda_runtime_ready", False)
            })
        return jsonify({"online": False, "error": f"Remote node returned HTTP {res.status_code}"}), 200
    except Exception as e:
        return jsonify({"online": False, "error": str(e)}), 200



@app.route("/api/admin/lyrics/remote-prime", methods=["POST"])
@require_admin
def admin_lyrics_remote_prime():
    """Triggers model pre-warming and RAM streaming directly on the remote PC GPU node."""
    import requests
    data = request.get_json(silent=True) or {}
    node_cfg = _get_lyrics_node_config()
    url = (data.get("url") or data.get("node_url") or data.get("remote_whisper_url") or node_cfg.get("remote_whisper_url") or "").strip()
    if not url:
        return jsonify({"success": False, "error": "No remote PC Whisper URL provided"}), 400

    clean_url = url.rstrip("/")
    model = (data.get("model") or node_cfg.get("model") or "small").strip()
    source = (data.get("source") or data.get("model_source") or node_cfg.get("model_source") or "online").strip()
    compute_type = (data.get("compute_type") or node_cfg.get("compute_type") or "auto").strip()
    ram_mode = bool(data.get("ram_mode", data.get("ephemeral_ram", node_cfg.get("ephemeral_ram", True))))

    server_url = (data.get("server_url") or "").strip()
    if not server_url and source == "server":
        server_url = request.host_url.rstrip("/")

    payload = {
        "model": model,
        "source": source,
        "server_url": server_url,
        "compute_type": compute_type,
        "ram_mode": ram_mode
    }

    _update_lyrics_node_config({
        "remote_whisper_url": clean_url,
        "model": model,
        "model_source": source,
        "compute_type": compute_type,
        "ephemeral_ram": ram_mode
    })

    try:
        res = requests.post(f"{clean_url}/api/model/load", json=payload, timeout=120)
        resp_data = res.json() if res.status_code == 200 else {"error": res.text}
        return jsonify(resp_data), res.status_code
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to prime remote node: {e}"}), 502


@app.route("/api/admin/lyrics/remote-purge", methods=["POST"])
@require_admin
def admin_lyrics_remote_purge():
    """Wipes VRAM and cleans all ephemeral RAM-disk files on the remote PC node."""
    import requests
    data = request.get_json(silent=True) or {}
    node_cfg = _get_lyrics_node_config()
    url = (data.get("url") or data.get("node_url") or data.get("remote_whisper_url") or node_cfg.get("remote_whisper_url") or "").strip()
    if not url:
        return jsonify({"success": False, "error": "No remote PC Whisper URL provided"}), 400

    clean_url = url.rstrip("/")
    try:
        res = requests.post(f"{clean_url}/api/model/purge", json={}, timeout=15)
        resp_data = res.json() if res.status_code == 200 else {"error": res.text}
        return jsonify(resp_data), res.status_code
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to purge remote node: {e}"}), 502


@app.route("/api/admin/lyrics/remote-settings", methods=["GET", "POST"])
@require_admin
def admin_lyrics_remote_settings():
    """Synchronizes or reads hardware safeguards (CPU threads, RAM limit, GPU cooldown) on the remote PC."""
    import requests
    node_cfg = _get_lyrics_node_config()

    if request.method == "GET":
        url = (request.args.get("url") or request.args.get("node_url") or node_cfg.get("remote_whisper_url") or "").strip()
        if not url:
            return jsonify({"error": "No remote PC Whisper URL provided"}), 400
        clean_url = url.rstrip("/")
        try:
            res = requests.get(f"{clean_url}/api/settings", timeout=5)
            if res.status_code == 200:
                settings_data = res.json()
                _update_lyrics_node_config({"remote_settings": settings_data.get("limits", {})})
                return jsonify(settings_data)
            return jsonify({"error": f"Remote node returned HTTP {res.status_code}"}), res.status_code
        except Exception as e:
            return jsonify({"error": f"Unreachable remote node: {e}"}), 502

    # POST
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or data.get("node_url") or data.get("remote_whisper_url") or node_cfg.get("remote_whisper_url") or "").strip()
    if not url:
        return jsonify({"success": False, "error": "No remote PC Whisper URL provided"}), 400

    clean_url = url.rstrip("/")
    forward_keys = ["cpu_threads", "max_ram_mb", "cooldown_sec", "low_priority", "compute_type"]
    node_payload = {k: data[k] for k in forward_keys if k in data}

    saved_updates = dict(node_payload)
    saved_updates["remote_whisper_url"] = clean_url
    _update_lyrics_node_config(saved_updates)

    try:
        res = requests.post(f"{clean_url}/api/settings", json=node_payload, timeout=8)
        resp_data = res.json() if res.status_code == 200 else {"error": res.text}
        return jsonify(resp_data), res.status_code
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to update remote settings: {e}"}), 502


@app.route("/api/admin/lyrics/start", methods=["POST"])
@require_admin
def admin_lyrics_start():
    import psutil
    status_file = os.path.join(DATA_DIR, "lyrics_status.json")
    if os.path.isfile(status_file):
        try:
            with open(status_file, "r") as f:
                cur = json.load(f)
                pid = cur.get("pid")
                if pid and psutil.pid_exists(pid):
                    p = psutil.Process(pid)
                    if p.is_running() and p.status() != psutil.STATUS_ZOMBIE and cur.get("state") == "running":
                        return jsonify({"error": "Lyrics worker is already running", "pid": pid}), 409
        except Exception:
            pass

    data = request.get_json(silent=True) or {}
    model = data.get("model", "small")
    language = data.get("language", "auto")
    cores = int(data.get("cores", 2))
    max_ram_mb = int(data.get("max_ram_mb", 4096))
    limit = int(data.get("limit", 0))
    song = data.get("song")
    playlist = data.get("playlist")
    force = bool(data.get("force", False))
    demucs = bool(data.get("demucs", False))
    api = bool(data.get("api", True))
    remote_whisper_url = str(data.get("remote_whisper_url") or data.get("remote_url") or "").strip()
    only_remote_gpu = bool(data.get("only_remote_gpu", False))
    model_source = str(data.get("model_source", "online")).strip()
    ephemeral_ram = bool(data.get("ephemeral_ram", True))

    worker_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lyrics_worker.py")
    cmd = [
        sys.executable,
        worker_script,
        "--music-dir", MUSIC_DIR,
        "--data-dir", DATA_DIR,
        "--model", model,
        "--language", language,
        "--cores", str(cores),
        "--max-ram-mb", str(max_ram_mb)
    ]
    if limit > 0:
        cmd.extend(["--limit", str(limit)])
    if song:
        cmd.extend(["--song", str(song).strip()])
    elif playlist:
        cmd.extend(["--playlist", str(playlist).strip()])
    if force:
        cmd.append("--force")
    if demucs:
        cmd.append("--demucs")
    if not api:
        cmd.append("--no-api")
    if remote_whisper_url:
        cmd.extend(["--remote-whisper-url", remote_whisper_url])
        if model_source:
            cmd.extend(["--model-source", model_source])
            if model_source == "server":
                server_base = (data.get("server_url") or request.host_url).rstrip("/")
                cmd.extend(["--server-url", server_base])
        if ephemeral_ram:
            cmd.append("--ephemeral-ram")
    if only_remote_gpu:
        cmd.append("--only-remote-gpu")

    if remote_whisper_url or "only_remote_gpu" in data or "model_source" in data:
        updates = {
            "only_remote_gpu": only_remote_gpu,
            "model_source": model_source,
            "ephemeral_ram": ephemeral_ram,
            "model": model
        }
        if remote_whisper_url:
            updates["remote_whisper_url"] = remote_whisper_url
        _update_lyrics_node_config(updates)

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        return jsonify({
            "status": "started",
            "pid": proc.pid,
            "config": {
                "api": api, "model": model, "language": language, "cores": cores,
                "max_ram_mb": max_ram_mb, "limit": limit, "song": song, "playlist": playlist,
                "force": force, "demucs": demucs, "remote_whisper_url": remote_whisper_url
            }
        }), 202
    except Exception as e:
        return jsonify({"error": f"Failed to start worker: {e}"}), 500


@app.route("/api/admin/lyrics/stop", methods=["POST"])
@require_admin
def admin_lyrics_stop():
    status_file = os.path.join(DATA_DIR, "lyrics_status.json")
    pid = None
    if os.path.isfile(status_file):
        try:
            with open(status_file, "r") as f:
                cur = json.load(f)
                pid = cur.get("pid")
        except Exception:
            pass

    if pid:
        try:
            import psutil
            if psutil.pid_exists(pid):
                p = psutil.Process(pid)
                p.terminate()
                try:
                    p.wait(timeout=3)
                except psutil.TimeoutExpired:
                    p.kill()
        except Exception as e:
            print(f"[Worker Stop Error] {e}")

    # Mark status as stopped
    if os.path.isfile(status_file):
        try:
            with open(status_file, "r") as f:
                cur = json.load(f)
            cur["state"] = "stopped"
            cur["current_stage"] = "stopped"
            with open(status_file, "w") as f:
                json.dump(cur, f, indent=2)
        except Exception:
            pass

    return jsonify({"status": "stopped"})


@app.route("/api/admin/lyrics/logs", methods=["GET"])
@require_admin
def admin_lyrics_logs():
    limit = min(500, max(10, int(request.args.get("limit", 100))))
    report_file = os.path.join(DATA_DIR, "lyrics_report.csv")
    if not os.path.isfile(report_file):
        return jsonify({"logs": [], "total": 0})

    rows = []
    try:
        with open(report_file, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    except Exception as e:
        return jsonify({"logs": [], "error": str(e)})

    rows.reverse()
    return jsonify({
        "logs": rows[:limit],
        "total": len(rows)
    })


@app.route("/api/admin/lyrics/edit", methods=["PUT"])
@require_admin
def admin_lyrics_edit():
    import urllib.parse
    data = request.get_json(silent=True) or {}
    filepath = data.get("filepath", "").strip()
    content = data.get("content", "")

    if not filepath:
        return jsonify({"error": "filepath is required"}), 400

    safe = os.path.normpath(urllib.parse.unquote(filepath))
    if safe.startswith("..") or safe.startswith("/"):
        abort(403)

    full_audio = os.path.join(MUSIC_DIR, safe)
    real_music_dir = os.path.realpath(MUSIC_DIR)
    real_audio = os.path.realpath(full_audio)
    if not (real_audio == real_music_dir or real_audio.startswith(real_music_dir + os.sep)):
        abort(403)

    lrc_path = os.path.splitext(full_audio)[0] + ".lrc"
    real_lrc = os.path.realpath(lrc_path)
    if not (real_lrc == real_music_dir or real_lrc.startswith(real_music_dir + os.sep)):
        abort(403)

    try:
        os.makedirs(os.path.dirname(os.path.abspath(lrc_path)), exist_ok=True)
        with open(lrc_path, "w", encoding="utf-8") as f:
            f.write(content.strip() + "\n")
        return jsonify({"status": "saved", "filepath": safe, "bytes": len(content)})
    except Exception as e:
        return jsonify({"error": f"Failed to save lyrics: {e}"}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "static"))
    if not os.path.isdir(static_dir):
        return jsonify({"status": "Sangita Backend API is running", "version": "1.0.0"}), 200
    if path:
        safe_path = os.path.normpath(path)
        if safe_path.startswith("..") or safe_path.startswith("/"):
            abort(403)
        full_path = os.path.join(static_dir, safe_path)
        real_static = os.path.realpath(static_dir)
        real_target = os.path.realpath(full_path)
        if not (real_target == real_static or real_target.startswith(real_static + os.sep)):
            abort(403)
        if os.path.isfile(full_path):
            return send_from_directory(static_dir, safe_path)
    index_file = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_file):
        return send_from_directory(static_dir, "index.html")
    return jsonify({"status": "Sangita Backend API is running", "version": "1.0.0"}), 200

# Error handlers to prevent diagnostic artifact / stack trace leaks (Items 7, 9)
@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad request"}), 400

@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden"}), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(429)
def too_many_requests(e):
    return jsonify({"error": "Too many requests. Please slow down."}), 429

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)


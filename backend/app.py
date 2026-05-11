import os
import hmac
import hashlib
import time
import json
import base64
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, abort
 
app = Flask(__name__, static_folder="static", static_url_path="/")
 
MUSIC_DIR  = os.environ.get("MUSIC_DIR", "./music")
USERNAME   = os.environ.get("SANGITA_USER", "admin")
PASSWORD   = os.environ.get("SANGITA_PASS", "sangita123")
SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret")
TOKEN_TTL  = 86400 * 7
 
AUDIO_EXTS = (".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus")
 
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
        return payload.get("u")
    except Exception:
        return None
 
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get("Authorization", "").replace("Bearer ", "")
        token = header or request.args.get("token", "")
        if not _verify_token(token):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated
 
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    if data.get("username") == USERNAME and data.get("password") == PASSWORD:
        return jsonify({"token": _make_token(data["username"]), "username": USERNAME})
    return jsonify({"error": "Invalid username or password"}), 401
 
@app.route("/api/playlists")
@require_auth
def get_playlists():
    result = {}
    if not os.path.exists(MUSIC_DIR):
        return jsonify(result)
    root_tracks = sorted([
        f for f in os.listdir(MUSIC_DIR)
        if os.path.isfile(os.path.join(MUSIC_DIR, f)) and f.lower().endswith(AUDIO_EXTS)
    ])
    if root_tracks:
        result["Library"] = root_tracks
    for folder in sorted(os.listdir(MUSIC_DIR)):
        folder_path = os.path.join(MUSIC_DIR, folder)
        if os.path.isdir(folder_path):
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
    full_path = os.path.join(MUSIC_DIR, safe)
    if not os.path.isfile(full_path):
        abort(404)
    return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path), conditional=True)
 
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    static_dir = app.static_folder
    if path and os.path.exists(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    return send_from_directory(static_dir, "index.html")
 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

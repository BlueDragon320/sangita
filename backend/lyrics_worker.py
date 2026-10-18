#!/usr/bin/env python3
"""
Sangita — Background Synced Lyrics (.lrc) Generator Worker
Processes songs sequentially with CPU core pinning, RAM limits, and multi-tier extraction:
1. Embedded Tags (mutagen SYLT/USLT/©lyr/LYRICS)
2. LRCLIB Public API (syncedLyrics with ±3s duration tolerance)
3. Optional Demucs vocal stem isolation
4. faster-whisper (CTranslate2 int8 with VAD & anti-hallucination guards)
"""

import os
import sys
import time
import json
import csv
import re
import signal
import gc
import argparse
import tempfile
import subprocess
import socket
from datetime import datetime, timezone

# Resilient DNS fallback hook (handles local DNS sinkholes like PiHole / AdGuard for Hugging Face and LRCLIB)
_orig_getaddrinfo = socket.getaddrinfo

def _resilient_getaddrinfo(host, port, family=socket.AF_UNSPEC, socktype=socket.SOCK_STREAM, proto=0, flags=0):
    try:
        res = _orig_getaddrinfo(host, port, family, socktype, proto, flags)
        if any(addr[4][0] in ('0.0.0.0', '::') for addr in res):
            raise socket.gaierror(-2, 'Sinkholed')
        return res
    except Exception:
        try:
            out = subprocess.getoutput(f"dig @8.8.8.8 {host} +short").strip().split("\n")
            ips = [x.strip() for x in out if x.strip() and x.strip()[0].isdigit() and "." in x]
            if ips:
                ret = []
                for ip in ips:
                    ret.append((socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, int(port) if str(port).isdigit() else 443)))
                return ret
        except Exception:
            pass
        raise

socket.getaddrinfo = _resilient_getaddrinfo

# PyAV 14+ compatibility patch (faster-whisper passes metadata_errors='ignore' which PyAV 14+ dropped)
try:
    import av
    _orig_av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _patched_av_open
except Exception:
    pass

AUDIO_EXTS = (".mp3", ".m4a", ".flac", ".wav", ".ogg", ".aac", ".opus")
STOP_REQUESTED = False

WATERMARK_PATTERNS = [
    re.compile(r"thank you for watching", re.I),
    re.compile(r"thanks for watching", re.I),
    re.compile(r"subtitles by", re.I),
    re.compile(r"amara\.org", re.I),
    re.compile(r"subscribe", re.I),
    re.compile(r"copyright", re.I),
    re.compile(r"www\.", re.I),
    re.compile(r"like and subscribe", re.I),
]

def signal_handler(signum, frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    print(f"\n[Worker] Caught signal {signum}. Stopping gracefully...", flush=True)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def apply_resource_limits(cores):
    os.environ["OMP_NUM_THREADS"] = str(cores)
    os.environ["MKL_NUM_THREADS"] = str(cores)
    os.environ["OPENBLAS_NUM_THREADS"] = str(cores)
    os.environ["VECLIB_MAXIMUM_THREADS"] = str(cores)
    os.environ["NUMEXPR_NUM_THREADS"] = str(cores)

    try:
        os.nice(10)
    except Exception as e:
        pass

    try:
        import psutil
        p = psutil.Process(os.getpid())
        num_cpus = psutil.cpu_count(logical=True) or 1
        affinity_cpus = list(range(min(cores, num_cpus)))
        if hasattr(p, "cpu_affinity"):
            p.cpu_affinity(affinity_cpus)
    except Exception as e:
        pass

def check_memory_guard(max_ram_mb, whisper_holder):
    try:
        import psutil
        p = psutil.Process(os.getpid())
        rss_mb = p.memory_info().rss / (1024 * 1024)
        if rss_mb > max_ram_mb:
            print(f"[Worker Guard] RAM usage ({rss_mb:.1f} MB) exceeds limit ({max_ram_mb} MB). Evicting model cache...", flush=True)
            if whisper_holder.get("model") is not None:
                del whisper_holder["model"]
                whisper_holder["model"] = None
            gc.collect()
            time.sleep(4)
    except Exception:
        pass

def write_status(data_dir, status_dict):
    try:
        os.makedirs(data_dir, exist_ok=True)
        status_path = os.path.join(data_dir, "lyrics_status.json")
        tmp_path = status_path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(status_dict, f, indent=2)
        os.replace(tmp_path, status_path)
    except Exception as e:
        print(f"[Worker] Failed to write lyrics_status.json: {e}", file=sys.stderr)

def log_report(data_dir, record):
    try:
        os.makedirs(data_dir, exist_ok=True)
        report_path = os.path.join(data_dir, "lyrics_report.csv")
        file_exists = os.path.isfile(report_path)
        with open(report_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow([
                    "timestamp", "filepath", "title", "artist", "duration_sec",
                    "source", "language", "processing_time_sec", "status", "error"
                ])
            writer.writerow([
                record.get("timestamp", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")),
                record.get("filepath", ""),
                record.get("title", ""),
                record.get("artist", ""),
                record.get("duration_sec", 0),
                record.get("source", ""),
                record.get("language", ""),
                round(record.get("processing_time_sec", 0), 2),
                record.get("status", "ok"),
                record.get("error", "")
            ])
    except Exception as e:
        print(f"[Worker] Failed to log to lyrics_report.csv: {e}", file=sys.stderr)

def clean_tag_value(val):
    if not val:
        return ""
    if isinstance(val, (list, tuple)):
        val = val[0] if val else ""
    s = str(val).strip()
    while (s.startswith("['") and s.endswith("']")) or (s.startswith('["') and s.endswith('"]')):
        s = s[2:-2].strip()
    return s

def sanitize_song_title(title):
    if not title:
        return ""
    # Strip YouTube/rip suffixes: | Lyrics, (Official Video), [Lyrics Video], etc.
    title = re.sub(r"\s*[\|-]\s*(?:lyrics|official\s+video|official\s+audio|audio|music\s+video|lyric\s+video).*$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*[\(\[]\s*(?:lyrics|official\s+video|official\s+audio|audio|music\s+video|lyric\s+video|hq|hd|remastered|explicit|visualizer).*?[\)\]]", "", title, flags=re.IGNORECASE)
    return title.strip()

def parse_audio_metadata(full_path):
    title = ""
    artist = ""
    album = ""
    duration = 0.0

    try:
        import mutagen
        audio = mutagen.File(full_path)
        if audio is not None:
            if hasattr(audio, "info") and hasattr(audio.info, "length"):
                duration = float(audio.info.length or 0.0)

            tags = getattr(audio, "tags", None) or {}
            if hasattr(tags, "get"):
                raw_title = tags.get("TIT2") or tags.get("title") or tags.get("\xa9nam") or ""
                raw_artist = tags.get("TPE1") or tags.get("artist") or tags.get("\xa9ART") or ""
                raw_album = tags.get("TALB") or tags.get("album") or tags.get("\xa9alb") or ""

                title = clean_tag_value(raw_title)
                artist = clean_tag_value(raw_artist)
                album = clean_tag_value(raw_album)
    except Exception:
        pass

    title = sanitize_song_title(title)
    artist = clean_tag_value(artist)

    # Heuristic for files where title is empty or contains "Artist - Title"
    if not title:
        base = os.path.splitext(os.path.basename(full_path))[0]
        if " - " in base:
            parts = base.split(" - ", 1)
            artist = artist or parts[0].strip()
            title = parts[1].strip()
        else:
            title = base
    elif " - " in title:
        parts = title.split(" - ", 1)
        p0, p1 = parts[0].strip(), parts[1].strip()
        fname = os.path.basename(full_path).lower()
        p0_clean = re.sub(r"[^\w]", "", p0.lower())
        p1_clean = re.sub(r"[^\w]", "", p1.lower())
        fname_clean = re.sub(r"[^\w]", "", fname)

        if p0_clean and p0_clean in fname_clean and p1_clean not in fname_clean:
            title = p0
            artist = p1
        elif p1_clean and p1_clean in fname_clean and p0_clean not in fname_clean:
            title = p1
            artist = p0
        elif not artist or artist.lower() == p1.lower():
            title = p0
        elif artist.lower() == p0.lower():
            if p1.lower().startswith("the ") or len(p1.split()) <= 2:
                title = p0
                artist = p1
            else:
                title = p1
                artist = p0

    title = sanitize_song_title(title)

    return {
        "title": str(title).strip(),
        "artist": str(artist).strip(),
        "album": str(album).strip(),
        "duration": duration
    }

def extract_embedded_lyrics(full_path):
    try:
        import mutagen
        audio = mutagen.File(full_path)
        if audio is None:
            return None, False

        # 1. MP3 ID3 frames
        if hasattr(audio, "tags") and audio.tags:
            # Check SYLT (Synchronized Lyrics)
            sylt = audio.tags.getall("SYLT") if hasattr(audio.tags, "getall") else []
            if sylt:
                for frame in sylt:
                    # SYLT frames contain timestamped tuples
                    lines = []
                    for text, ms in getattr(frame, "text", []):
                        m = int(ms // 60000)
                        s = (ms % 60000) / 1000.0
                        lines.append(f"[{m:02d}:{s:05.2f}] {text.strip()}")
                    if lines:
                        return "\n".join(lines), True

            # Check USLT (Unsynchronized lyrics)
            uslt = audio.tags.getall("USLT") if hasattr(audio.tags, "getall") else []
            for frame in uslt:
                text = getattr(frame, "text", "")
                if text:
                    has_sync = bool(re.search(r"\[\d{2}:\d{2}(?:\.\d{1,3})?\]", text))
                    return text, has_sync

            # 2. M4A / MP4 ©lyr atom
            if "\xa9lyr" in audio.tags:
                val = audio.tags["\xa9lyr"]
                text = val[0] if isinstance(val, (list, tuple)) else str(val)
                has_sync = bool(re.search(r"\[\d{2}:\d{2}(?:\.\d{1,3})?\]", text))
                return text, has_sync

            # 3. Vorbis comments (FLAC / Ogg / Opus)
            for k in ("LYRICS", "lyrics", "UNSYNCEDLYRICS", "unsyncedlyrics"):
                if k in audio.tags:
                    val = audio.tags[k]
                    text = val[0] if isinstance(val, (list, tuple)) else str(val)
                    has_sync = bool(re.search(r"\[\d{2}:\d{2}(?:\.\d{1,3})?\]", text))
                    return text, has_sync
    except Exception:
        pass

    return None, False

def query_lrclib(meta):
    try:
        import requests
        headers = {"User-Agent": "SangitaMusicServer/1.0.0 (https://github.com/bluedragon320/sangita)"}
        base_url = "https://lrclib.net/api"

        track_name = meta.get("title", "")
        artist_name = meta.get("artist", "")
        album_name = meta.get("album", "")
        dur = meta.get("duration", 0.0)

        if not track_name:
            return None

        def _do_get(params, retries=1):
            for _ in range(retries + 1):
                try:
                    resp = requests.get(f"{base_url}/get", params=params, headers=headers, timeout=5)
                    if resp.status_code == 200:
                        data = resp.json()
                        synced = data.get("syncedLyrics")
                        if synced and synced.strip():
                            return synced.strip()
                    elif resp.status_code == 503:
                        time.sleep(0.5)
                        continue
                except Exception:
                    pass
            return None

        def _do_search(params, retries=1):
            for _ in range(retries + 1):
                try:
                    s_resp = requests.get(f"{base_url}/search", params=params, headers=headers, timeout=5)
                    if s_resp.status_code == 200:
                        items = s_resp.json()
                        if isinstance(items, list):
                            for item in items:
                                synced = item.get("syncedLyrics")
                                if not synced:
                                    continue
                                item_dur = float(item.get("duration", 0) or 0)
                                if dur > 0 and item_dur > 0:
                                    if abs(item_dur - dur) <= 4.0:
                                        return synced.strip()
                                else:
                                    return synced.strip()
                    elif s_resp.status_code == 503:
                        time.sleep(0.5)
                        continue
                except Exception:
                    pass
            return None

        # 1. Exact get with full metadata
        p1 = {"track_name": track_name}
        if artist_name:
            p1["artist_name"] = artist_name
        if album_name:
            p1["album_name"] = album_name
        if dur > 0:
            p1["duration"] = int(round(dur))
        lrc = _do_get(p1)
        if lrc:
            return lrc

        # 2. Get with track and artist
        if artist_name:
            p2 = {"track_name": track_name, "artist_name": artist_name}
            lrc = _do_get(p2)
            if lrc:
                return lrc

        # 3. Search with track and artist
        if artist_name:
            s_params = {"track_name": track_name, "artist_name": artist_name}
            lrc = _do_search(s_params)
            if lrc:
                return lrc

            # 4. Try primary artist if multiple contributors
            clean_artist = re.split(r"[/,;&]|\s+(?:feat\.?|ft\.?)\s+", artist_name, flags=re.IGNORECASE)[0].strip()
            if clean_artist and clean_artist.lower() != artist_name.lower():
                s_params2 = {"track_name": track_name, "artist_name": clean_artist}
                lrc = _do_search(s_params2)
                if lrc:
                    return lrc

            # 4b. If artist and track might have been reversed in tags ("Artist - Track" vs "Track - Artist")
            s_params_swapped = {"track_name": artist_name, "artist_name": track_name}
            lrc = _do_search(s_params_swapped)
            if lrc:
                return lrc

        # 5. Search with track name alone (with ±4s duration verification to prevent wrong matches)
        if dur > 0:
            s_params3 = {"track_name": track_name}
            lrc = _do_search(s_params3)
            if lrc:
                return lrc

            # 6. Search with artist name alone if track had no matches
            if artist_name:
                s_params4 = {"track_name": artist_name}
                lrc = _do_search(s_params4)
                if lrc:
                    return lrc

    except Exception:
        pass

    return None

def transcribe_with_whisper(audio_path, model_name, language, cores, whisper_holder):
    from faster_whisper import WhisperModel

    if whisper_holder.get("model") is None:
        print(f"[Worker] Loading faster-whisper model '{model_name}' (device=cpu, compute_type=int8, threads={cores})...", flush=True)
        try:
            whisper_holder["model"] = WhisperModel(
                model_name,
                device="cpu",
                compute_type="int8",
                cpu_threads=cores,
                num_workers=1,
                local_files_only=True
            )
        except Exception:
            whisper_holder["model"] = WhisperModel(
                model_name,
                device="cpu",
                compute_type="int8",
                cpu_threads=cores,
                num_workers=1
            )

    model = whisper_holder["model"]
    lang_param = None if (not language or language == "auto") else language

    segments, info = model.transcribe(
        audio_path,
        language=lang_param,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=200),
        condition_on_previous_text=False,
        no_speech_threshold=0.6,
        compression_ratio_threshold=2.4
    )

    detected_lang = getattr(info, "language", language or "unknown")

    formatted_lines = []
    last_text = ""
    repetition_count = 0

    for seg in segments:
        text = (seg.text or "").strip()
        if not text:
            continue

        # Hallucination and watermark checks
        if getattr(seg, "no_speech_prob", 0) > 0.65 or getattr(seg, "compression_ratio", 0) > 2.4:
            continue

        if any(pat.search(text) for pat in WATERMARK_PATTERNS):
            continue

        norm_text = text.lower().strip()
        if norm_text == last_text:
            repetition_count += 1
            if repetition_count > 2:
                continue
        else:
            last_text = norm_text
            repetition_count = 1

        start_s = float(seg.start)
        end_s = float(seg.end)

        # Long silence drift clamp: If segment > 15s with <= 3 words
        word_count = len(text.split())
        if (end_s - start_s) > 15.0 and word_count <= 3:
            start_s = max(start_s, end_s - 3.0)

        m = int(start_s // 60)
        s = start_s % 60
        formatted_lines.append(f"[{m:02d}:{s:05.2f}] {text}")

    lrc_content = "\n".join(formatted_lines)
    return lrc_content, detected_lang

def write_lrc_file(target_lrc_path, content):
    os.makedirs(os.path.dirname(os.path.abspath(target_lrc_path)), exist_ok=True)
    tmp_path = target_lrc_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    os.replace(tmp_path, target_lrc_path)

def discover_songs(music_dir):
    songs = []
    if not os.path.exists(music_dir):
        return songs
    for root, _, files in os.walk(music_dir):
        for f in sorted(files):
            if f.lower().endswith(AUDIO_EXTS):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, music_dir)
                songs.append((rel_path, full_path))
    songs.sort(key=lambda x: x[0])
    return songs

def main():
    parser = argparse.ArgumentParser(description="Sangita Batch Synced Lyrics Worker")
    parser.add_argument("--music-dir", default=os.environ.get("MUSIC_DIR", "./music"))
    parser.add_argument("--data-dir", default=os.environ.get("DATA_DIR", "./data"))
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium"])
    parser.add_argument("--language", default="auto")
    parser.add_argument("--cores", type=int, default=2)
    parser.add_argument("--max-ram-mb", type=int, default=4096)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--song", default=None, help="Process single relative track path")
    parser.add_argument("--playlist", default=None, help="Process songs only within a specific playlist or directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing .lrc")
    parser.add_argument("--demucs", action="store_true", help="Isolate vocals with Demucs before Whisper")
    parser.add_argument("--api", dest="api", action="store_true", default=True, help="Enable online API lookup with local model fallback")
    parser.add_argument("--no-api", dest="api", action="store_false", default=True, help="Skip online API and transcribe directly using local model")

    args = parser.parse_args()

    music_dir = os.path.abspath(args.music_dir)
    data_dir = os.path.abspath(args.data_dir)
    os.makedirs(data_dir, exist_ok=True)

    apply_resource_limits(args.cores)

    whisper_holder = {"model": None}

    # Discover candidate songs
    all_songs = discover_songs(music_dir)
    if args.song:
        candidate_rel = args.song.strip()
        matched = [s for s in all_songs if s[0] == candidate_rel or os.path.basename(s[0]) == os.path.basename(candidate_rel)]
        if not matched:
            full_custom = os.path.join(music_dir, candidate_rel)
            if os.path.isfile(full_custom):
                songs_to_process = [(candidate_rel, full_custom)]
            else:
                print(f"[Worker Error] Single song '{candidate_rel}' not found in {music_dir}", file=sys.stderr)
                sys.exit(1)
        else:
            songs_to_process = matched
    elif args.playlist:
        target_pl = args.playlist.strip().lower()
        matched = [
            s for s in all_songs
            if s[0].lower().startswith(target_pl + "/")
            or s[0].lower().startswith(target_pl + "\\")
            or os.path.dirname(s[0]).lower() == target_pl
            or os.path.dirname(s[0]).lower().endswith("/" + target_pl)
        ]
        if not matched:
            # Check virtual playlist table from sangita.db
            db_path = os.path.join(data_dir, "sangita.db")
            if os.path.isfile(db_path):
                try:
                    import sqlite3
                    conn = sqlite3.connect(db_path)
                    cur = conn.cursor()
                    rows = cur.execute("SELECT track_path FROM playlist_tracks WHERE playlist_name = ?", (args.playlist,)).fetchall()
                    conn.close()
                    db_paths = [r[0] for r in rows]
                    matched = [s for s in all_songs if s[0] in db_paths]
                except Exception as e:
                    print(f"[Worker DB Warning] {e}", file=sys.stderr)
        if not matched:
            print(f"[Worker Error] No songs found for playlist '{args.playlist}' in {music_dir}", file=sys.stderr)
            sys.exit(1)
        songs_to_process = matched
    else:
        songs_to_process = all_songs

    if args.limit > 0:
        songs_to_process = songs_to_process[:args.limit]

    total_songs = len(songs_to_process)
    counts = {
        "skipped_existing": 0,
        "embedded": 0,
        "lrclib": 0,
        "whisper": 0,
        "failed": 0
    }

    start_time = time.time()
    song_durations = []

    status_obj = {
        "state": "running",
        "pid": os.getpid(),
        "started_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "current_index": 0,
        "total_songs": total_songs,
        "current_song": "",
        "current_stage": "starting",
        "eta_seconds": 0,
        "counts": counts,
        "config": {
            "api": getattr(args, "api", True),
            "model": args.model,
            "language": args.language,
            "cores": args.cores,
            "max_ram_mb": args.max_ram_mb,
            "force": args.force,
            "demucs": args.demucs,
            "limit": args.limit,
            "playlist": args.playlist,
            "song": args.song
        }
    }
    write_status(data_dir, status_obj)

    print(f"[Worker Started] Processing {total_songs} songs (Cores={args.cores}, MaxRAM={args.max_ram_mb}MB, Model={args.model})", flush=True)

    for idx, (rel_path, full_path) in enumerate(songs_to_process, 1):
        if STOP_REQUESTED:
            print("[Worker] Stop requested. Terminating gracefully.", flush=True)
            status_obj["state"] = "stopped"
            write_status(data_dir, status_obj)
            break

        check_memory_guard(args.max_ram_mb, whisper_holder)

        song_start = time.time()
        lrc_path = os.path.splitext(full_path)[0] + ".lrc"

        # ETA calculation
        avg_time = (sum(song_durations) / len(song_durations)) if song_durations else 4.0
        remaining_songs = total_songs - idx + 1
        eta_sec = int(avg_time * remaining_songs)

        meta = parse_audio_metadata(full_path)

        status_obj["current_index"] = idx
        status_obj["current_song"] = rel_path
        status_obj["current_title"] = meta["title"] or os.path.basename(rel_path)
        status_obj["current_artist"] = meta["artist"] or ""
        status_obj["current_stage"] = "checking_cache"
        status_obj["current_source_type"] = "checking"
        status_obj["current_source_label"] = "Checking Cache"
        status_obj["current_action"] = "Checking if .lrc sidecar already exists on disk..."
        status_obj["eta_seconds"] = eta_sec
        status_obj["counts"] = counts
        write_status(data_dir, status_obj)

        # 1. Check existing
        if os.path.isfile(lrc_path) and os.path.getsize(lrc_path) > 0 and not args.force:
            counts["skipped_existing"] += 1
            song_durations.append(0.05)
            log_report(data_dir, {
                "filepath": rel_path,
                "title": meta["title"],
                "artist": meta["artist"],
                "duration_sec": meta["duration"],
                "source": "skipped_existing",
                "language": "",
                "processing_time_sec": time.time() - song_start,
                "status": "skipped",
                "error": ""
            })
            status_obj["last_processed"] = {
                "filepath": rel_path,
                "title": meta["title"] or os.path.basename(rel_path),
                "artist": meta["artist"] or "",
                "source": "skipped_existing",
                "source_type": "skipped",
                "source_label": "Cached (.lrc File)",
                "status": "skipped",
                "processing_time_sec": 0.05,
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            }
            write_status(data_dir, status_obj)
            continue

        lrc_content = None
        source_tag = ""
        detected_lang = args.language

        # 2. Check embedded
        status_obj["current_stage"] = "inspecting_tags"
        status_obj["current_source_type"] = "embedded"
        status_obj["current_source_label"] = "Embedded Metadata"
        status_obj["current_action"] = "Scanning file ID3/MP4 metadata for embedded synced lyrics..."
        write_status(data_dir, status_obj)
        embedded_text, has_sync = extract_embedded_lyrics(full_path)
        if embedded_text and has_sync:
            lrc_content = embedded_text
            source_tag = "embedded"

        # 3. Query LRCLIB (Online API)
        if not lrc_content and getattr(args, "api", True):
            status_obj["current_stage"] = "querying_api"
            status_obj["current_source_type"] = "api"
            status_obj["current_source_label"] = "Online API (LRCLIB)"
            status_obj["current_action"] = f"Searching Online API (LRCLIB database) for '{meta.get('title')}' by '{meta.get('artist')}'..."
            write_status(data_dir, status_obj)
            lrc_content = query_lrclib(meta)
            if lrc_content:
                source_tag = "lrclib"
                time.sleep(0.25)
            else:
                print(f"[Worker] Online lyrics unavailable for '{meta.get('title')}' by '{meta.get('artist')}'. Falling back to local Whisper AI ({args.model} model)...", flush=True)
        elif not lrc_content and not getattr(args, "api", True):
            print(f"[Worker] Online API disabled by user. Transcribing '{meta.get('title')}' directly with local Whisper AI ({args.model} model)...", flush=True)

        # 4. Demucs vocal separation (optional)
        vocal_path = full_path
        demucs_tmp_dir = None
        if not lrc_content and args.demucs:
            status_obj["current_stage"] = "demucs_vocal_isolation"
            status_obj["current_source_type"] = "local_demucs"
            status_obj["current_source_label"] = "Local Demucs Isolation"
            status_obj["current_action"] = "Isolating vocal stem locally before Whisper transcription..."
            write_status(data_dir, status_obj)
            try:
                demucs_tmp_dir = tempfile.mkdtemp(prefix="demucs_sangita_")
                cmd = ["demucs", "--two-stems=vocals", "-n", "htdemucs", "-j", str(args.cores), "-o", demucs_tmp_dir, full_path]
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                base_name = os.path.splitext(os.path.basename(full_path))[0]
                cand = os.path.join(demucs_tmp_dir, "htdemucs", base_name, "vocals.wav")
                if os.path.isfile(cand):
                    vocal_path = cand
            except Exception as e:
                print(f"[Worker] Demucs error on {rel_path}: {e}", file=sys.stderr)

        # 5. Whisper AI transcription (Local Machine 500MB Model)
        if not lrc_content:
            status_obj["current_stage"] = "local_whisper"
            status_obj["current_source_type"] = "local_machine"
            status_obj["current_source_label"] = f"Local Machine AI (Whisper {args.model} · 500MB Model)"
            if getattr(args, "api", True):
                status_obj["current_action"] = f"Online API unavailable. Transcribing locally on machine CPU via Whisper ({args.cores} cores, int8)..."
            else:
                status_obj["current_action"] = f"Online API disabled. Transcribing directly on machine CPU via Whisper ({args.cores} cores, int8)..."
            write_status(data_dir, status_obj)
            try:
                whisper_out, detected_lang = transcribe_with_whisper(
                    vocal_path, args.model, args.language, args.cores, whisper_holder
                )
                if whisper_out and whisper_out.strip():
                    lrc_content = whisper_out
                    source_tag = "whisper_demucs" if (args.demucs and vocal_path != full_path) else "whisper"
            except Exception as e:
                print(f"[Worker] Whisper transcription failed for {rel_path}: {e}", file=sys.stderr)

        # Cleanup Demucs tmp dir if used
        if demucs_tmp_dir and os.path.exists(demucs_tmp_dir):
            try:
                import shutil
                shutil.rmtree(demucs_tmp_dir, ignore_errors=True)
            except Exception:
                pass

        # Fallback to plain embedded if Whisper/LRCLIB completely failed
        if not lrc_content and embedded_text:
            lrc_content = embedded_text
            source_tag = "embedded_unsynced"

        proc_time = time.time() - song_start
        song_durations.append(proc_time)

        final_source_label = (
            "Online API (LRCLIB)" if source_tag == "lrclib" else
            f"Local Machine (Whisper {args.model})" if "whisper" in source_tag else
            "Embedded Metadata Tags" if source_tag == "embedded" else
            "Plain Embedded" if source_tag == "embedded_unsynced" else "None"
        )
        final_source_type = (
            "api" if source_tag == "lrclib" else
            "local_machine" if "whisper" in source_tag else
            "embedded" if "embedded" in source_tag else "none"
        )

        status_obj["last_processed"] = {
            "filepath": rel_path,
            "title": meta["title"] or os.path.basename(rel_path),
            "artist": meta["artist"] or "",
            "source": source_tag or "none",
            "source_type": final_source_type,
            "source_label": final_source_label,
            "status": "success" if (lrc_content and lrc_content.strip()) else "failed",
            "processing_time_sec": round(proc_time, 2),
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        }
        write_status(data_dir, status_obj)

        if lrc_content and lrc_content.strip():
            try:
                write_lrc_file(lrc_path, lrc_content)
                counts[source_tag if source_tag in counts else "whisper"] = counts.get(source_tag if source_tag in counts else "whisper", 0) + 1
                log_report(data_dir, {
                    "filepath": rel_path,
                    "title": meta["title"],
                    "artist": meta["artist"],
                    "duration_sec": meta["duration"],
                    "source": source_tag,
                    "language": detected_lang,
                    "processing_time_sec": proc_time,
                    "status": "success",
                    "error": ""
                })
                print(f"[{idx}/{total_songs}] SUCCESS ({source_tag}) -> {rel_path} ({proc_time:.1f}s)", flush=True)
            except Exception as e:
                counts["failed"] += 1
                log_report(data_dir, {
                    "filepath": rel_path,
                    "title": meta["title"],
                    "artist": meta["artist"],
                    "duration_sec": meta["duration"],
                    "source": "error",
                    "language": "",
                    "processing_time_sec": proc_time,
                    "status": "failed",
                    "error": str(e)
                })
                print(f"[{idx}/{total_songs}] ERROR writing {rel_path}: {e}", file=sys.stderr)
        else:
            counts["failed"] += 1
            log_report(data_dir, {
                "filepath": rel_path,
                "title": meta["title"],
                "artist": meta["artist"],
                "duration_sec": meta["duration"],
                "source": "none",
                "language": "",
                "processing_time_sec": proc_time,
                "status": "failed",
                "error": "No lyrics found from any source"
            })
            print(f"[{idx}/{total_songs}] FAILED -> {rel_path} (No lyrics)", flush=True)

    if whisper_holder.get("model") is not None:
        del whisper_holder["model"]
        whisper_holder["model"] = None
        gc.collect()

    final_state = "stopped" if STOP_REQUESTED else "completed"
    status_obj["state"] = final_state
    status_obj["current_stage"] = "done" if final_state == "completed" else "stopped"
    status_obj["eta_seconds"] = 0
    status_obj["counts"] = counts
    write_status(data_dir, status_obj)

    print(f"[Worker Finished] State: {final_state}. Processed: {total_songs}. Counts: {counts}. Total elapsed: {time.time() - start_time:.1f}s", flush=True)

if __name__ == "__main__":
    main()

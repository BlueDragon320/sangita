#!/usr/bin/env python3
"""
Sangita Remote GPU Whisper Server
================================
A lightweight, high-performance API server designed to run on a local PC / Laptop
with GPU acceleration (NVIDIA CUDA / CTranslate2).

Features:
- Web dashboard with live hardware telemetry (GPU VRAM, GPU %, CPU %, RAM %).
- Real-time job monitor: shows current song being processed and duration.
- Processed song history table with live lyrics preview modal.
- Automatic temp file purge: audio is deleted immediately after transcription.
- Standard LRC output with VAD filtering and timestamp alignment.
"""

import os
import sys
import time
import uuid
import shutil
import logging
import argparse
import tempfile
import subprocess
from datetime import datetime, timezone

from flask import Flask, request, jsonify, render_template, send_from_directory
import psutil

# Optional PyAV patch for faster-whisper compatibility
try:
    import av
    _orig_av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _patched_av_open
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("SangitaWhisperGPU")

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates"),
    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
)

# Global State
SERVER_START_TIME = time.time()
MODELS_CACHE = {}
ACTIVE_JOB = {
    "status": "idle",
    "filename": None,
    "size_bytes": 0,
    "started_at": None,
    "client_ip": None,
    "model": None,
    "language": None
}
HISTORY = []  # capped at 100 entries
MAX_HISTORY = 100

SERVER_CONFIG = {
    "device": "auto",
    "compute_type": "auto",
    "default_model": "small",
    "host": "0.0.0.0",
    "port": 8000
}


def detect_gpu():
    """Detects available GPU hardware (NVIDIA CUDA via nvidia-smi or ctranslate2)."""
    has_cuda = False
    device_name = "CPU"
    total_vram_mb = 0
    used_vram_mb = 0
    gpu_util_pct = 0
    driver_version = "N/A"

    # 1. Check CTranslate2 CUDA support
    try:
        import ctranslate2
        cuda_count = ctranslate2.get_cuda_device_count()
        if cuda_count > 0:
            has_cuda = True
    except Exception:
        has_cuda = False

    # 2. Query nvidia-smi for real-time telemetry if available
    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,utilization.gpu,driver_version", "--format=csv,noheader,nounits"],
                stderr=subprocess.DEVNULL,
                universal_newlines=True
            ).strip()
            lines = out.split("\n")
            if lines and lines[0]:
                parts = [p.strip() for p in lines[0].split(",")]
                if len(parts) >= 5:
                    device_name = parts[0]
                    total_vram_mb = int(float(parts[1]))
                    used_vram_mb = int(float(parts[2]))
                    gpu_util_pct = int(float(parts[3]))
                    driver_version = parts[4]
                    has_cuda = True
        except Exception:
            pass

    return {
        "has_cuda": has_cuda,
        "name": device_name,
        "total_vram_mb": total_vram_mb,
        "used_vram_mb": used_vram_mb,
        "gpu_util_pct": gpu_util_pct,
        "driver_version": driver_version
    }


def get_hardware_telemetry():
    """Gathers CPU, RAM, and GPU telemetry for the live dashboard."""
    gpu_info = detect_gpu()
    mem = psutil.virtual_memory()
    cpu_pct = psutil.cpu_percent(interval=None)

    active_job_copy = dict(ACTIVE_JOB)
    if active_job_copy["started_at"]:
        active_job_copy["elapsed_sec"] = round(time.time() - active_job_copy["started_at"], 1)
    else:
        active_job_copy["elapsed_sec"] = 0

    return {
        "uptime_sec": int(time.time() - SERVER_START_TIME),
        "gpu": gpu_info,
        "cpu": {
            "percent": cpu_pct,
            "cores": psutil.cpu_count(logical=True)
        },
        "ram": {
            "total_mb": int(mem.total / (1024 * 1024)),
            "used_mb": int(mem.used / (1024 * 1024)),
            "percent": mem.percent
        },
        "active_job": active_job_copy,
        "total_processed": len(HISTORY)
    }


def get_whisper_model(model_name="small"):
    """Loads and caches faster-whisper model on GPU or CPU."""
    device = SERVER_CONFIG["device"]
    compute_type = SERVER_CONFIG["compute_type"]

    if device == "auto":
        gpu_info = detect_gpu()
        if gpu_info["has_cuda"]:
            device = "cuda"
            compute_type = "float16" if compute_type == "auto" else compute_type
        else:
            device = "cpu"
            compute_type = "int8" if compute_type == "auto" else compute_type

    cache_key = f"{model_name}_{device}_{compute_type}"
    if cache_key in MODELS_CACHE:
        return MODELS_CACHE[cache_key], device, compute_type

    logger.info(f"Loading faster-whisper model '{model_name}' on {device} ({compute_type})...")
    from faster_whisper import WhisperModel

    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        cpu_threads=max(1, psutil.cpu_count(logical=False) or 2)
    )
    MODELS_CACHE[cache_key] = model
    return model, device, compute_type


# Web Routes
@app.route("/")
def index():
    """Serves the main GPU Dashboard."""
    return render_template("index.html")


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint used by Sangita server to verify GPU worker connectivity."""
    gpu_info = detect_gpu()
    return jsonify({
        "status": "ready",
        "service": "sangita-remote-whisper",
        "device": "cuda" if gpu_info["has_cuda"] else "cpu",
        "gpu_name": gpu_info["name"],
        "has_cuda": gpu_info["has_cuda"],
        "total_vram_mb": gpu_info["total_vram_mb"],
        "used_vram_mb": gpu_info["used_vram_mb"],
        "active_job": ACTIVE_JOB["status"],
        "models_cached": list(MODELS_CACHE.keys())
    })


@app.route("/api/telemetry", methods=["GET"])
def telemetry():
    """Returns real-time telemetry and processed song history for the dashboard."""
    data = get_hardware_telemetry()
    data["history"] = HISTORY[:50]
    return jsonify(data)


@app.route("/api/clear-history", methods=["POST"])
def clear_history():
    """Clears completed songs history."""
    global HISTORY
    HISTORY = []
    return jsonify({"success": True, "message": "History cleared"})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Main transcription endpoint.
    Accepts:
      - 'audio' or 'file' multipart file upload.
      - Optional form params: 'model' (default: small), 'language' (default: auto), 'beam_size' (default: 5)
    Returns:
      JSON with 'lrc' content, 'language', 'duration_sec', etc.
    Guarantees:
      The uploaded audio file is permanently deleted from disk immediately after processing.
    """
    global ACTIVE_JOB
    uploaded_file = request.files.get("audio") or request.files.get("file")
    if not uploaded_file:
        return jsonify({"error": "No audio file provided in request (use 'audio' or 'file' form-data field)"}), 400

    filename = uploaded_file.filename or "unknown.mp3"
    model_name = request.form.get("model", SERVER_CONFIG["default_model"]).strip()
    language = request.form.get("language", "auto").strip()
    beam_size = int(request.form.get("beam_size", 5))

    ext = os.path.splitext(filename)[1].lower() or ".mp3"
    temp_fd, temp_path = tempfile.mkstemp(prefix="whisper_remote_", suffix=ext)
    os.close(temp_fd)

    start_time = time.time()
    ACTIVE_JOB = {
        "status": "transcribing",
        "filename": filename,
        "size_bytes": 0,
        "started_at": start_time,
        "client_ip": request.remote_addr,
        "model": model_name,
        "language": language
    }

    temp_purged = False
    try:
        # Save audio to temporary location
        uploaded_file.save(temp_path)
        file_size = os.path.getsize(temp_path)
        ACTIVE_JOB["size_bytes"] = file_size

        logger.info(f"Received '{filename}' ({file_size / 1024:.1f} KB) from {request.remote_addr}. Transcribing with model '{model_name}'...")

        # Load model and transcribe
        model, device_used, compute_type_used = get_whisper_model(model_name)

        lang_param = None if (not language or language == "auto") else language
        segments, info = model.transcribe(
            temp_path,
            language=lang_param,
            beam_size=beam_size,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=200),
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4
        )

        detected_lang = getattr(info, "language", language or "unknown")

        # Format into LRC timestamped lines
        lrc_lines = []
        last_text = ""
        repetition_count = 0

        for seg in segments:
            text = (seg.text or "").strip()
            if not text:
                continue

            # Anti-repetition & hallucination guards
            norm = text.lower().strip()
            if norm == last_text:
                repetition_count += 1
                if repetition_count > 2:
                    continue
            else:
                last_text = norm
                repetition_count = 1

            start_s = float(seg.start)
            m = int(start_s // 60)
            s = start_s % 60
            lrc_lines.append(f"[{m:02d}:{s:05.2f}] {text}")

        lrc_content = "\n".join(lrc_lines)
        duration_sec = round(time.time() - start_time, 2)

        # Log and record success in history
        history_item = {
            "id": str(uuid.uuid4())[:8],
            "filename": filename,
            "duration_sec": duration_sec,
            "language": detected_lang,
            "lines_count": len(lrc_lines),
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
            "status": "success",
            "device": f"{device_used} ({compute_type_used})",
            "lrc": lrc_content
        }
        HISTORY.insert(0, history_item)
        if len(HISTORY) > MAX_HISTORY:
            HISTORY.pop()

        logger.info(f"Completed '{filename}' in {duration_sec}s ({len(lrc_lines)} lines, lang={detected_lang})")

        return jsonify({
            "success": True,
            "lrc": lrc_content,
            "language": detected_lang,
            "lines_count": len(lrc_lines),
            "duration_sec": duration_sec,
            "device": device_used,
            "compute_type": compute_type_used,
            "filename": filename,
            "temp_purged": True
        })

    except Exception as e:
        logger.error(f"Error transcribing '{filename}': {e}", exc_info=True)
        duration_sec = round(time.time() - start_time, 2)
        history_item = {
            "id": str(uuid.uuid4())[:8],
            "filename": filename,
            "duration_sec": duration_sec,
            "language": "error",
            "lines_count": 0,
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
            "status": "error",
            "error_message": str(e),
            "device": SERVER_CONFIG["device"],
            "lrc": ""
        }
        HISTORY.insert(0, history_item)
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        # STRICT REQUIREMENT: Delete temp audio file immediately after processing
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                temp_purged = True
                logger.info(f"Purged temp audio file: {temp_path}")
            except Exception as err:
                logger.warning(f"Could not delete temp audio {temp_path}: {err}")

        # Reset active job state
        ACTIVE_JOB = {
            "status": "idle",
            "filename": None,
            "size_bytes": 0,
            "started_at": None,
            "client_ip": None,
            "model": None,
            "language": None
        }


def parse_args():
    parser = argparse.ArgumentParser(description="Sangita Remote GPU Whisper Transcription Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host address to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"], help="Compute device (default: auto)")
    parser.add_argument("--compute-type", default="auto", choices=["auto", "float16", "int8_float16", "int8"], help="Compute precision")
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large-v3"], help="Default Whisper model")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    SERVER_CONFIG["host"] = args.host
    SERVER_CONFIG["port"] = args.port
    SERVER_CONFIG["device"] = args.device
    SERVER_CONFIG["compute_type"] = args.compute_type
    SERVER_CONFIG["default_model"] = args.model

    gpu = detect_gpu()
    print("=" * 65)
    print("  Sangita — Local PC Lyrics API (Whisper GPU Node)")
    print("=" * 65)
    print(f"  • Hardware:      {gpu['name']}")
    print(f"  • CUDA Enabled:  {'YES (High-Speed Acceleration)' if gpu['has_cuda'] else 'NO (Running on CPU)'}")
    if gpu['has_cuda']:
        print(f"  • Total VRAM:    {gpu['total_vram_mb']} MB")
        print(f"  • Driver:        {gpu['driver_version']}")
    print(f"  • Default Model: {args.model}")
    print(f"  • Local Web UI:  http://localhost:{args.port}")
    print(f"  • Network URL:   http://<your-pc-ip>:{args.port}")
    print("=" * 65)
    print("  Ready to accept local or remote transcription requests.\n")

    app.run(host=args.host, port=args.port, threaded=True)

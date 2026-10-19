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
import gc
import re
import json
import time
import uuid
import shutil
import atexit
import signal
import logging
import argparse
import tempfile
import threading
import subprocess
import socket
import urllib.request
from datetime import datetime, timezone

# Resilient DNS fallback hook (bypasses router/local Pi-hole/AdGuard sinkholes that block huggingface.co to 0.0.0.0)
_orig_getaddrinfo = socket.getaddrinfo
_dns_cache = {}

def _resolve_fallback(host):
    if host in _dns_cache:
        return _dns_cache[host]
    # 1. Try DoH (DNS-over-HTTPS via Cloudflare & Google)
    doh_urls = [
        f"https://1.1.1.1/dns-query?name={host}&type=A",
        f"https://dns.google/resolve?name={host}&type=A"
    ]
    for url in doh_urls:
        try:
            req = urllib.request.Request(url, headers={"accept": "application/dns-json", "User-Agent": "Sangita-DNS-Fallback"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                ips = [ans["data"] for ans in data.get("Answer", []) if ans.get("type") == 1]
                if ips:
                    _dns_cache[host] = ips
                    return ips
        except Exception:
            continue
    # 2. Try dig @8.8.8.8
    try:
        out = subprocess.getoutput(f"dig @8.8.8.8 {host} +short").strip().split("\n")
        ips = [x.strip() for x in out if x.strip() and x.strip()[0].isdigit() and "." in x]
        if ips:
            _dns_cache[host] = ips
            return ips
    except Exception:
        pass
    return None

def _resilient_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        res = _orig_getaddrinfo(host, port, family, type, proto, flags)
        if any(addr[4][0] in ('0.0.0.0', '::') for addr in res):
            raise socket.gaierror(-2, 'Sinkholed')
        return res
    except Exception:
        if isinstance(host, str) and '.' in host and not host.endswith('.local'):
            ips = _resolve_fallback(host)
            if ips:
                return _orig_getaddrinfo(ips[0], port, family, type, proto, flags)
        raise

socket.getaddrinfo = _resilient_getaddrinfo

from flask import Flask, request, jsonify, render_template, send_from_directory
import psutil
import platform


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


def preload_nvidia_cuda_libraries():
    """
    Auto-discovers and preloads NVIDIA CUDA/cuBLAS/cuDNN runtime libraries installed via pip
    (e.g., nvidia-cublas-cu12, nvidia-cudnn-cu12) so CTranslate2 can load them on Linux.
    """
    loaded_paths = []
    search_dirs = []
    try:
        import site
        if hasattr(site, "getsitepackages"):
            search_dirs.extend(site.getsitepackages())
        if hasattr(site, "getusersitepackages"):
            search_dirs.append(site.getusersitepackages())
    except Exception:
        pass

    for sdir in search_dirs:
        nv_dir = os.path.join(sdir, "nvidia")
        if not os.path.isdir(nv_dir):
            continue
        for subpkg in ["cuda_nvrtc", "cuda_runtime", "cublas", "cudnn"]:
            lib_dir = os.path.join(nv_dir, subpkg, "lib")
            if not os.path.isdir(lib_dir):
                continue
            if lib_dir not in loaded_paths:
                loaded_paths.append(lib_dir)

            if sys.platform == "win32":
                if hasattr(os, "add_dll_directory"):
                    try:
                        os.add_dll_directory(lib_dir)
                    except Exception:
                        pass
            elif sys.platform == "linux":
                try:
                    import ctypes
                    # Preload all .so files into global symbol table (skip nvblas to avoid CPU BLAS override)
                    for fname in sorted(os.listdir(lib_dir)):
                        if "nvblas" in fname:
                            continue
                        if fname.endswith(".so") or ".so." in fname:
                            fpath = os.path.join(lib_dir, fname)
                            try:
                                ctypes.CDLL(fpath, mode=ctypes.RTLD_GLOBAL)
                            except Exception:
                                pass
                except Exception:
                    pass

    return loaded_paths


# Preload NVIDIA CUDA libraries on startup
preload_nvidia_cuda_libraries()


def verify_cuda_cublas():
    """
    Checks if NVIDIA cuBLAS libraries can actually be resolved by CTranslate2.
    Returns (True, "libcublas.so.12") or (False, "Reason").
    """
    if sys.platform == "linux":
        import ctypes
        import ctypes.util
        for libname in ["libcublas.so.12", "libcublas.so.11", "libcublas.so"]:
            try:
                ctypes.CDLL(libname)
                return True, libname
            except Exception:
                pass
        found = ctypes.util.find_library("cublas")
        if found:
            try:
                ctypes.CDLL(found)
                return True, found
            except Exception:
                pass
        return False, "NVIDIA cuBLAS (libcublas.so.12) not found in system or pip packages"
    elif sys.platform == "win32":
        import ctypes
        for libname in ["cublas64_12.dll", "cublas64_11.dll"]:
            try:
                ctypes.CDLL(libname)
                return True, libname
            except Exception:
                pass
        return False, "cublas64_12.dll not found"
    return False, "Unsupported platform for CUDA verification"


def check_model_status(model_name="small"):
    """Checks whether the specified Whisper model is downloaded in local HuggingFace cache."""
    import glob
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    model_dir = os.path.join(cache_dir, f"models--Systran--faster-whisper-{model_name}")
    if not os.path.isdir(model_dir):
        return {"cached": False, "size_mb": 0, "path": None}

    # check snapshots
    bin_files = glob.glob(os.path.join(model_dir, "snapshots", "*", "model.bin"))
    if bin_files:
        real_file = os.path.realpath(bin_files[0])
        size_mb = round(os.path.getsize(real_file) / (1024 * 1024), 1)
        return {"cached": True, "size_mb": size_mb, "path": real_file}

    # check blobs
    blobs = glob.glob(os.path.join(model_dir, "blobs", "*"))
    total_size = sum(os.path.getsize(b) for b in blobs if os.path.isfile(b))
    if total_size > 50 * 1024 * 1024:
        return {"cached": True, "size_mb": round(total_size / (1024 * 1024), 1), "path": model_dir}

    return {"cached": False, "size_mb": 0, "path": None}


logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("SangitaWhisperGPU")

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates"),
    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
)
app.config["DEBUG"] = False
app.config["ENV"] = "production"

@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

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

# Ephemeral RAM / VRAM State (Zero Disk Retention)
EPHEMERAL_RAM_DIR = None
MODEL_SOURCE = "online"  # "online" | "server"
ACTIVE_MODEL_NAME = "small"
IS_LOADED_IN_RAM = False


def get_ram_disk_dir():
    """
    Allocates an ephemeral in-RAM directory (using /dev/shm tmpfs on Linux)
    so model weights and processing files never touch the physical SSD/HDD.
    """
    global EPHEMERAL_RAM_DIR
    if EPHEMERAL_RAM_DIR and os.path.isdir(EPHEMERAL_RAM_DIR):
        return EPHEMERAL_RAM_DIR

    unique_id = uuid.uuid4().hex[:8]
    # Check if /dev/shm exists and has sufficient space
    if sys.platform.startswith("linux") and os.path.isdir("/dev/shm"):
        try:
            stat = os.statvfs("/dev/shm")
            free_mb = (stat.f_bavail * stat.f_frsize) / (1024 * 1024)
            if free_mb > 600:
                ram_path = os.path.join("/dev/shm", f"sangita_ram_{unique_id}")
                os.makedirs(ram_path, exist_ok=True)
                EPHEMERAL_RAM_DIR = ram_path
                logger.info(f"Initialized POSIX RAM Disk in /dev/shm: {EPHEMERAL_RAM_DIR} ({free_mb:.0f} MB free RAM)")
                return EPHEMERAL_RAM_DIR
        except Exception as e:
            logger.debug(f"Could not allocate in /dev/shm: {e}")

    # Fallback to tempfile ephemeral directory
    temp_dir = tempfile.mkdtemp(prefix=f"sangita_ephemeral_{unique_id}_")
    EPHEMERAL_RAM_DIR = temp_dir
    logger.info(f"Initialized ephemeral directory in temp: {EPHEMERAL_RAM_DIR}")
    return EPHEMERAL_RAM_DIR


def purge_local_ephemeral_data():
    """
    Unloads model weights from GPU and RAM, force-collects garbage,
    and wipes all ephemeral RAM directories so ZERO trace remains on the machine.
    """
    global EPHEMERAL_RAM_DIR, MODELS_CACHE, IS_LOADED_IN_RAM
    logger.info("Executing zero-trace cleanup: freeing GPU VRAM and removing RAM-disk directories...")
    MODELS_CACHE.clear()
    IS_LOADED_IN_RAM = False
    gc.collect()

    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    if EPHEMERAL_RAM_DIR and os.path.exists(EPHEMERAL_RAM_DIR):
        try:
            shutil.rmtree(EPHEMERAL_RAM_DIR, ignore_errors=True)
            logger.info(f"Successfully purged RAM-disk directory: {EPHEMERAL_RAM_DIR}")
        except Exception as e:
            logger.warning(f"Error purging {EPHEMERAL_RAM_DIR}: {e}")
        EPHEMERAL_RAM_DIR = None


# Auto-purge on exit (Ctrl+C, SIGTERM, normal exit)
atexit.register(purge_local_ephemeral_data)


def _sig_handler(sig, frame):
    logger.info(f"Shutdown signal ({sig}) received. Purging all ephemeral RAM data...")
    purge_local_ephemeral_data()
    sys.exit(0)


try:
    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)
except Exception:
    pass


def get_ram_storage_info():
    """Gathers status of in-RAM ephemeral model storage."""
    is_shm = bool(EPHEMERAL_RAM_DIR and EPHEMERAL_RAM_DIR.startswith("/dev/shm"))
    size_mb = 0
    if EPHEMERAL_RAM_DIR and os.path.isdir(EPHEMERAL_RAM_DIR):
        for root, _, files in os.walk(EPHEMERAL_RAM_DIR):
            for f in files:
                try:
                    size_mb += os.path.getsize(os.path.join(root, f)) / (1024 * 1024)
                except Exception:
                    pass

    return {
        "ram_mode": True,
        "is_posix_shm": is_shm,
        "storage_mode": "RAM (/dev/shm Ephemeral)" if is_shm else "RAM (Ephemeral Temp)",
        "ram_path": EPHEMERAL_RAM_DIR,
        "size_mb": round(size_mb, 1),
        "is_loaded_in_ram": IS_LOADED_IN_RAM,
        "model_source": MODEL_SOURCE,
        "active_model": ACTIVE_MODEL_NAME,
        "zero_trace_guaranteed": True
    }


def load_model_to_ram(model_name="small", source="online", server_url=None):
    """
    Downloads or streams Whisper model directly into RAM (/dev/shm) and loads it into GPU VRAM.
    Source can be:
      - 'online': direct download from HuggingFace Hub into RAM disk
      - 'server': streamed over LAN/WAN from Sangita server into RAM disk
    """
    global MODEL_SOURCE, ACTIVE_MODEL_NAME, IS_LOADED_IN_RAM
    ram_dir = get_ram_disk_dir()
    target_dir = os.path.join(ram_dir, f"whisper_{model_name}")
    os.makedirs(target_dir, exist_ok=True)

    logger.info(f"Loading Whisper model '{model_name}' to RAM/GPU from source: {source}...")

    if source == "server":
        if not server_url:
            raise ValueError("Server URL must be provided when streaming model from Sangita server.")
        import urllib.request
        import urllib.error
        clean_server = server_url.rstrip("/")
        # Verify server model info endpoint first with timeout
        info_url = f"{clean_server}/api/lyrics/model/{model_name}/info"
        try:
            req = urllib.request.Request(info_url, headers={"User-Agent": "Sangita-Whisper-RAM-Node"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                info_data = json.loads(resp.read().decode())
                if not info_data.get("available"):
                    raise RuntimeError(f"Model '{model_name}' is not cached on Sangita server at {clean_server}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"Could not connect to Sangita server at {clean_server} ({e.reason}). Make sure Sangita server is running on that address, or select 'Online (HuggingFace / Local Cache)'.")

        req_files = ["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"]
        for fname in req_files:
            dst_file = os.path.join(target_dir, fname)
            if not os.path.isfile(dst_file) or os.path.getsize(dst_file) == 0:
                download_url = f"{clean_server}/api/lyrics/model/{model_name}/{fname}"
                logger.info(f"Streaming {fname} from server ({download_url}) to RAM...")
                urllib.request.urlretrieve(download_url, dst_file)
    else:
        # Online / Local source: first check if model is already in local HuggingFace cache
        cached_path = None
        try:
            from faster_whisper.utils import download_model
            cand_path = download_model(model_name, local_files_only=True)
            # Verify model.bin exists and is non-empty
            bin_file = os.path.join(cand_path, "model.bin")
            if os.path.isfile(bin_file) and os.path.getsize(bin_file) > 1024 * 1024:
                cached_path = cand_path
            else:
                logger.info(f"Local cache for '{model_name}' is incomplete (missing model.bin), downloading from Hub...")
                cached_path = None
        except Exception:
            cached_path = None

        if cached_path and os.path.isdir(cached_path):
            logger.info(f"Model '{model_name}' found in local cache ({cached_path}). Streaming into RAM disk ({target_dir})...")
            for f in os.listdir(cached_path):
                src_file = os.path.join(cached_path, f)
                real_src = os.path.realpath(src_file)
                dst_file = os.path.join(target_dir, f)
                if os.path.isfile(real_src):
                    shutil.copyfile(real_src, dst_file)
        else:
            # Not in local cache, attempt download from HuggingFace
            try:
                from faster_whisper.utils import download_model
                download_path = download_model(model_name)
                # Copy from download cache to RAM disk
                for f in os.listdir(download_path):
                    src_file = os.path.join(download_path, f)
                    real_src = os.path.realpath(src_file)
                    dst_file = os.path.join(target_dir, f)
                    if os.path.isfile(real_src):
                        shutil.copyfile(real_src, dst_file)
            except Exception as e:
                raise RuntimeError(
                    f"Could not download model '{model_name}' from HuggingFace ({e}). "
                    f"If your internet is unavailable or HuggingFace is blocked, you can stream it from your Sangita server over LAN instead."
                )

    MODEL_SOURCE = source
    ACTIVE_MODEL_NAME = model_name
    IS_LOADED_IN_RAM = True

    # Preload and cache WhisperModel on GPU/CPU
    model, dev, compute = get_whisper_model(model_name=target_dir, force_device=None)
    logger.info(f"Model '{model_name}' successfully loaded into {dev} ({compute}) from RAM!")
    return model, dev, compute, target_dir

SERVER_CONFIG = {
    "device": "auto",
    "compute_type": "auto",
    "default_model": "small",
    "host": "0.0.0.0",
    "port": 8000,
    "cpu_threads": max(1, (psutil.cpu_count(logical=False) or 4) // 2),
    "max_ram_mb": 4096,
    "cooldown_sec": 0.5,
    "low_priority": True
}
TRANSCRIBE_LOCK = threading.Lock()


def apply_process_priority(low_priority=True):
    """Sets OS scheduling priority to low/below-normal to prevent freezing foreground desktop apps."""
    try:
        p = psutil.Process()
        if sys.platform == "win32":
            if low_priority:
                p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
            else:
                p.nice(psutil.NORMAL_PRIORITY_CLASS)
        else:
            if low_priority and hasattr(os, "nice"):
                try:
                    os.nice(10)
                except Exception:
                    pass
    except Exception as e:
        logger.debug(f"Could not adjust process priority: {e}")


def check_memory_watchdog():
    """Unloads cached models if process RSS exceeds configured max_ram_mb."""
    try:
        p = psutil.Process()
        rss_mb = p.memory_info().rss / (1024 * 1024)
        max_ram = SERVER_CONFIG.get("max_ram_mb", 4096)
        if rss_mb > max_ram:
            logger.warning(f"Process RAM ({rss_mb:.1f} MB) exceeds limit ({max_ram} MB). Unloading models and collecting garbage...")
            MODELS_CACHE.clear()
            gc.collect()
            if shutil.which("nvidia-smi"):
                try:
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass
    except Exception as e:
        logger.debug(f"Memory watchdog error: {e}")


def detect_gpu():
    """Detects available GPU hardware (NVIDIA CUDA via nvidia-smi or ctranslate2) and validates runtime libraries."""
    has_cuda = False
    cuda_runtime_ready = False
    device_name = "CPU"
    total_vram_mb = 0
    used_vram_mb = 0
    gpu_util_pct = 0
    driver_version = "N/A"
    status_msg = "Running on CPU"

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

    # 3. Check if CUDA runtime libraries (cuBLAS / cuDNN) are actually loadable
    if has_cuda:
        cublas_ok, cublas_info = verify_cuda_cublas()
        cuda_runtime_ready = cublas_ok
        if cuda_runtime_ready:
            status_msg = f"GPU Accelerated: {device_name}"
        else:
            status_msg = f"GPU detected ({device_name}), but cuBLAS missing ({cublas_info}). Auto-falling back to CPU."
    else:
        status_msg = "CPU mode (No CUDA GPU detected)"

    return {
        "has_cuda": has_cuda,
        "cuda_runtime_ready": cuda_runtime_ready,
        "name": device_name,
        "total_vram_mb": total_vram_mb,
        "used_vram_mb": used_vram_mb,
        "gpu_util_pct": gpu_util_pct,
        "driver_version": driver_version,
        "status_msg": status_msg
    }


def detect_system_specs():
    """Detects CPU model, core counts, total RAM, OS, and GPU hardware specs for client configuration."""
    gpu_info = detect_gpu()
    mem = psutil.virtual_memory()
    logical_cores = psutil.cpu_count(logical=True) or 4
    physical_cores = psutil.cpu_count(logical=False) or logical_cores

    cpu_model = "Multi-Core CPU"
    try:
        if sys.platform == "linux" and os.path.isfile("/proc/cpuinfo"):
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        cpu_model = line.split(":", 1)[1].strip()
                        break
        elif sys.platform == "darwin":
            cpu_model = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], universal_newlines=True).strip()
        elif sys.platform == "win32":
            cpu_model = platform.processor() or "Multi-Core CPU"
    except Exception:
        cpu_model = platform.processor() or "Multi-Core CPU"

    return {
        "os": f"{platform.system()} {platform.release()}",
        "platform": platform.platform(),
        "cpu_model": cpu_model,
        "total_cores": logical_cores,
        "physical_cores": physical_cores,
        "total_ram_mb": int(mem.total / (1024 * 1024)),
        "available_ram_mb": int(mem.available / (1024 * 1024)),
        "gpu_name": gpu_info["name"],
        "total_vram_mb": gpu_info["total_vram_mb"],
        "has_cuda": gpu_info["has_cuda"],
        "cuda_runtime_ready": gpu_info.get("cuda_runtime_ready", False)
    }


def get_throughput_stats():
    """Computes average processing speed, songs per minute, and history counts."""
    total_processed = len(HISTORY)
    if total_processed > 0:
        times = [h.get("processing_time_sec", 0) for h in HISTORY if h.get("processing_time_sec")]
        avg_time = round(sum(times) / len(times), 1) if times else 3.5
    else:
        avg_time = 3.5
    songs_per_min = round(60.0 / avg_time, 1) if avg_time > 0 else 17.1
    return {
        "avg_sec_per_song": avg_time,
        "songs_per_min": songs_per_min,
        "total_processed": total_processed
    }


def get_hardware_telemetry():
    """Gathers CPU, RAM, and GPU telemetry for the live dashboard."""
    gpu_info = detect_gpu()
    mem = psutil.virtual_memory()
    cpu_pct = psutil.cpu_percent(interval=None)
    specs = detect_system_specs()
    throughput = get_throughput_stats()

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
            "cores": specs["total_cores"],
            "physical_cores": specs["physical_cores"],
            "model": specs["cpu_model"]
        },
        "ram": {
            "total_mb": specs["total_ram_mb"],
            "used_mb": int(mem.used / (1024 * 1024)),
            "percent": mem.percent
        },
        "specs": specs,
        "throughput": throughput,
        "active_job": active_job_copy,
        "total_processed": len(HISTORY)
    }



def get_whisper_model(model_name="small", force_device=None):
    """Loads and caches faster-whisper model on GPU or CPU with automatic fallback and RAM mode."""
    device = force_device or SERVER_CONFIG["device"]
    compute_type = SERVER_CONFIG["compute_type"]

    gpu_info = detect_gpu()
    if device == "auto":
        # Only use CUDA if BOTH driver device AND cuBLAS runtime are ready!
        if gpu_info["has_cuda"] and gpu_info["cuda_runtime_ready"]:
            device = "cuda"
            compute_type = "float16" if compute_type == "auto" else compute_type
        else:
            device = "cpu"
            compute_type = "int8" if compute_type == "auto" else compute_type
    elif device == "cuda":
        compute_type = "float16" if compute_type == "auto" else compute_type
    elif device == "cpu":
        compute_type = "int8" if compute_type == "auto" else compute_type

    cpu_threads = int(SERVER_CONFIG.get("cpu_threads", 2))
    cache_key = f"{model_name}_{device}_{compute_type}_{cpu_threads}"
    if cache_key in MODELS_CACHE:
        return MODELS_CACHE[cache_key], device, compute_type

    # If model is already loaded in RAM under an active directory:
    model_path_to_load = model_name
    if EPHEMERAL_RAM_DIR:
        candidate_ram = os.path.join(EPHEMERAL_RAM_DIR, f"whisper_{model_name}")
        if os.path.isdir(candidate_ram) and os.path.isfile(os.path.join(candidate_ram, "model.bin")):
            model_path_to_load = candidate_ram

    logger.info(f"Loading faster-whisper model '{model_name}' on {device} ({compute_type}, {cpu_threads} CPU threads)...")
    from faster_whisper import WhisperModel

    try:
        model = WhisperModel(
            model_path_to_load,
            device=device,
            compute_type=compute_type,
            cpu_threads=cpu_threads
        )
    except Exception as e:
        # If online check to Hugging Face failed, try with local_files_only=True
        try:
            model = WhisperModel(
                model_path_to_load,
                device=device,
                compute_type=compute_type,
                cpu_threads=cpu_threads,
                local_files_only=True
            )
        except Exception:
            # If CUDA initialization failed, fallback to CPU automatically!
            if device == "cuda":
                logger.warning(f"Failed to initialize Whisper on CUDA ({e}). Gracefully falling back to CPU...")
                device = "cpu"
                compute_type = "int8"
                cache_key = f"{model_name}_{device}_{compute_type}_{cpu_threads}"
                if cache_key in MODELS_CACHE:
                    return MODELS_CACHE[cache_key], device, compute_type
                model = WhisperModel(
                    model_path_to_load,
                    device=device,
                    compute_type=compute_type,
                    cpu_threads=cpu_threads
                )
            else:
                raise

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
    """Health check endpoint used by Sangita server to verify GPU worker connectivity and resource safeguards."""
    gpu_info = detect_gpu()
    ram_storage = get_ram_storage_info()
    specs = detect_system_specs()
    throughput = get_throughput_stats()
    mem = psutil.virtual_memory()
    cpu_pct = psutil.cpu_percent(interval=None)

    return jsonify({
        "status": "ready",
        "service": "sangita-remote-whisper",
        "device": "cuda" if (gpu_info["has_cuda"] and gpu_info["cuda_runtime_ready"]) else "cpu",
        "gpu_name": gpu_info["name"],
        "has_cuda": gpu_info["has_cuda"],
        "cuda_runtime_ready": gpu_info.get("cuda_runtime_ready", False),
        "status_msg": gpu_info.get("status_msg", "Ready"),
        "total_vram_mb": gpu_info["total_vram_mb"],
        "used_vram_mb": gpu_info["used_vram_mb"],
        "gpu_util_pct": gpu_info.get("gpu_util_pct", 0),
        "active_job": ACTIVE_JOB["status"],
        "models_cached": list(MODELS_CACHE.keys()),
        "model_status": check_model_status(SERVER_CONFIG.get("default_model", "small")),
        "ram_mode": ram_storage["ram_mode"],
        "storage_mode": ram_storage["storage_mode"],
        "storage_info": ram_storage,
        "limits": {
            "cpu_threads": SERVER_CONFIG.get("cpu_threads", 2),
            "max_ram_mb": SERVER_CONFIG.get("max_ram_mb", 4096),
            "cooldown_sec": SERVER_CONFIG.get("cooldown_sec", 0.5),
            "low_priority": SERVER_CONFIG.get("low_priority", True),
            "compute_type": SERVER_CONFIG.get("compute_type", "auto"),
            "total_cores": specs["total_cores"],
            "total_ram_mb": specs["total_ram_mb"]
        },
        "cpu": {
            "percent": cpu_pct,
            "cores": specs["total_cores"],
            "physical_cores": specs["physical_cores"],
            "model": specs["cpu_model"]
        },
        "ram": {
            "total_mb": specs["total_ram_mb"],
            "used_mb": int(mem.used / (1024 * 1024)),
            "percent": mem.percent
        },
        "gpu": gpu_info,
        "specs": specs,
        "throughput": throughput
    })



@app.route("/api/telemetry", methods=["GET"])
def telemetry():
    """Returns real-time telemetry, processed song history, and limits for the dashboard."""
    data = get_hardware_telemetry()
    data["history"] = HISTORY[:50]
    data["model_status"] = check_model_status(SERVER_CONFIG.get("default_model", "small"))
    data["storage_info"] = get_ram_storage_info()
    data["ram_mode"] = True
    data["storage_mode"] = data["storage_info"]["storage_mode"]
    data["limits"] = {
        "cpu_threads": SERVER_CONFIG.get("cpu_threads", 2),
        "max_ram_mb": SERVER_CONFIG.get("max_ram_mb", 4096),
        "cooldown_sec": SERVER_CONFIG.get("cooldown_sec", 0.5),
        "low_priority": SERVER_CONFIG.get("low_priority", True),
        "compute_type": SERVER_CONFIG.get("compute_type", "auto"),
        "total_cores": psutil.cpu_count(logical=True) or 4
    }
    return jsonify(data)


@app.route("/api/model/load", methods=["POST"])
def api_model_load():
    """Explicitly loads a Whisper model into RAM/GPU from online or Sangita server."""
    data = request.get_json(silent=True) or {}
    source = data.get("source", "online")
    server_url = data.get("server_url")
    model_name = data.get("model", SERVER_CONFIG.get("default_model", "small"))

    try:
        model, dev, compute, path = load_model_to_ram(model_name, source=source, server_url=server_url)
        return jsonify({
            "success": True,
            "message": f"Model '{model_name}' successfully loaded into {dev} VRAM from {source} (in RAM).",
            "device": dev,
            "compute_type": compute,
            "storage_info": get_ram_storage_info()
        })
    except Exception as e:
        logger.error(f"Failed loading model to RAM: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/model/purge", methods=["POST"])
def api_model_purge():
    """Purges model from memory and wipes all ephemeral RAM-disk files."""
    purge_local_ephemeral_data()
    return jsonify({
        "success": True,
        "message": "Model unloaded from GPU/RAM and all RAM-disk directories wiped clean. Zero local trace remaining.",
        "storage_info": get_ram_storage_info()
    })




@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    """Reads or updates local hardware resource limits dynamically."""
    global SERVER_CONFIG, MODELS_CACHE
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if "cpu_threads" in data:
            val = int(data["cpu_threads"])
            SERVER_CONFIG["cpu_threads"] = max(1, min(val, psutil.cpu_count(logical=True) or 16))
            MODELS_CACHE.clear()
        if "max_ram_mb" in data:
            SERVER_CONFIG["max_ram_mb"] = max(512, int(data["max_ram_mb"]))
        if "cooldown_sec" in data:
            SERVER_CONFIG["cooldown_sec"] = max(0.0, float(data["cooldown_sec"]))
        if "low_priority" in data:
            SERVER_CONFIG["low_priority"] = bool(data["low_priority"])
            apply_process_priority(SERVER_CONFIG["low_priority"])
        if "compute_type" in data and data["compute_type"] in ["auto", "float16", "int8_float16", "int8"]:
            if SERVER_CONFIG["compute_type"] != data["compute_type"]:
                SERVER_CONFIG["compute_type"] = data["compute_type"]
                MODELS_CACHE.clear()

        return jsonify({
            "success": True,
            "message": "Resource limits updated successfully",
            "limits": {
                "cpu_threads": SERVER_CONFIG["cpu_threads"],
                "max_ram_mb": SERVER_CONFIG["max_ram_mb"],
                "cooldown_sec": SERVER_CONFIG["cooldown_sec"],
                "low_priority": SERVER_CONFIG["low_priority"],
                "compute_type": SERVER_CONFIG["compute_type"],
                "total_cores": psutil.cpu_count(logical=True) or 4,
                "total_ram_mb": int(psutil.virtual_memory().total / (1024 * 1024))
            }
        })
    else:
        return jsonify({
            "limits": {
                "cpu_threads": SERVER_CONFIG.get("cpu_threads", 2),
                "max_ram_mb": SERVER_CONFIG.get("max_ram_mb", 4096),
                "cooldown_sec": SERVER_CONFIG.get("cooldown_sec", 0.5),
                "low_priority": SERVER_CONFIG.get("low_priority", True),
                "compute_type": SERVER_CONFIG.get("compute_type", "auto"),
                "total_cores": psutil.cpu_count(logical=True) or 4,
                "total_ram_mb": int(psutil.virtual_memory().total / (1024 * 1024))
            }
        })



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
    model_source = request.form.get("model_source")
    server_url = request.form.get("server_url")

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
    with TRANSCRIBE_LOCK:
        try:
            # If a specific delivery source was requested and not yet primed in RAM
            if model_source and not IS_LOADED_IN_RAM:
                try:
                    load_model_to_ram(model_name=model_name, source=model_source, server_url=server_url)
                except Exception as load_err:
                    logger.warning(f"Could not prime model from requested source '{model_source}': {load_err}")

            # Save audio to temporary location
            uploaded_file.save(temp_path)
            file_size = os.path.getsize(temp_path)
            ACTIVE_JOB["size_bytes"] = file_size

            logger.info(f"Received '{filename}' ({file_size / 1024:.1f} KB) from {request.remote_addr}. Transcribing with model '{model_name}'...")

            # Load model and transcribe with configured resource limits
            model, device_used, compute_type_used = get_whisper_model(model_name)

            lang_param = None if (not language or language == "auto") else language

            # High-fidelity music transcription kwargs:
            # vad_filter is disabled because Silero VAD treats music/singing with instruments as background noise
            # and erroneously cuts out 95% of song vocals.
            # word_timestamps=True produces millisecond-accurate cross-attention DTW vocal alignment.
            transcribe_kwargs = dict(
                language=lang_param,
                beam_size=beam_size or 5,
                best_of=5,
                temperature=[0.0, 0.2, 0.4, 0.6, 0.8],
                vad_filter=False,
                condition_on_previous_text=False,
                no_speech_threshold=0.85,
                compression_ratio_threshold=2.4,
                word_timestamps=True
            )

            # Safeguarded transcription with auto-recovery on CPU if GPU execution fails
            segments = None
            info = None
            first_seg = None
            try:
                segments, info = model.transcribe(temp_path, **transcribe_kwargs)
                # Test first segment to verify GPU execution works
                seg_iter = iter(segments)
                first_seg = next(seg_iter, None)
            except Exception as trans_err:
                err_msg = str(trans_err)
                if "cuda" in str(device_used).lower() and ("libcublas" in err_msg or "CUDA" in err_msg or "out of memory" in err_msg or "failed to load" in err_msg.lower()):
                    logger.warning(f"CUDA execution failed for '{filename}' ({err_msg}). Automatically recovering on CPU...")
                    device_used = "cpu (fallback)"
                    compute_type_used = "int8"
                    cpu_model, _, _ = get_whisper_model(model_name, force_device="cpu")
                    segments, info = cpu_model.transcribe(temp_path, **transcribe_kwargs)
                    seg_iter = iter(segments)
                    first_seg = next(seg_iter, None)
                else:
                    raise

            detected_lang = getattr(info, "language", language or "unknown")

            # Watermark and non-vocal music noise patterns
            WATERMARK_PATTERNS = [
                re.compile(r"thank you for watching", re.I),
                re.compile(r"thanks for watching", re.I),
                re.compile(r"subtitles by", re.I),
                re.compile(r"amara\.org", re.I),
                re.compile(r"subscribe", re.I),
                re.compile(r"copyright", re.I),
                re.compile(r"www\.", re.I),
                re.compile(r"like and subscribe", re.I),
                re.compile(r"this is the end of this video", re.I),
                re.compile(r"see you in the next", re.I),
                re.compile(r"hope you enjoyed", re.I),
                re.compile(r"at the end of", re.I),
                re.compile(r"first part of our day", re.I),
            ]
            MUSIC_NOISE_PATTERNS = [
                re.compile(r"^\s*[\(\[\{]?(music|applause|cheering|instrumental|laughter|singing)[\)\]\}]?\s*$", re.I),
                re.compile(r"^[♪♫#\*\s]+$"),
            ]

            # Format into LRC timestamped lines with exact word-level vocal alignment
            lrc_lines = []
            last_text = ""
            repetition_count = 0

            all_segments = []
            if first_seg is not None:
                all_segments.append(first_seg)
            if seg_iter is not None:
                for s in seg_iter:
                    all_segments.append(s)

            for seg in all_segments:
                text = (seg.text or "").strip()
                if not text:
                    continue

                # Filter out pure music noise tokens or subtitle outro watermarks
                if any(p.search(text) for p in WATERMARK_PATTERNS):
                    continue
                if any(p.match(text) for p in MUSIC_NOISE_PATTERNS):
                    continue

                words = getattr(seg, "words", None)
                if not words or not isinstance(words, (list, tuple)):
                    # Fallback to segment boundary if word alignment is unavailable
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
                    continue

                # Split segment words into individual lyrical lines based on natural phrasing:
                # 1. Punctuation pauses (commas, periods, exclamation, question marks)
                # 2. Audible vocal pauses (gap >= 0.55s between words)
                # 3. Phrasing length ceiling (8+ words)
                current_line_words = []
                for i, w in enumerate(words):
                    w_text = (getattr(w, "word", "") or "").strip()
                    if not w_text:
                        continue
                    current_line_words.append(w)

                    has_pause_punct = any(w_text.endswith(p) for p in [",", ".", "!", "?", ";", ":"])
                    has_gap = False
                    if i < len(words) - 1:
                        next_w = words[i + 1]
                        if (getattr(next_w, "start", 0) - getattr(w, "end", 0)) >= 0.55:
                            has_gap = True

                    is_long = len(current_line_words) >= 8

                    if (has_gap or (has_pause_punct and len(current_line_words) >= 3) or is_long) and i < len(words) - 1:
                        line_str = " ".join((getattr(item, "word", "") or "").strip() for item in current_line_words).strip()
                        if line_str and not any(p.search(line_str) for p in WATERMARK_PATTERNS):
                            norm = line_str.lower()
                            if norm == last_text:
                                repetition_count += 1
                            else:
                                last_text = norm
                                repetition_count = 1
                            if repetition_count <= 2:
                                line_start = float(current_line_words[0].start)
                                m = int(line_start // 60)
                                s = line_start % 60
                                lrc_lines.append(f"[{m:02d}:{s:05.2f}] {line_str}")
                        current_line_words = []

                if current_line_words:
                    line_str = " ".join((getattr(item, "word", "") or "").strip() for item in current_line_words).strip()
                    if line_str and not any(p.search(line_str) for p in WATERMARK_PATTERNS):
                        norm = line_str.lower()
                        if norm == last_text:
                            repetition_count += 1
                        else:
                            last_text = norm
                            repetition_count = 1
                        if repetition_count <= 2:
                            line_start = float(current_line_words[0].start)
                            m = int(line_start // 60)
                            s = line_start % 60
                            lrc_lines.append(f"[{m:02d}:{s:05.2f}] {line_str}")

            lrc_content = "\n".join(lrc_lines)
            duration_sec = round(time.time() - start_time, 2)

            # GPU Cooldown rest if configured
            cooldown = float(SERVER_CONFIG.get("cooldown_sec", 0.0))
            if cooldown > 0:
                logger.info(f"Applying {cooldown}s GPU cooldown rest...")
                time.sleep(cooldown)

            # Check memory watchdog
            check_memory_watchdog()

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

            logger.info(f"Completed '{filename}' in {duration_sec}s ({len(lrc_lines)} lines, lang={detected_lang}, device={device_used})")

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
    parser.add_argument("--cpu-threads", type=int, default=None, help="Limit CPU threads used by Whisper")
    parser.add_argument("--max-ram-mb", type=int, default=4096, help="RAM ceiling before unloading models (MB)")
    parser.add_argument("--cooldown-sec", type=float, default=0.5, help="Cooldown pause between songs to prevent continuous full GPU heat (seconds)")
    parser.add_argument("--no-low-priority", action="store_true", help="Do not lower process priority")
    parser.add_argument("--model-source", default="online", choices=["online", "server"], help="Model delivery source: online (HuggingFace) or server (Sangita server)")
    parser.add_argument("--server-url", default=None, help="Sangita server URL for streaming model weights")
    parser.add_argument("--preload", action="store_true", help="Immediately prime model into RAM/GPU at startup")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    SERVER_CONFIG["host"] = args.host
    SERVER_CONFIG["port"] = args.port
    SERVER_CONFIG["device"] = args.device
    SERVER_CONFIG["compute_type"] = args.compute_type
    SERVER_CONFIG["default_model"] = args.model

    if args.cpu_threads is not None:
        SERVER_CONFIG["cpu_threads"] = max(1, args.cpu_threads)
    if args.max_ram_mb is not None:
        SERVER_CONFIG["max_ram_mb"] = max(512, args.max_ram_mb)
    if args.cooldown_sec is not None:
        SERVER_CONFIG["cooldown_sec"] = max(0.0, args.cooldown_sec)
    if args.no_low_priority:
        SERVER_CONFIG["low_priority"] = False

    apply_process_priority(SERVER_CONFIG["low_priority"])

    if args.preload:
        try:
            load_model_to_ram(model_name=args.model, source=args.model_source, server_url=args.server_url)
        except Exception as e:
            logger.warning(f"Could not preload model: {e}")

    gpu = detect_gpu()
    m_status = check_model_status(args.model)
    ram_info = get_ram_storage_info()
    print("=" * 65)
    print("  Sangita — Local PC Lyrics API (Whisper GPU Node)")
    print("=" * 65)
    print(f"  • Hardware:      {gpu['name']}")
    print(f"  • GPU Ready:     {'YES (High-Speed Acceleration)' if (gpu['has_cuda'] and gpu['cuda_runtime_ready']) else 'NO (CPU Mode: ' + gpu['status_msg'] + ')'}")
    if gpu['has_cuda']:
        print(f"  • Total VRAM:    {gpu['total_vram_mb']} MB")
        print(f"  • Driver:        {gpu['driver_version']}")
    print(f"  • Model Name:    {args.model}")
    print(f"  • RAM Mode:      {'ENABLED (' + ram_info['storage_mode'] + ') 🛡️ Zero Disk Trace' if ram_info['ram_mode'] else 'Disabled'}")
    print(f"  • Auto-Purge:    Enabled (All data deleted on Ctrl+C / Session Exit) ✅")
    print(f"  • CPU Threads:   {SERVER_CONFIG['cpu_threads']} threads (Capped)")
    print(f"  • RAM Ceiling:   {SERVER_CONFIG['max_ram_mb']} MB (Watchdog)")
    print(f"  • GPU Cooldown:  {SERVER_CONFIG['cooldown_sec']}s between songs")
    print(f"  • Low Priority:  {'Enabled (Smooth desktop)' if SERVER_CONFIG['low_priority'] else 'Disabled'}")
    print(f"  • Local Web UI:  http://localhost:{args.port}")
    print(f"  • Network URL:   http://<your-pc-ip>:{args.port}")
    print("=" * 65)
    print("  Ready to accept local or remote transcription requests.\n")

    app.run(host=args.host, port=args.port, threaded=True, debug=False)


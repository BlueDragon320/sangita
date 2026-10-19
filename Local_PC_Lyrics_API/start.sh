#!/usr/bin/env bash
# Sangita Remote GPU Whisper Server Launcher (Linux / macOS)

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting Sangita Remote GPU Whisper Node..."
echo "=========================================================="

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
MODEL="${MODEL:-small}"

# Check python
if command -v python3 &>/dev/null; then
    PY_BIN="python3"
elif command -v python &>/dev/null; then
    PY_BIN="python"
else
    echo "Error: Python 3 is not installed or not in PATH."
    exit 1
fi

echo "Using Python: $($PY_BIN --version)"

# Check requirements
$PY_BIN -c "import flask, faster_whisper, psutil" 2>/dev/null || {
    echo "Installing missing dependencies from requirements.txt..."
    $PY_BIN -m pip install -r requirements.txt
}

# Auto-discover NVIDIA pip packages and export LD_LIBRARY_PATH so CTranslate2 finds libcublas.so.12 & libcudnn
NVIDIA_PATHS=$($PY_BIN -c "
import os, site
paths = []
search_dirs = []
if hasattr(site, 'getsitepackages'):
    search_dirs.extend(site.getsitepackages())
if hasattr(site, 'getusersitepackages'):
    search_dirs.append(site.getusersitepackages())
for sdir in search_dirs:
    nv = os.path.join(sdir, 'nvidia')
    if os.path.isdir(nv):
        for sub in os.listdir(nv):
            lib = os.path.join(nv, sub, 'lib')
            if os.path.isdir(lib):
                paths.append(lib)
print(':'.join(paths))
" 2>/dev/null || true)

if [ -n "$NVIDIA_PATHS" ]; then
    export LD_LIBRARY_PATH="${NVIDIA_PATHS}:${LD_LIBRARY_PATH:-}"
fi

# Run server
exec $PY_BIN server.py --host "$HOST" --port "$PORT" --model "$MODEL"

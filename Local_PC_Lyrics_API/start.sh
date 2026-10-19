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

# Run server
exec $PY_BIN server.py --host "$HOST" --port "$PORT" --model "$MODEL"

@echo off
REM Sangita Remote GPU Whisper Server Launcher (Windows)
TITLE Sangita Remote GPU Whisper Server

cd /d "%~dp0"

echo ==========================================================
echo  Starting Sangita Remote GPU Whisper Node (Windows)
echo ==========================================================

REM Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python is not installed or not in your PATH.
    echo Please install Python 3.10+ from python.org and add to PATH.
    pause
    exit /b 1
)

REM Check/install dependencies
python -c "import flask, faster_whisper, psutil" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing dependencies from requirements.txt...
    python -m pip install -r requirements.txt
)

echo Starting Whisper GPU API Server on http://localhost:8000 ...
python server.py --host 0.0.0.0 --port 8000 --model small
pause

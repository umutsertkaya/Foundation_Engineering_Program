@echo off
setlocal
cd /d "%~dp0kaynak"
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv || (echo Python 3.11+ gerekli. & pause & exit /b 1)
  ".venv\Scripts\python.exe" -m pip install -e ".[report]" fastapi uvicorn || (pause & exit /b 1)
)
set GEOTEK_WEB_DIST=%cd%\web\dist
".venv\Scripts\python.exe" -m geotek.launcher
pause

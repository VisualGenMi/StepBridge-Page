@echo off
setlocal
cd /d "%~dp0"

rem Prefer the Python shipped with the local toolchain; fall back to PATH.
set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo   StepBridge project page
echo   http://127.0.0.1:8899/
echo.
echo   Press Ctrl+C to stop the server.
echo.

start "" "http://127.0.0.1:8899/"
"%PY%" -m http.server 8899 --bind 127.0.0.1
pause

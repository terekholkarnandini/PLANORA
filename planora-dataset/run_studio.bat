@echo off
REM =========================================================
REM PLANORA AI Studio - Launch Server and Open in Browser
REM =========================================================

echo.
echo ========================================================
echo   PLANORA AI Studio (Conversational 2D/3D Floor Planner)
echo ========================================================
echo.
echo Starting local server on http://localhost:8000 ...
echo Press Ctrl+C in this window to stop the server when done.
echo.

start "" "http://localhost:8000/planner.html"
python server.py

pause

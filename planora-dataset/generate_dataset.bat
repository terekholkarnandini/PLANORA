@echo off
REM =========================================================
REM PLANORA - One-Click Automated Dataset Generation Pipeline
REM =========================================================

echo.
echo ========================================================
echo   PLANORA AUTOMATED DATASET PIPELINE
echo ========================================================
echo.

set /p COUNT="Enter number of plans to generate [default: 50]: "
if "%COUNT%"=="" set COUNT=50

echo.
echo Running automated generation and ML packaging for %COUNT% plans...
python generator/automate.py --count %COUNT%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Opening interactive browser explorer...
    start preview.html
) else (
    echo.
    echo Generation encountered an error. Please inspect the log above.
)

pause

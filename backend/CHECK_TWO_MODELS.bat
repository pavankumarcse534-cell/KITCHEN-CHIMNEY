@echo off
echo ========================================
echo Check Two Model Types Status
echo ========================================
echo.
echo This script will check if GLB files are uploaded for:
echo   1. WMSS SINGLE SKIN 1 SEC
echo   2. ONE COLLAR (HOLE) SINGLE SKIN
echo.
pause

cd /d "%~dp0"

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo Virtual environment activated
) else if exist "..\venv\Scripts\activate.bat" (
    call ..\venv\Scripts\activate.bat
    echo Virtual environment activated
) else (
    echo No virtual environment found, using system Python
)

echo.
echo Checking model types...
echo.

python ensure_two_model_types.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


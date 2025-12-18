@echo off
echo ========================================
echo Link Existing GLB Files to Model Types
echo ========================================
echo.
echo This script will automatically find and link GLB files:
echo   1. WMSS SINGLE SKIN 1 SEC
echo   2. ONE COLLAR HOLE SINGLE SKIN
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
echo Linking GLB files...
echo.

python link_existing_glb_files.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


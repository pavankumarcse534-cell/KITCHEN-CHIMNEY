@echo off
echo ========================================
echo Upload GLB Files for Two Model Types
echo ========================================
echo.
echo This script will help you upload GLB files for:
echo   1. WMSS SINGLE SKIN 1 SEC
echo   2. ONE COLLAR SINGLE SKIN
echo.
echo Make sure you have GLB files ready in a directory!
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
echo Running upload script...
echo.

python upload_two_model_types.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


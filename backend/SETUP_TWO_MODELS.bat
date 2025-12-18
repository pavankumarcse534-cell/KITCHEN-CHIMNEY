@echo off
echo ========================================
echo Setup Two Model Types
echo ========================================
echo.
echo This script will ensure both model types are ready:
echo   1. WMSS SINGLE SKIN 1 SEC
echo   2. ONE COLLAR SINGLE SKIN
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
echo Setting up model types...
echo.

python setup_two_models.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


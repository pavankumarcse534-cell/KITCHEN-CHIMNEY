@echo off
echo ========================================
echo GLB File Duplication Script
echo ========================================
echo.
echo This script will duplicate the GLB file from 'uv_compensating_main_assembly_5_sec'
echo to 7 additional model types.
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
echo Running duplication script...
echo.

python duplicate_glb_to_model_types.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


@echo off
echo ========================================
echo Add Multiple GLB Files to Design
echo ========================================
echo.
echo This script will add 5 additional GLB files
echo to the 'uv_compensating_main_assembly_5_sec' design.
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
echo Running script to add multiple GLB files...
echo.

python add_multiple_glb_to_design.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


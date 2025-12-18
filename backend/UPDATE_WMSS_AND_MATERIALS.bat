@echo off
echo ========================================
echo Update WMSS SINGLE SKIN 1 SEC and Material Types
echo ========================================
echo.
echo This script will:
echo 1. Ensure WMSS SINGLE SKIN 1 SEC is properly configured
echo 2. Update all material types (Stainless Steel 202 and 304)
echo.

cd /d "%~dp0"

REM Check if virtual environment exists and activate it
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found, using system Python
)

echo.
echo Step 1: Ensuring all model types exist (including WMSS SINGLE SKIN 1 SEC)...
echo.
python manage.py setup_model_types --skip-material

echo.
echo Step 2: Updating material types for all model types...
echo This will set:
echo   - WMSS SINGLE SKIN 1 SEC: Stainless Steel 202 (Sheet 202)
echo   - Single sections: Stainless Steel 202 (Sheet 202)
echo   - Main assemblies: Stainless Steel 304 (Sheet 304)
echo   - Component parts: Stainless Steel 202 (Sheet 202)
echo.
python manage.py update_material_types --force

echo.
echo ========================================
echo Update Complete
echo ========================================
echo.
echo WMSS SINGLE SKIN 1 SEC Configuration:
echo   - Model Type: wmss_single_skin_1_sec
echo   - Display Title: WMSS SINGLE SKIN 1 SEC
echo   - Material Type: Stainless Steel 202 (Sheet 202)
echo.
echo Material Type Distribution:
echo   - Stainless Steel 202 (Sheet 202): Single sections and component parts
echo   - Stainless Steel 304 (Sheet 304): Main assemblies (premium quality)
echo.
pause


@echo off
echo ========================================
echo Update Material Types for All 17 GLB Model Types
echo ========================================
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
echo Running material type update command...
echo.

python manage.py update_material_types

echo.
echo ========================================
echo Update Complete
echo ========================================
echo.
echo To force update all material types (even if already set):
echo   python manage.py update_material_types --force
echo.
pause


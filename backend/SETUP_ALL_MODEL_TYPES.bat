@echo off
echo ========================================
echo Setup All 17 Model Types with Material Types
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
echo Running setup command...
echo This will:
echo 1. Create all 17 model types in the database
echo 2. Set material types (Sheet 202 and Sheet 304)
echo.

python manage.py setup_model_types

echo.
echo ========================================
echo Setup Complete
echo ========================================
echo.
echo Next steps:
echo 1. Go to Django Admin: http://localhost:8000/admin/api/chimneydesign/
echo 2. Upload GLB files for each model type
echo.
pause


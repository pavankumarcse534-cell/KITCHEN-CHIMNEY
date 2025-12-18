@echo off
echo ========================================
echo Ensure All Model Types Exist in Database
echo ========================================
echo.
echo This script will ensure all 17 model types exist in the database.
echo Missing model types will be auto-created with correct material types.
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
echo Running setup command to ensure all model types exist...
echo.

python manage.py setup_model_types

echo.
echo ========================================
echo Verification Complete
echo ========================================
echo.
echo All model types should now exist in the database.
echo You can verify by:
echo 1. Going to Django Admin: http://localhost:8000/admin/api/chimneydesign/
echo 2. Checking that all 17 model types are listed
echo.
echo Note: The API endpoints will also auto-create missing model types
echo when they are requested, so this is mainly for initial setup.
echo.
pause


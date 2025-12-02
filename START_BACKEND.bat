@echo off
echo ========================================
echo Starting Django Backend Server
echo ========================================
echo.

cd /d "%~dp0backend"

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found, using system Python
)

echo.
echo Starting backend server at http://127.0.0.1:8000
echo.
echo Press CTRL+C to stop the server
echo.

    python manage.py runserver 0.0.0.0:8000

pause

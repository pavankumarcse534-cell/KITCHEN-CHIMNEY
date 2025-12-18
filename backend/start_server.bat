@echo off
echo ========================================
echo Starting Django Backend Server
echo ========================================
echo.

REM Make sure we're in the backend directory
cd /d "%~dp0"

echo Checking Python...
python --version
if errorlevel 1 (
    echo ERROR: Python not found!
    pause
    exit /b 1
)

echo.
echo Checking Django...
python -c "import django; print('Django version:', django.get_version())" 2>nul
if errorlevel 1 (
    echo ERROR: Django not installed!
    echo Please run: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo Running system check...
python manage.py check
if errorlevel 1 (
    echo WARNING: System check found issues!
    echo Continuing anyway...
)

echo.
echo ========================================
echo Starting server on http://0.0.0.0:8000
echo ========================================
echo.
echo Server URLs:
echo   - API: http://localhost:8000/api/
echo   - Health: http://localhost:8000/api/health/
echo   - Admin: http://localhost:8000/admin/
echo.
echo Press CTRL+C to stop the server
echo.

REM Start the server
python manage.py runserver 0.0.0.0:8000

pause

@echo off
REM Permanent Django Server Startup Script
REM This script ensures the server stays running and auto-restarts on failure

echo ========================================
echo Starting Django Backend Server (Permanent)
echo ========================================
echo.

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Change to backend directory
cd backend
if errorlevel 1 (
    echo ERROR: Cannot find backend directory!
    echo Please ensure this script is in the project root directory.
    pause
    exit /b 1
)

REM Kill any existing processes on port 8000
echo Checking for existing server processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Killing existing process %%a on port 8000...
    taskkill /PID %%a /F >nul 2>&1
)

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found at backend\venv\
    echo Attempting to use system Python...
    echo.
)

REM Check if Django is installed
python -c "import django; print('Django version:', django.get_version())" 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Django is not installed!
    echo.
    echo Attempting to install dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies!
        echo Please install manually:
        echo   cd backend
        echo   pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

echo.
echo Running Django system check...
python manage.py check
if errorlevel 1 (
    echo.
    echo WARNING: Django system check found issues!
    echo Continuing anyway...
    echo.
)

REM Check for pending migrations and apply if needed
echo.
echo Checking for pending migrations...
python manage.py showmigrations --list | findstr /C:"[ ]" >nul
if errorlevel 0 (
    echo WARNING: There are pending migrations!
    echo Applying migrations...
    python manage.py migrate
    if errorlevel 1 (
        echo WARNING: Migration failed, but continuing...
    ) else (
        echo Migrations applied successfully!
    )
    echo.
)

echo.
echo ========================================
echo Starting Django server on http://localhost:8000
echo This window must stay open for the server to run
echo Press Ctrl+C to stop the server
echo ========================================
echo.
echo Server will be available at:
echo   - API: http://localhost:8000/api/
echo   - Health Check: http://localhost:8000/api/health/
echo   - Admin: http://localhost:8000/admin/
echo   - GLB Upload: http://localhost:8000/api/upload-glb/
echo.

REM Start Django development server with auto-restart on failure
:start_server
python manage.py runserver 0.0.0.0:8000
if errorlevel 1 (
    echo.
    echo ========================================
    echo Server crashed! Restarting in 5 seconds...
    echo ========================================
    timeout /t 5 /nobreak >nul
    goto start_server
)

echo.
echo ========================================
echo Server stopped.
echo ========================================
pause











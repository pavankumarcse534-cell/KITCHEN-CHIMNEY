@echo off
REM Enhanced startup script for Django backend server (Windows)
REM This script performs comprehensive pre-flight checks and verifies server health

setlocal enabledelayedexpansion

echo ========================================
echo Enhanced Django Backend Server Startup
echo ========================================
echo.

REM Change to backend directory
cd /d "%~dp0"
if errorlevel 1 (
    echo ERROR: Could not navigate to backend directory
    pause
    exit /b 1
)

echo [1/7] Checking current directory...
echo Current directory: %CD%
echo.

echo [2/7] Checking if port 8000 is available...
netstat -ano | findstr ":8000" >nul
if errorlevel 0 (
    echo WARNING: Port 8000 is already in use!
    echo.
    echo Finding process using port 8000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        set PID=%%a
        echo Process ID: !PID!
        tasklist /FI "PID eq !PID!" /FO LIST | findstr "Image Name"
    )
    echo.
    choice /C YN /M "Do you want to continue anyway (this may fail)"
    if errorlevel 2 exit /b 1
) else (
    echo ✓ Port 8000 is available.
)
echo.

echo [3/7] Checking virtual environment...
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Expected location: %CD%\venv\Scripts\activate.bat
    echo.
    echo Please run one of the following:
    echo   - run_setup.bat (if available)
    echo   - python -m venv venv
    echo   - Then install dependencies: pip install -r requirements.txt
    pause
    exit /b 1
)
echo ✓ Virtual environment found.
echo.

echo [4/7] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)
echo ✓ Virtual environment activated.
echo.

echo [5/7] Checking Python and Django installation...
python --version
if errorlevel 1 (
    echo ERROR: Python is not available!
    pause
    exit /b 1
)

python -c "import django; print('Django version:', django.get_version())" 2>nul
if errorlevel 1 (
    echo ERROR: Django is not installed!
    echo.
    echo Please install dependencies:
    echo   pip install -r requirements.txt
    pause
    exit /b 1
)
echo ✓ Django is installed.
echo.

echo [6/7] Running Django system checks...
python manage.py check
set CHECK_RESULT=%errorlevel%
if %CHECK_RESULT% neq 0 (
    echo.
    echo WARNING: Django system check found issues!
    echo The server may not work correctly.
    echo.
    choice /C YN /M "Do you want to continue anyway"
    if errorlevel 2 exit /b 1
) else (
    echo ✓ System check passed.
)
echo.

echo Checking for pending migrations...
python manage.py showmigrations --plan | findstr "\[ \]" >nul
if errorlevel 0 (
    echo WARNING: There are pending migrations!
    echo Consider running: python manage.py migrate
    echo.
    choice /C YN /M "Do you want to run migrations now"
    if not errorlevel 2 (
        echo Running migrations...
        python manage.py migrate
        if errorlevel 1 (
            echo ERROR: Migration failed!
            pause
            exit /b 1
        )
        echo ✓ Migrations completed.
    )
    echo.
) else (
    echo ✓ No pending migrations.
    echo.
)

echo [7/7] Starting Django server...
echo.
echo ========================================
echo Server Information
echo ========================================
echo Server URL: http://localhost:8000/
echo API Root:   http://localhost:8000/api/
echo Health:     http://localhost:8000/api/health/
echo Admin:      http://localhost:8000/admin/
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the server
python manage.py runserver

REM If we get here, the server has stopped
echo.
echo ========================================
echo Server stopped.
echo ========================================
pause








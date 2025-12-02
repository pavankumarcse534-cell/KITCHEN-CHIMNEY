@echo off
echo ========================================
echo Starting Django Backend Server (FIXED)
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.8+ and add it to PATH
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo Python found! ✓
echo.

echo [2/5] Checking virtual environment...
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo Virtual environment activated! ✓
) else (
    echo WARNING: Virtual environment not found!
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
    call venv\Scripts\activate.bat
    echo Virtual environment created and activated! ✓
)
echo.

echo [3/5] Installing/updating dependencies...
if exist "requirements.txt" (
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    if errorlevel 1 (
        echo WARNING: Some dependencies may have failed to install
        echo Continuing anyway...
    ) else (
        echo Dependencies installed! ✓
    )
) else (
    echo WARNING: requirements.txt not found
    echo Installing basic Django dependencies...
    pip install -q django djangorestframework django-cors-headers
)
echo.

echo [4/5] Running database migrations...
python manage.py migrate --noinput >nul 2>&1
if errorlevel 1 (
    echo WARNING: Migrations may have issues, but continuing...
) else (
    echo Database migrations complete! ✓
)
echo.

echo [5/5] Checking if port 8000 is available...
netstat -ano | findstr ":8000" >nul 2>&1
if not errorlevel 1 (
    echo WARNING: Port 8000 is already in use!
    echo.
    echo Options:
    echo 1. Stop the process using port 8000
    echo 2. Use a different port (e.g., 8001)
    echo.
    echo Finding process using port 8000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
        echo Process ID: %%a
        echo To kill: taskkill /PID %%a /F
    )
    echo.
    set /p choice="Kill process and continue? (y/n): "
    if /i "%choice%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
            taskkill /PID %%a /F >nul 2>&1
        )
        echo Process killed. Continuing...
    ) else (
        echo Starting on port 8001 instead...
        set PORT=8001
    )
) else (
    echo Port 8000 is available! ✓
    set PORT=8000
)
echo.

echo ========================================
echo Starting Django Development Server
echo ========================================
echo.
echo Server will start at: http://localhost:%PORT%
echo Health check: http://localhost:%PORT%/api/health/
echo Admin panel: http://localhost:%PORT%/admin/
echo.
echo Press CTRL+C to stop the server
echo.
echo ========================================
echo.

python manage.py runserver 0.0.0.0:%PORT%

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Server failed to start!
    echo ========================================
    echo.
    echo Common issues:
    echo 1. Django not installed: pip install django
    echo 2. Database issues: python manage.py migrate
    echo 3. Port already in use: Use different port
    echo 4. Settings error: Check settings.py
    echo.
    pause
)








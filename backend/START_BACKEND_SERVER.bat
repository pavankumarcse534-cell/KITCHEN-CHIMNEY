@echo off
echo ========================================
echo Starting Django Backend Server
echo ========================================
echo.

REM Change to backend directory
cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH!
    echo Please install Python 3.8+ and try again.
    pause
    exit /b 1
)

echo Python found:
python --version
echo.

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found.
    echo Using system Python. If you encounter issues, create a virtual environment:
    echo   python -m venv venv
    echo   venv\Scripts\activate.bat
    echo   pip install -r requirements.txt
    echo.
)

REM Check if Django is installed
python -c "import django; print('Django version:', django.get_version())" 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Django is not installed!
    echo Please install dependencies:
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
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

REM Check for pending migrations
echo.
echo Checking for pending migrations...
python manage.py showmigrations --list | findstr /C:"[ ]" >nul
if not errorlevel 1 (
    echo WARNING: There are pending migrations!
    echo Run 'python manage.py migrate' to apply them.
    echo.
)

REM Check if port 8000 is in use
netstat -ano | findstr ":8000" >nul
if not errorlevel 1 (
    echo.
    echo WARNING: Port 8000 is already in use!
    echo Please stop the existing server or use a different port.
    echo.
    echo To find and kill the process using port 8000:
    echo   netstat -ano | findstr ":8000"
    echo   taskkill /PID <PID> /F
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Starting Django server on http://0.0.0.0:8000
echo ========================================
echo.
echo Server will be available at:
echo   - API: http://localhost:8000/api/
echo   - Health Check: http://localhost:8000/api/health/
echo   - Admin: http://localhost:8000/admin/
echo.
echo Press CTRL+C to stop the server
echo.
echo ========================================
echo.

REM Start Django development server
python manage.py runserver 0.0.0.0:8000

REM If we get here, the server has stopped
echo.
echo ========================================
echo Server stopped.
echo ========================================
pause


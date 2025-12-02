@echo off
echo ========================================
echo Starting Backend Server
echo ========================================
echo.

cd /d "%~dp0"

REM Check if port 8000 is in use
netstat -ano | findstr ":8000" >nul 2>&1
if not errorlevel 1 (
    echo WARNING: Port 8000 is already in use!
    echo Trying to free the port...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

REM Check if virtual environment exists and activate it
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found, using system Python
)

echo.
echo ========================================
echo Starting Django Backend Server
echo ========================================
echo Backend URL: http://localhost:8000
echo API Health: http://localhost:8000/api/health/
echo Admin: http://localhost:8000/admin/
echo ========================================
echo.

python manage.py runserver 0.0.0.0:8000

pause

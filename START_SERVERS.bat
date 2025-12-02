@echo off
echo ========================================
echo Starting Backend and Frontend Servers
echo ========================================
echo.

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%chimney-craft-3d-main"

echo [1/2] Starting Backend Server...
cd /d "%BACKEND_DIR%"

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
    start "Backend Server - Port 8000" cmd /k "cd /d %BACKEND_DIR% && call venv\Scripts\activate.bat && echo Backend starting at http://localhost:8000 && echo Health: http://localhost:8000/api/health/ && python manage.py runserver 0.0.0.0:8000"
) else (
    echo WARNING: Virtual environment not found, using system Python
    start "Backend Server - Port 8000" cmd /k "cd /d %BACKEND_DIR% && echo Backend starting at http://localhost:8000 && echo Health: http://localhost:8000/api/health/ && python manage.py runserver 0.0.0.0:8000"
)

echo Backend server starting...
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server...
cd /d "%FRONTEND_DIR%"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

start "Frontend Server" cmd /k "cd /d %FRONTEND_DIR% && echo Frontend starting... && npm run dev"

echo.
echo ========================================
echo Servers Starting...
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173 (or check terminal)
echo.
echo Press any key to exit this window (servers will continue running)
pause >nul


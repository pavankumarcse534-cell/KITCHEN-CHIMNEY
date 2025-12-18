@echo off
echo ========================================
echo Backend Connection Quick Fix
echo ========================================
echo.
echo This script will:
echo 1. Check backend server status
echo 2. Free port 8000 if needed
echo 3. Start backend server
echo 4. Verify it's running
echo.
pause

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"

echo [Step 1/4] Checking backend server status...
cd /d "%BACKEND_DIR%"

REM Check if backend is already running
curl -s http://localhost:8000/api/health/ >nul 2>&1
if not errorlevel 1 (
    echo Backend server is already running!
    echo.
    echo Backend URL: http://localhost:8000
    echo Health Check: http://localhost:8000/api/health/
    echo.
    echo If you're still having connection issues, try:
    echo 1. Check browser console for CORS errors
    echo 2. Verify frontend is pointing to correct backend URL
    echo 3. Check firewall settings
    echo.
    pause
    exit /b 0
)

echo Backend server is not running.
echo.

echo [Step 2/4] Checking port 8000...
netstat -ano | findstr ":8000" >nul 2>&1
if not errorlevel 1 (
    echo Port 8000 is in use. Attempting to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        echo Killing process PID: %%a
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo Port 8000 freed.
) else (
    echo Port 8000 is available.
)
echo.

echo [Step 3/4] Starting backend server...
echo.
echo Starting backend in a new window...
echo Backend will start at: http://localhost:8000
echo Health check: http://localhost:8000/api/health/
echo.
echo Keep this window open to monitor the startup process.
echo.

REM Check if PowerShell script exists, use it if available
if exist "start_backend_fixed.ps1" (
    echo Using PowerShell startup script...
    start "Backend Server" powershell -NoExit -Command "cd '%BACKEND_DIR%'; .\start_backend_fixed.ps1"
) else if exist "start_backend_fixed.bat" (
    echo Using batch startup script...
    start "Backend Server" cmd /k "cd /d %BACKEND_DIR% && start_backend_fixed.bat"
) else if exist "start_backend.bat" (
    echo Using standard startup script...
    start "Backend Server" cmd /k "cd /d %BACKEND_DIR% && start_backend.bat"
) else (
    echo No startup script found. Starting manually...
    if exist "venv\Scripts\activate.bat" (
        start "Backend Server" cmd /k "cd /d %BACKEND_DIR% && call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"
    ) else (
        start "Backend Server" cmd /k "cd /d %BACKEND_DIR% && python manage.py runserver 0.0.0.0:8000"
    )
)

echo Waiting for server to start...
timeout /t 5 /nobreak >nul

echo.
echo [Step 4/4] Verifying backend server...
echo.

REM Wait a bit more and check
timeout /t 3 /nobreak >nul

REM Try to check health endpoint
curl -s http://localhost:8000/api/health/ >nul 2>&1
if not errorlevel 1 (
    echo ========================================
    echo SUCCESS! Backend server is running!
    echo ========================================
    echo.
    echo Backend URL: http://localhost:8000
    echo Health Check: http://localhost:8000/api/health/
    echo Admin Panel: http://localhost:8000/admin/
    echo.
    echo You can now use the frontend preview feature.
    echo.
) else (
    echo ========================================
    echo WARNING: Backend may still be starting
    echo ========================================
    echo.
    echo The backend server window should be visible.
    echo Please check the backend window for any errors.
    echo.
    echo Wait a few more seconds and try accessing:
    echo http://localhost:8000/api/health/
    echo.
    echo If you see errors in the backend window:
    echo 1. Check Python is installed: python --version
    echo 2. Check Django is installed: pip list ^| findstr Django
    echo 3. Run migrations: python manage.py migrate
    echo 4. Check for port conflicts
    echo.
)

echo ========================================
echo Next Steps:
echo ========================================
echo 1. Check the backend server window for any errors
echo 2. Open http://localhost:8000/api/health/ in browser
echo 3. If health check works, try the frontend preview again
echo 4. If issues persist, check browser console for errors
echo.
pause


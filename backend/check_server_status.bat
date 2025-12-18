@echo off
echo ========================================
echo Backend Server Status Check
echo ========================================
echo.

REM Check if port 8000 is in use
echo Checking if port 8000 is in use...
netstat -ano | findstr ":8000" >nul
if not errorlevel 1 (
    echo [OK] Port 8000 is in use - Server might be running
    echo.
    echo Process using port 8000:
    netstat -ano | findstr ":8000"
    echo.
) else (
    echo [NOT RUNNING] Port 8000 is not in use - Server is not running
    echo.
)

REM Test if server responds
echo Testing server response...
curl -s http://localhost:8000/api/health/ >nul 2>&1
if not errorlevel 1 (
    echo [OK] Server is responding at http://localhost:8000/api/health/
    echo.
    echo Health check response:
    curl -s http://localhost:8000/api/health/
    echo.
) else (
    echo [ERROR] Server is not responding
    echo.
    echo Please start the server using:
    echo   START_BACKEND_SERVER.bat
    echo.
)

echo ========================================
pause


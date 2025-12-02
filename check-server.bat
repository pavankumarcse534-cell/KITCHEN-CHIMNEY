@echo off
REM Quick script to check if Django server is running
echo Checking if Django server is running on http://localhost:8000...
echo.

curl -s http://localhost:8000/api/health/ >nul 2>&1
if errorlevel 1 (
    echo Server is NOT running.
    echo.
    echo To start the server, run:
    echo   start-django-server.bat
    echo.
) else (
    echo Server IS running!
    echo.
    echo Testing health endpoint...
    curl http://localhost:8000/api/health/
    echo.
    echo.
)

pause











@echo off
REM Quick Start - Both Servers
REM This is a simplified version that starts both servers quickly

echo ========================================
echo Quick Start - Both Servers
echo ========================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%chimney-craft-3d-main"

echo Starting Backend Server...
start "Backend - Port 8000" cmd /k "cd /d %BACKEND_DIR% && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000) else (python manage.py runserver 0.0.0.0:8000)"

timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "Frontend - Port 5173" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"

echo.
echo ========================================
echo Servers Starting!
echo ========================================
echo.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
echo Check the server windows for status
echo.
pause


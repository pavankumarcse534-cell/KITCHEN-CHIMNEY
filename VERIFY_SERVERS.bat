@echo off
echo ========================================
echo Verifying Server Setup
echo ========================================
echo.

REM Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found!
    echo Please install Python from https://www.python.org/
) else (
    python --version
    echo ✅ Python found
)
echo.

REM Check Node.js
echo [2/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found!
    echo Please install Node.js from https://nodejs.org/
) else (
    node --version
    echo ✅ Node.js found
)
echo.

REM Check Backend
echo [3/4] Checking Backend...
if exist "backend\manage.py" (
    echo ✅ Backend directory found
    if exist "backend\venv\Scripts\activate.bat" (
        echo ✅ Virtual environment found
    ) else (
        echo ⚠️  Virtual environment not found (will use system Python)
    )
) else (
    echo ❌ Backend directory not found!
)
echo.

REM Check Frontend
echo [4/4] Checking Frontend...
if exist "chimney-craft-3d-main\package.json" (
    echo ✅ Frontend directory found
    if exist "chimney-craft-3d-main\node_modules" (
        echo ✅ Frontend dependencies installed
    ) else (
        echo ⚠️  Frontend dependencies not installed (run: npm install)
    )
) else (
    echo ❌ Frontend directory not found!
)
echo.

REM Check Ports
echo Checking Ports...
netstat -ano | findstr ":8000" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Port 8000 is in use (backend may already be running)
) else (
    echo ✅ Port 8000 is available
)

netstat -ano | findstr ":5173" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Port 5173 is in use (frontend may already be running)
) else (
    echo ✅ Port 5173 is available
)
echo.

echo ========================================
echo Verification Complete
echo ========================================
echo.
echo To start both servers, run: START_ALL_SERVERS.bat
echo.
pause


@echo off
echo ========================================
echo STARTING FRONTEND SERVER
echo ========================================
echo.

set "FRONTEND_DIR=%~dp0chimney-craft-3d-main"

if not exist "%FRONTEND_DIR%" (
    echo ERROR: Frontend directory not found: %FRONTEND_DIR%
    pause
    exit /b 1
)

cd /d "%FRONTEND_DIR%"

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo Node.js found! ✓
echo.

echo Checking if dependencies are installed...
if not exist "node_modules" (
    echo Installing dependencies (this may take a few minutes)...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed! ✓
) else (
    echo Dependencies already installed! ✓
)
echo.

echo ========================================
echo Starting Frontend Server
echo ========================================
echo.
echo Server will be available at: http://localhost:5173
echo.
echo If port 5173 is busy, Vite will use the next available port
echo.
echo Press CTRL+C to stop the server
echo.
echo ========================================
echo.

npm run dev

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Frontend server failed to start!
    echo ========================================
    echo.
    echo Common issues:
    echo 1. Port 5173 already in use
    echo 2. Node.js not installed
    echo 3. Dependencies not installed: npm install
    echo.
    pause
)






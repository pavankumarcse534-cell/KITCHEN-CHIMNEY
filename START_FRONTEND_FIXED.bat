@echo off
echo ========================================
echo STARTING FRONTEND SERVER
echo ========================================
echo.

cd /d "%~dp0\chimney-craft-3d-main"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting frontend server...
echo Frontend will be available at: http://localhost:5173
echo.
echo Press CTRL+C to stop the server
echo.

npm run dev

pause


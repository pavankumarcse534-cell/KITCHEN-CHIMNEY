@echo off
echo ========================================
echo Restarting Frontend with Cache Clear
echo ========================================
echo.

REM Stop all node processes
echo Stopping Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Navigate to frontend directory
cd /d "%~dp0chimney-craft-3d-main"

REM Clear Vite cache
echo Clearing Vite cache...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo Cache cleared!
) else (
    echo No cache to clear.
)

REM Start dev server
echo.
echo Starting frontend dev server...
echo.
start cmd /k "npm run dev"

echo.
echo ========================================
echo Frontend server restarting...
echo Wait 5 seconds, then refresh browser with Ctrl+Shift+R
echo ========================================
timeout /t 5

exit

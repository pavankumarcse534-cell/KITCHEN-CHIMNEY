@echo off
echo ========================================
echo Fix Git Push Error and Push to GitHub
echo ========================================
echo.

REM Check if git is available
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH!
    echo.
    echo Please install Git from: https://git-scm.com/download/win
    echo Or add Git to your system PATH.
    echo.
    pause
    exit /b 1
)

echo [Step 1/4] Pulling remote changes (allowing unrelated histories)...
git pull origin main --allow-unrelated-histories --no-edit
if %errorlevel% neq 0 (
    echo Warning: Pull had issues, continuing anyway...
)

echo.
echo [Step 2/4] Adding all files...
git add .

echo.
echo [Step 3/4] Committing changes...
git commit -m "Merge remote changes and add Kitchen Chimney 3D Model Management System frontend"

echo.
echo [Step 4/4] Pushing to GitHub...
git push -u origin main

echo.
echo ========================================
if %errorlevel% equ 0 (
    echo SUCCESS: Frontend pushed to GitHub!
    echo Repository: https://github.com/pavankumarcse534-cell/KITCHEN-CHIMNEY
) else (
    echo ERROR: Failed to push to GitHub
    echo.
    echo If you still get errors, try:
    echo   git pull origin main --allow-unrelated-histories
    echo   git add .
    echo   git commit -m "Merge and add frontend"
    echo   git push -u origin main
    echo.
    echo Or if you want to force push (overwrites remote):
    echo   git push -u origin main --force
    echo   WARNING: This will overwrite remote files!
)
echo ========================================
echo.
pause


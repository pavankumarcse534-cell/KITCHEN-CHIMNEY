@echo off
echo ========================================
echo Push Frontend to GitHub Repository
echo ========================================
echo.
echo Repository: https://github.com/pavankumarcse534-cell/KITCHEN-CHIMNEY
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

echo [1/5] Checking git status...
git status
if %errorlevel% neq 0 (
    echo.
    echo [1/5] Initializing git repository...
    git init
)

echo.
echo [2/5] Configuring remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/pavankumarcse534-cell/KITCHEN-CHIMNEY.git
git remote -v

echo.
echo [3/5] Adding all files...
git add .

echo.
echo [4/5] Committing changes...
git commit -m "Initial commit: Kitchen Chimney 3D Model Management System - Frontend with 8 model types, GLB viewer, Excel/DWG export, and Django admin integration"

echo.
echo [5/5] Pushing to GitHub...
git branch -M main
git push -u origin main

echo.
echo ========================================
if %errorlevel% equ 0 (
    echo SUCCESS: Frontend pushed to GitHub!
    echo Repository: https://github.com/pavankumarcse534-cell/KITCHEN-CHIMNEY
) else (
    echo ERROR: Failed to push to GitHub
    echo.
    echo Possible issues:
    echo 1. Authentication required - GitHub may ask for credentials
    echo 2. Repository permissions - Make sure you have write access
    echo 3. Network connection - Check your internet connection
    echo.
    echo To push manually:
    echo   git push -u origin main
)
echo ========================================
echo.
pause


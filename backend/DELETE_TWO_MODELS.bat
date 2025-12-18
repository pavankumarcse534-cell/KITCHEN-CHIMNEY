@echo off
echo ========================================
echo Delete WMSS SINGLE SKIN 1 SEC and ONE COLLAR HOLE SINGLE SKIN
echo ========================================
echo.
echo This will permanently delete:
echo   1. WMSS SINGLE SKIN 1 SEC
echo   2. ONE COLLAR HOLE SINGLE SKIN
echo.
pause

cd /d "%~dp0"

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo Virtual environment activated
) else if exist "..\venv\Scripts\activate.bat" (
    call ..\venv\Scripts\activate.bat
    echo Virtual environment activated
) else (
    echo No virtual environment found, using system Python
)

echo.
echo Deleting model types...
echo.

echo yes | python delete_two_model_types.py

echo.
echo ========================================
echo Done!
echo ========================================
pause


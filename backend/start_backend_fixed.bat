@echo off
echo ========================================
echo Starting Django Backend Server (FIXED)
echo ========================================
echo.

cd /d "%~dp0"

echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.8+ and add it to PATH
    pause
    exit /b 1
)
python --version
echo Python found! ✓
echo.

echo [2/5] Checking virtual environment...
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo Virtual environment activated! ✓
) else (
    echo WARNING: Virtual environment not found!
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
    call venv\Scripts\activate.bat
    echo Virtual environment created! ✓
)
echo.

echo [3/5] Installing dependencies...
if exist "requirements.txt" (
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    if errorlevel 1 (
        echo WARNING: Some dependencies may have failed
    ) else (
        echo Dependencies installed! ✓
    )
) else (
    echo Installing basic dependencies...
    pip install -q django djangorestframework django-cors-headers
)
echo.

echo [4/5] Running migrations...
python manage.py migrate --noinput >nul 2>&1
if errorlevel 1 (
    echo WARNING: Migration issues, but continuing...
) else (
    echo Migrations complete! ✓
)
echo.

echo [5/5] Checking port 8000...
netstat -ano | findstr ":8000" >nul 2>&1
if not errorlevel 1 (
    echo WARNING: Port 8000 is in use!
    echo Trying to free the port...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)
echo Port ready! ✓
echo.

echo ========================================
echo Starting Django Server
echo ========================================
echo Server: http://localhost:8000
echo Health: http://localhost:8000/api/health/
echo.
echo Press CTRL+C to stop
echo ========================================
echo.

python manage.py runserver 0.0.0.0:8000

if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start!
    echo Check the error messages above.
    pause
)








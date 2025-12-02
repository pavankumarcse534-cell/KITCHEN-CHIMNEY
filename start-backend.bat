@echo off
REM Startup script for Django backend server (Windows)
REM This script starts the Django development server on http://localhost:8000

echo ========================================
echo Starting Django Backend Server
echo ========================================
echo.

REM Change to backend directory
cd /d "%~dp0backend"
if errorlevel 1 (
    echo ERROR: Could not navigate to backend directory
    pause
    exit /b 1
)

REM Check if port 8000 is already in use
echo Checking if port 8000 is available...
netstat -ano | findstr ":8000" >nul
if errorlevel 0 (
    echo WARNING: Port 8000 is already in use!
    echo.
    echo Finding process using port 8000...
    set FOUND_PID=
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        set FOUND_PID=%%a
        echo Found process ID: %%a
        tasklist /FI "PID eq %%a" /FO LIST | findstr "Image Name"
    )
    if defined FOUND_PID (
        echo.
        choice /C YK /M "Kill process and start server (K) or Exit (Y)"
        REM choice returns: Y=1, K=2
        if errorlevel 2 if not errorlevel 3 (
            echo Killing process %FOUND_PID%...
            taskkill /PID %FOUND_PID% /F >nul 2>&1
            if errorlevel 0 (
                echo Process killed successfully.
                timeout /t 2 >nul
                echo Verifying port 8000 is now available...
                netstat -ano | findstr ":8000" >nul
                if errorlevel 0 (
                    echo ERROR: Port 8000 is still in use. Please stop the process manually.
                    pause
                    exit /b 1
                ) else (
                    echo Port 8000 is now available.
                )
            ) else (
                echo ERROR: Could not kill process. You may need administrator privileges.
                echo Please stop the process manually (PID: %FOUND_PID%) and try again.
                pause
                exit /b 1
            )
        ) else (
            echo Exiting. Please stop the process manually and try again.
            pause
            exit /b 1
        )
    ) else (
        echo Could not identify the process. Port may be in a transitional state.
        echo Please wait a moment and try again, or manually stop any process using port 8000.
        pause
        exit /b 1
    )
) else (
    echo Port 8000 is available.
)

echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please run 'run_setup.bat' first to set up the backend.
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

echo.

REM Check if Django is installed
echo Verifying Django installation...
python -c "import django" 2>nul
if errorlevel 1 (
    echo ERROR: Django is not installed!
    echo Please run 'run_setup.bat' first to install dependencies.
    pause
    exit /b 1
)

REM Check required packages
echo Verifying required packages...
python -c "import rest_framework" 2>nul
if errorlevel 1 (
    echo ERROR: djangorestframework is not installed!
    echo Please run 'run_setup.bat' first to install dependencies.
    pause
    exit /b 1
)

python -c "import corsheaders" 2>nul
if errorlevel 1 (
    echo ERROR: django-cors-headers is not installed!
    echo Please run 'run_setup.bat' first to install dependencies.
    pause
    exit /b 1
)

python -c "import PIL" 2>nul
if errorlevel 1 (
    echo WARNING: Pillow is not installed. Some features may not work.
    echo Consider running: pip install Pillow
)

echo.
echo Running Django system check...
python manage.py check >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: Django system check found issues!
    echo The server will still start, but you may encounter errors.
    echo.
    choice /C YN /M "Do you want to continue anyway"
    if errorlevel 2 exit /b 1
) else (
    echo System check passed successfully.
)

echo.
echo Checking for pending migrations...
python manage.py showmigrations --plan | findstr "\[ \]" >nul
if errorlevel 0 (
    echo WARNING: There are pending migrations!
    echo.
    choice /C YN /M "Apply migrations now (Y) or skip (N)"
    if errorlevel 2 (
        echo Skipping migrations...
    ) else (
        echo Applying migrations...
        python manage.py migrate
        if errorlevel 1 (
            echo ERROR: Migration failed!
            pause
            exit /b 1
        )
        echo Migrations applied successfully.
    )
    echo.
)

echo.
echo ========================================
echo Starting Django server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo ========================================
echo.
echo Server will be available at:
echo   - API: http://localhost:8000/api/
echo   - Health Check: http://localhost:8000/api/health/
echo   - Admin: http://localhost:8000/admin/
echo   - Admin Login: http://localhost:8000/admin/login/
echo.

REM Start Django development server
echo.
echo ========================================
echo Starting Django server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo ========================================
echo.
echo Server will be available at:
echo   - API: http://localhost:8000/api/
echo   - Health Check: http://localhost:8000/api/health/
echo   - Admin: http://localhost:8000/admin/
echo   - Admin Login: http://localhost:8000/admin/login/
echo.
echo If you see "Starting development server at http://127.0.0.1:8000/"
echo then the server has started successfully!
echo.

REM Start Django development server
python manage.py runserver

REM If we get here, the server has stopped
echo.
echo ========================================
echo Server stopped.
echo ========================================
pause


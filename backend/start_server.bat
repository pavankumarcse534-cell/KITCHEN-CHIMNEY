@echo off
REM Start Django development server
echo Starting Django server...
echo.

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found. Using system Python.
    echo.
)

REM Check Django installation
python -c "import django; print('Django version:', django.get_version())" 2>nul
if errorlevel 1 (
    echo ERROR: Django is not installed!
    echo Please install dependencies: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo Running Django system check...
python manage.py check
if errorlevel 1 (
    echo.
    echo ERROR: Django system check failed!
    pause
    exit /b 1
)

echo.
echo Starting development server on http://127.0.0.1:8000/admin
echo Press Ctrl+C to stop the server
echo.
python manage.py runserver


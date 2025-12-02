@echo off
echo ========================================
echo STARTING BACKEND SERVER
echo ========================================
echo.
echo This will start the Django backend server
echo Server will be available at: http://localhost:8000
echo.
echo Press CTRL+C to stop the server
echo.
pause

cd /d "%~dp0\backend"

echo Starting server...
python manage.py runserver

pause










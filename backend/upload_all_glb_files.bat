@echo off
echo ========================================
echo Uploading GLB files to database
echo ========================================
echo.

cd /d "%~dp0"
python upload_glb_to_database.py

pause


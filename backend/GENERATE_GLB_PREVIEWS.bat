@echo off
echo ========================================
echo GLB to Preview Image Converter
echo ========================================
echo.

cd /d "%~dp0"
call venv\Scripts\activate.bat
python generate_glb_previews.py

pause


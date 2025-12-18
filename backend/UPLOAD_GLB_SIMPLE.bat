@echo off
echo ========================================
echo Simple GLB File Upload
echo ========================================
echo.
echo Usage: UPLOAD_GLB_SIMPLE.bat ^<model_type^> ^<glb_file_path^> [image_file_path]
echo.
echo Example:
echo   UPLOAD_GLB_SIMPLE.bat wmss_single_skin_1_sec "C:\path\to\WMSS_SINGLE_SKIN_1_SEC.glb"
echo   UPLOAD_GLB_SIMPLE.bat one_collar_single_skin "C:\path\to\ONE_COLLAR_SINGLE_SKIN.glb" "C:\path\to\preview.png"
echo.

if "%1"=="" (
    echo ❌ Error: Model type is required
    echo.
    echo Available model types:
    echo   - wmss_single_skin_1_sec: WMSS SINGLE SKIN 1 SEC
    echo   - one_collar_single_skin: ONE COLLAR SINGLE SKIN
    pause
    exit /b 1
)

if "%2"=="" (
    echo ❌ Error: GLB file path is required
    pause
    exit /b 1
)

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
echo Uploading GLB file...
echo   Model Type: %1
echo   GLB File: %2
if not "%3"=="" (
    echo   Image File: %3
)
echo.

python upload_glb_simple.py %1 "%2" %3

echo.
echo ========================================
echo Done!
echo ========================================
pause


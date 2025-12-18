@echo off
echo Clearing Python cache files...
cd /d "%~dp0"
for /r %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
del /s /q *.pyc 2>nul
del /s /q *.pyo 2>nul
echo Cache cleared!
pause


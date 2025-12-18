# PowerShell script to start Backend server only
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "STARTING BACKEND SERVER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"

# Function to check and kill process on a port
function Stop-ProcessOnPort {
    param([int]$Port)
    $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $processes) {
        if ($pid) {
            Write-Host "Stopping process $pid on port $Port..." -ForegroundColor Yellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

Set-Location $BackendDir

# Check and free port 8000
Stop-ProcessOnPort -Port 8000
Start-Sleep -Seconds 2

# Check if virtual environment exists
$venvPath = Join-Path $BackendDir "venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & $venvPath
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "BACKEND SERVER STARTING" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
    Write-Host "Health: http://localhost:8000/api/health/" -ForegroundColor Green
    Write-Host ""
    python manage.py runserver 0.0.0.0:8000
} else {
    Write-Host "WARNING: Virtual environment not found, using system Python" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "BACKEND SERVER STARTING" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
    Write-Host "Health: http://localhost:8000/api/health/" -ForegroundColor Green
    Write-Host ""
    python manage.py runserver 0.0.0.0:8000
}


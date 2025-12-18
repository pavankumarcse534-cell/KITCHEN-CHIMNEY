# PowerShell script to start both Backend and Frontend servers
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "STARTING BACKEND AND FRONTEND SERVERS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "chimney-craft-3d-main"

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

# Start Backend Server
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
Set-Location $BackendDir

# Check and free port 8000
Stop-ProcessOnPort -Port 8000
Start-Sleep -Seconds 2

# Check if virtual environment exists
$venvPath = Join-Path $BackendDir "venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$BackendDir'; & '$venvPath'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'BACKEND SERVER STARTING' -ForegroundColor Cyan; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'Backend: http://localhost:8000' -ForegroundColor Green; Write-Host 'Health: http://localhost:8000/api/health/' -ForegroundColor Green; Write-Host ''; python manage.py runserver 0.0.0.0:8000"
    )
} else {
    Write-Host "WARNING: Virtual environment not found, using system Python" -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$BackendDir'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'BACKEND SERVER STARTING' -ForegroundColor Cyan; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'Backend: http://localhost:8000' -ForegroundColor Green; Write-Host 'Health: http://localhost:8000/api/health/' -ForegroundColor Green; Write-Host ''; python manage.py runserver 0.0.0.0:8000"
    )
}

Write-Host "Backend server starting in new window..." -ForegroundColor Green
Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
Set-Location $FrontendDir

# Check and free port 5173
Stop-ProcessOnPort -Port 5173

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$FrontendDir'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'FRONTEND SERVER STARTING' -ForegroundColor Cyan; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Green; Write-Host ''; npm run dev"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SERVERS STARTING..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor Yellow
Write-Host "You can close this window - servers will continue running." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"

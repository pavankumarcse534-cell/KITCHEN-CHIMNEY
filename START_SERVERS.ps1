# PowerShell script to start Backend and Frontend servers
# Usage: .\START_SERVERS.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Backend and Frontend Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $SCRIPT_DIR "backend"
$FRONTEND_DIR = Join-Path $SCRIPT_DIR "chimney-craft-3d-main"

# Check if directories exist
if (-not (Test-Path $BACKEND_DIR)) {
    Write-Host "ERROR: Backend directory not found: $BACKEND_DIR" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $FRONTEND_DIR)) {
    Write-Host "ERROR: Frontend directory not found: $FRONTEND_DIR" -ForegroundColor Red
    exit 1
}

# Start Backend Server
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Yellow

# Check if port 8000 is in use
$portCheck = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "WARNING: Port 8000 is already in use!" -ForegroundColor Yellow
    Write-Host "Trying to free the port..." -ForegroundColor Yellow
    $processes = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $processes) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Killed process: $pid" -ForegroundColor Green
        } catch {
            Write-Host "Could not kill process: $pid" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 2
}

# Change to backend directory
Set-Location $BACKEND_DIR

# Check for virtual environment
$venvPath = Join-Path $BACKEND_DIR "venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "Activating virtual environment..." -ForegroundColor Green
    $backendCommand = "cd '$BACKEND_DIR'; & '$venvPath'; Write-Host 'Backend starting at http://localhost:8000' -ForegroundColor Green; Write-Host 'Health: http://localhost:8000/api/health/' -ForegroundColor Green; python manage.py runserver 0.0.0.0:8000"
} else {
    Write-Host "WARNING: Virtual environment not found, using system Python" -ForegroundColor Yellow
    $backendCommand = "cd '$BACKEND_DIR'; Write-Host 'Backend starting at http://localhost:8000' -ForegroundColor Green; Write-Host 'Health: http://localhost:8000/api/health/' -ForegroundColor Green; python manage.py runserver 0.0.0.0:8000"
}

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand

Write-Host "Backend server starting..." -ForegroundColor Green
Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Yellow

# Change to frontend directory
Set-Location $FRONTEND_DIR

# Check if node_modules exists
$nodeModulesPath = Join-Path $FRONTEND_DIR "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start frontend in new window
$frontendCommand = "cd '$FRONTEND_DIR'; Write-Host 'Frontend starting...' -ForegroundColor Green; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Servers Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173 (or check terminal)" -ForegroundColor Green
Write-Host ""
Write-Host "Servers are running in separate windows." -ForegroundColor Yellow
Write-Host "Close those windows to stop the servers." -ForegroundColor Yellow
Write-Host ""


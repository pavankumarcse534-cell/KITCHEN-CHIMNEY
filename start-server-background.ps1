# PowerShell script to start Django server in background
# This creates a hidden window that keeps the server running

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Starting Django Server in Background"
Write-Host "========================================"
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"

if (-not (Test-Path $backendDir)) {
    Write-Host "ERROR: Backend directory not found at: $backendDir"
    Write-Host "Please ensure this script is in the project root directory."
    exit 1
}

# Kill any existing processes on port 8000
Write-Host "Checking for existing server processes..."
$connections = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $processes) {
        Write-Host "Killing existing process $pid on port 8000..."
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

# Check if virtual environment exists
$venvPath = Join-Path $backendDir "venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "Virtual environment found. Activating..."
    & $venvPath
} else {
    Write-Host "Warning: Virtual environment not found. Using system Python."
}

# Change to backend directory
Set-Location $backendDir

# Check if Django is installed
try {
    $djangoVersion = python -c "import django; print(django.get_version())" 2>&1
    Write-Host "Django version: $djangoVersion"
} catch {
    Write-Host "ERROR: Django is not installed!"
    Write-Host "Attempting to install dependencies..."
    pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies!"
        exit 1
    }
}

# Run system check
Write-Host ""
Write-Host "Running Django system check..."
python manage.py check
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Django system check found issues!"
}

# Check for pending migrations
Write-Host ""
Write-Host "Checking for pending migrations..."
$migrations = python manage.py showmigrations --list 2>&1
if ($migrations -match "\[ \]") {
    Write-Host "Applying pending migrations..."
    python manage.py migrate
}

Write-Host ""
Write-Host "========================================"
Write-Host "Starting Django server on http://localhost:8000"
Write-Host "Server is running in background"
Write-Host "========================================"
Write-Host ""
Write-Host "Server endpoints:"
Write-Host "  - API: http://localhost:8000/api/"
Write-Host "  - Health Check: http://localhost:8000/api/health/"
Write-Host "  - Admin: http://localhost:8000/admin/"
Write-Host "  - GLB Upload: http://localhost:8000/api/upload-glb/"
Write-Host ""
Write-Host "To stop the server, run: stop-server.ps1"
Write-Host ""

# Start server in background using Start-Process with hidden window
$serverScript = @"
cd `"$backendDir`"
if (Test-Path `"venv\Scripts\Activate.ps1`") {
    .\venv\Scripts\Activate.ps1
}
python manage.py runserver 0.0.0.0:8000
"@

# Create a temporary script file
$tempScript = Join-Path $env:TEMP "django-server-$(Get-Random).ps1"
$serverScript | Out-File -FilePath $tempScript -Encoding UTF8

# Start the server in a hidden window
$process = Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $tempScript -WindowStyle Hidden -PassThru

# Save process ID to a file for later stopping
$pidFile = Join-Path $scriptDir "server.pid"
$process.Id | Out-File -FilePath $pidFile

Write-Host "Server started with PID: $($process.Id)"
Write-Host "PID saved to: $pidFile"
Write-Host ""
Write-Host "Waiting 5 seconds to verify server started..."
Start-Sleep -Seconds 5

# Test if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -UseBasicParsing -TimeoutSec 3
    Write-Host "SUCCESS: Server is running and responding!"
    Write-Host "Health check response: $($response.Content)"
} catch {
    Write-Host "WARNING: Server may not have started correctly."
    Write-Host "Check the server window or logs for errors."
}

Write-Host ""
Write-Host "Server is running in the background."
Write-Host "You can close this window."











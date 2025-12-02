# Startup script for Django backend server (Windows PowerShell)
# This script starts the Django development server on http://localhost:8000

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"

if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: Could not find backend directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $backendPath
Write-Host "Changed to backend directory: $backendPath" -ForegroundColor Green

# Check if port 8000 is already in use
Write-Host "Checking if port 8000 is available..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "WARNING: Port 8000 is already in use!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Finding process using port 8000..." -ForegroundColor Yellow
    
    # Handle array case - select first connection if multiple exist
    if ($portInUse -is [Array]) {
        $portInUse = $portInUse[0]
    }
    $processId = $portInUse.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Found process ID: $processId" -ForegroundColor Yellow
        Write-Host "Process Name: $($process.ProcessName)" -ForegroundColor Yellow
        Write-Host ""
        
        $response = Read-Host "Kill process and start server (K) or Exit (Y)"
        if ($response -eq "K" -or $response -eq "k") {
            Write-Host "Killing process $processId..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "Process killed successfully." -ForegroundColor Green
                Start-Sleep -Seconds 2
                
                # Verify port is now available
                $portStillInUse = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
                if ($portStillInUse) {
                    # Handle array case if multiple connections exist
                    if ($portStillInUse -is [Array]) {
                        $portStillInUse = $portStillInUse[0]
                    }
                    Write-Host "ERROR: Port 8000 is still in use. Please stop the process manually." -ForegroundColor Red
                    Read-Host "Press Enter to exit"
                    exit 1
                } else {
                    Write-Host "Port 8000 is now available." -ForegroundColor Green
                }
            } catch {
                Write-Host "ERROR: Could not kill process. You may need administrator privileges." -ForegroundColor Red
                Write-Host "Please stop the process manually (PID: $processId) and try again." -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
        } else {
            Write-Host "Exiting. Please stop the process manually and try again." -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit 1
        }
    } else {
        Write-Host "Could not identify the process. Port may be in a transitional state." -ForegroundColor Yellow
        Write-Host "Please wait a moment and try again, or manually stop any process using port 8000." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "Port 8000 is available." -ForegroundColor Green
}

Write-Host ""

# Check if virtual environment exists
$venvActivate = Join-Path $backendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Host "ERROR: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run 'run_setup.bat' first to set up the backend." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
try {
    & $venvActivate
    if ($LASTEXITCODE -ne 0) {
        throw "Activation failed"
    }
} catch {
    Write-Host "ERROR: Failed to activate virtual environment" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if Django is installed
Write-Host "Verifying Django installation..." -ForegroundColor Yellow
python -c "import django" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Django is not installed!" -ForegroundColor Red
    Write-Host "Please run 'run_setup.bat' first to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check required packages
Write-Host "Verifying required packages..." -ForegroundColor Yellow
python -c "import rest_framework" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: djangorestframework is not installed!" -ForegroundColor Red
    Write-Host "Please run 'run_setup.bat' first to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

python -c "import corsheaders" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: django-cors-headers is not installed!" -ForegroundColor Red
    Write-Host "Please run 'run_setup.bat' first to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

python -c "import PIL" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Pillow is not installed. Some features may not work." -ForegroundColor Yellow
    Write-Host "Consider running: pip install Pillow" -ForegroundColor Yellow
}

Write-Host ""

# Run Django system check
Write-Host "Running Django system check..." -ForegroundColor Yellow
python manage.py check 2>&1 | Out-Null
$checkExitCode = $LASTEXITCODE

if ($checkExitCode -ne 0) {
    Write-Host ""
    Write-Host "WARNING: Django system check found issues!" -ForegroundColor Yellow
    Write-Host "The server will still start, but you may encounter errors." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to continue anyway (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        exit 1
    }
} else {
    Write-Host "System check passed successfully." -ForegroundColor Green
}

Write-Host ""

# Check for pending migrations
Write-Host "Checking for pending migrations..." -ForegroundColor Yellow
$migrationOutput = python manage.py showmigrations --plan 2>&1 | Out-String
$pendingMigrations = $migrationOutput | Select-String -Pattern "\[ \]"

if ($pendingMigrations) {
    Write-Host "WARNING: There are pending migrations!" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Apply migrations now (Y) or skip (N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "Applying migrations..." -ForegroundColor Yellow
        python manage.py migrate
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Migration failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host "Migrations applied successfully." -ForegroundColor Green
    } else {
        Write-Host "Skipping migrations..." -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django server on http://localhost:8000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  - API: http://localhost:8000/api/" -ForegroundColor Green
Write-Host "  - Health Check: http://localhost:8000/api/health/" -ForegroundColor Green
Write-Host "  - Admin: http://localhost:8000/admin/" -ForegroundColor Green
Write-Host "  - Admin Login: http://localhost:8000/admin/login/" -ForegroundColor Green
Write-Host ""
Write-Host "If you see 'Starting development server at http://127.0.0.1:8000/'" -ForegroundColor Yellow
Write-Host "then the server has started successfully!" -ForegroundColor Yellow
Write-Host ""

# Start Django development server
python manage.py runserver

# If we get here, the server has stopped
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server stopped." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"


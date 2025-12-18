# PowerShell script to robustly start backend server with all checks
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

$errors = @()

# Step 1: Check Python installation
Write-Host "[1/6] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Python found: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "  ✗ ERROR: Python not found!" -ForegroundColor Red
    Write-Host "    Please install Python 3.8+ and add it to PATH" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Check/Create virtual environment
Write-Host "[2/6] Checking virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv\Scripts\activate.bat") {
    Write-Host "  ✓ Virtual environment exists" -ForegroundColor Green
    Write-Host "  Activating virtual environment..." -ForegroundColor Cyan
    & "venv\Scripts\activate.bat"
} else {
    Write-Host "  ⚠ Virtual environment not found" -ForegroundColor Yellow
    Write-Host "  Creating virtual environment..." -ForegroundColor Cyan
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ ERROR: Failed to create virtual environment" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "  ✓ Virtual environment created" -ForegroundColor Green
    & "venv\Scripts\activate.bat"
}

# Step 3: Check Django installation
Write-Host "[3/6] Checking Django installation..." -ForegroundColor Yellow
try {
    $djangoVersion = python -c "import django; print(django.get_version())" 2>&1
    if ($LASTEXITCODE -ne 0 -or $djangoVersion -match "Error") {
        throw "Django not installed"
    }
    Write-Host "  ✓ Django found: $djangoVersion" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Django not installed" -ForegroundColor Yellow
    Write-Host "  Installing dependencies..." -ForegroundColor Cyan
    if (Test-Path "requirements.txt") {
        pip install -q --upgrade pip
        pip install -q -r requirements.txt
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ✗ WARNING: Some dependencies may have failed to install" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
        }
    } else {
        Write-Host "  Installing basic dependencies..." -ForegroundColor Cyan
        pip install -q django djangorestframework django-cors-headers
        Write-Host "  ✓ Basic dependencies installed" -ForegroundColor Green
    }
}

# Step 4: Run database migrations
Write-Host "[4/6] Running database migrations..." -ForegroundColor Yellow
python manage.py migrate --noinput 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Migrations complete" -ForegroundColor Green
} else {
    Write-Host "  ⚠ WARNING: Migration issues detected, but continuing..." -ForegroundColor Yellow
}

# Step 5: Check and free port 8000
Write-Host "[5/6] Checking port 8000..." -ForegroundColor Yellow
$portCheck = netstat -ano | Select-String ":8000" | Select-String "LISTENING"
if ($portCheck) {
    Write-Host "  ⚠ Port 8000 is in use" -ForegroundColor Yellow
    $pidMatch = $portCheck -match '\s+(\d+)$'
    if ($pidMatch) {
        $pid = $matches[1]
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  Found process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
            Write-Host "  Attempting to free port 8000..." -ForegroundColor Cyan
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Start-Sleep -Seconds 2
                Write-Host "  ✓ Port 8000 freed" -ForegroundColor Green
            } catch {
                Write-Host "  ✗ ERROR: Could not free port 8000" -ForegroundColor Red
                Write-Host "    Please manually stop the process using port 8000" -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
        } else {
            Write-Host "  ⚠ Process not found, but port is in use" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ✓ Port 8000 is available" -ForegroundColor Green
}

# Step 6: Start server
Write-Host "[6/6] Starting Django server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server Starting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend URL: http://localhost:8000" -ForegroundColor Green
Write-Host "Health Check: http://localhost:8000/api/health/" -ForegroundColor Green
Write-Host "Admin Panel: http://localhost:8000/admin/" -ForegroundColor Green
Write-Host ""
Write-Host "Press CTRL+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the server
python manage.py runserver 0.0.0.0:8000

# If we get here, server stopped
Write-Host ""
Write-Host "Server stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"


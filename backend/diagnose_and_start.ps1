# Diagnostic and Startup Script for Django Backend
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Django Backend Server Diagnostic" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Python
Write-Host "[1/6] Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python not found!" -ForegroundColor Red
    exit 1
}

# Step 2: Check Django
Write-Host "[2/6] Checking Django..." -ForegroundColor Yellow
try {
    $djangoCheck = python -c "import django; print(django.get_version())" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Django $djangoCheck installed" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Django not installed!" -ForegroundColor Red
        Write-Host "  Run: pip install -r requirements.txt" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "  ✗ Django not installed!" -ForegroundColor Red
    exit 1
}

# Step 3: Check if we're in the right directory
Write-Host "[3/6] Checking directory..." -ForegroundColor Yellow
if (Test-Path "manage.py") {
    Write-Host "  ✓ manage.py found" -ForegroundColor Green
} else {
    Write-Host "  ✗ manage.py not found! Are you in the backend directory?" -ForegroundColor Red
    exit 1
}

# Step 4: Run Django check
Write-Host "[4/6] Running Django system check..." -ForegroundColor Yellow
python manage.py check 2>&1 | Out-String | ForEach-Object {
    if ($_ -match "System check identified no issues") {
        Write-Host "  ✓ System check passed" -ForegroundColor Green
    } elseif ($_ -match "error|Error|ERROR") {
        Write-Host "  ✗ System check found errors:" -ForegroundColor Red
        Write-Host $_
    } else {
        Write-Host $_
    }
}

# Step 5: Check for pending migrations
Write-Host "[5/6] Checking migrations..." -ForegroundColor Yellow
$migrations = python manage.py showmigrations --list 2>&1 | Select-String "\[ \]"
if ($migrations) {
    Write-Host "  ⚠ Pending migrations found (this is usually OK)" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ No pending migrations" -ForegroundColor Green
}

# Step 6: Check port 8000
Write-Host "[6/6] Checking port 8000..." -ForegroundColor Yellow
$portCheck = netstat -ano | Select-String ":8000"
if ($portCheck) {
    Write-Host "  ⚠ Port 8000 is in use:" -ForegroundColor Yellow
    Write-Host $portCheck
    Write-Host ""
    Write-Host "To free the port, find the PID and run:" -ForegroundColor Yellow
    Write-Host "  Get-Process -Id <PID> | Stop-Process -Force" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
} else {
    Write-Host "  ✓ Port 8000 is available" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  - API: http://localhost:8000/api/" -ForegroundColor White
Write-Host "  - Health: http://localhost:8000/api/health/" -ForegroundColor White
Write-Host "  - Admin: http://localhost:8000/admin/" -ForegroundColor White
Write-Host ""
Write-Host "Press CTRL+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server (this will block)
python manage.py runserver 0.0.0.0:8000


# PowerShell script to diagnose backend server issues
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Server Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$issues = @()
$warnings = @()

# Check 1: Python installation
Write-Host "[1/8] Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    $issues += "Python not found. Please install Python 3.8+"
    Write-Host "  ✗ Python not found!" -ForegroundColor Red
}

# Check 2: Virtual environment
Write-Host "[2/8] Checking virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv\Scripts\activate.bat") {
    Write-Host "  ✓ Virtual environment exists" -ForegroundColor Green
} else {
    $warnings += "Virtual environment not found. Run: python -m venv venv"
    Write-Host "  ⚠ Virtual environment not found" -ForegroundColor Yellow
}

# Check 3: Django installation
Write-Host "[3/8] Checking Django..." -ForegroundColor Yellow
if (Test-Path "venv\Scripts\activate.bat") {
    & "venv\Scripts\activate.bat"
}
try {
    $djangoVersion = python -c "import django; print(django.get_version())" 2>&1
    Write-Host "  ✓ Django found: $djangoVersion" -ForegroundColor Green
} catch {
    $issues += "Django not installed. Run: pip install -r requirements.txt"
    Write-Host "  ✗ Django not installed!" -ForegroundColor Red
}

# Check 4: Database
Write-Host "[4/8] Checking database..." -ForegroundColor Yellow
if (Test-Path "db.sqlite3") {
    Write-Host "  ✓ Database file exists" -ForegroundColor Green
} else {
    $warnings += "Database file not found. Run: python manage.py migrate"
    Write-Host "  ⚠ Database file not found" -ForegroundColor Yellow
}

# Check 5: Port 8000
Write-Host "[5/8] Checking port 8000..." -ForegroundColor Yellow
$portCheck = netstat -ano | Select-String ":8000"
if ($portCheck) {
    $warnings += "Port 8000 is in use. Kill the process or use port 8001"
    Write-Host "  ⚠ Port 8000 is in use" -ForegroundColor Yellow
    Write-Host "  Process details:" -ForegroundColor Yellow
    $portCheck | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
} else {
    Write-Host "  ✓ Port 8000 is available" -ForegroundColor Green
}

# Check 6: Settings file
Write-Host "[6/8] Checking settings..." -ForegroundColor Yellow
if (Test-Path "chimney_craft_backend\settings.py") {
    Write-Host "  ✓ Settings file exists" -ForegroundColor Green
} else {
    $issues += "Settings file not found"
    Write-Host "  ✗ Settings file not found!" -ForegroundColor Red
}

# Check 7: Media directory
Write-Host "[7/8] Checking media directory..." -ForegroundColor Yellow
if (Test-Path "media") {
    Write-Host "  ✓ Media directory exists" -ForegroundColor Green
} else {
    $warnings += "Media directory not found. Will be created automatically"
    Write-Host "  ⚠ Media directory not found" -ForegroundColor Yellow
}

# Check 8: Requirements
Write-Host "[8/8] Checking requirements.txt..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    Write-Host "  ✓ requirements.txt exists" -ForegroundColor Green
} else {
    $warnings += "requirements.txt not found"
    Write-Host "  ⚠ requirements.txt not found" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✓ All checks passed! Backend should start successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the server:" -ForegroundColor Cyan
    Write-Host "  python manage.py runserver 0.0.0.0:8000" -ForegroundColor White
} else {
    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-Host "CRITICAL ISSUES (must fix):" -ForegroundColor Red
        $issues | ForEach-Object { Write-Host "  ✗ $_" -ForegroundColor Red }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "WARNINGS (should fix):" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "  ⚠ $_" -ForegroundColor Yellow }
    }
    
    Write-Host ""
    Write-Host "Fix the issues above, then try starting the server again." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan








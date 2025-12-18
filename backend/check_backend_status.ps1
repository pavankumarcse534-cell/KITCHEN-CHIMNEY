# PowerShell script to comprehensively check backend server status
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Server Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$issues = @()
$warnings = @()
$success = @()

# Check 1: Python installation
Write-Host "[1/7] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Python found: $pythonVersion" -ForegroundColor Green
        $success += "Python is installed"
    } else {
        throw "Python not found"
    }
} catch {
    $issues += "Python not found. Please install Python 3.8+ and add it to PATH"
    Write-Host "  ✗ Python not found!" -ForegroundColor Red
}

# Check 2: Virtual environment
Write-Host "[2/7] Checking virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv\Scripts\activate.bat") {
    Write-Host "  ✓ Virtual environment exists" -ForegroundColor Green
    $success += "Virtual environment exists"
} else {
    $warnings += "Virtual environment not found. Run: python -m venv venv"
    Write-Host "  ⚠ Virtual environment not found" -ForegroundColor Yellow
}

# Check 3: Django installation
Write-Host "[3/7] Checking Django..." -ForegroundColor Yellow
if (Test-Path "venv\Scripts\activate.bat") {
    & "venv\Scripts\activate.bat" | Out-Null
}
try {
    $djangoVersion = python -c "import django; print(django.get_version())" 2>&1
    if ($LASTEXITCODE -eq 0 -and $djangoVersion -notmatch "Error") {
        Write-Host "  ✓ Django found: $djangoVersion" -ForegroundColor Green
        $success += "Django is installed"
    } else {
        throw "Django not installed"
    }
} catch {
    $issues += "Django not installed. Run: pip install -r requirements.txt"
    Write-Host "  ✗ Django not installed!" -ForegroundColor Red
}

# Check 4: Port 8000 status
Write-Host "[4/7] Checking port 8000..." -ForegroundColor Yellow
$portCheck = netstat -ano | Select-String ":8000" | Select-String "LISTENING"
if ($portCheck) {
    $pidMatch = $portCheck -match '\s+(\d+)$'
    if ($pidMatch) {
        $pid = $matches[1]
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  ⚠ Port 8000 is in use by PID $pid ($($process.ProcessName))" -ForegroundColor Yellow
            $warnings += "Port 8000 is in use by process: $($process.ProcessName) (PID: $pid)"
        } else {
            Write-Host "  ⚠ Port 8000 is in use by PID $pid" -ForegroundColor Yellow
            $warnings += "Port 8000 is in use by PID: $pid"
        }
    } else {
        Write-Host "  ⚠ Port 8000 is in use" -ForegroundColor Yellow
        $warnings += "Port 8000 is in use"
    }
} else {
    Write-Host "  ✓ Port 8000 is available" -ForegroundColor Green
    $success += "Port 8000 is available"
}

# Check 5: Backend server connectivity
Write-Host "[5/7] Checking backend server connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Backend server is RUNNING" -ForegroundColor Green
        Write-Host "    Status Code: $($response.StatusCode)" -ForegroundColor Green
        try {
            $jsonResponse = $response.Content | ConvertFrom-Json
            Write-Host "    Response: $($jsonResponse | ConvertTo-Json -Compress)" -ForegroundColor Green
        } catch {
            Write-Host "    Response: $($response.Content)" -ForegroundColor Green
        }
        $success += "Backend server is running and responding"
    } else {
        Write-Host "  ⚠ Backend server returned status $($response.StatusCode)" -ForegroundColor Yellow
        $warnings += "Backend server returned status $($response.StatusCode)"
    }
} catch {
    if ($_.Exception.Message -match "Unable to connect" -or $_.Exception.Message -match "Connection refused") {
        Write-Host "  ✗ Backend server is NOT running" -ForegroundColor Red
        $issues += "Backend server is not running. Start it with: .\start_backend_fixed.ps1"
    } elseif ($_.Exception.Message -match "timeout") {
        Write-Host "  ⚠ Backend server connection timeout" -ForegroundColor Yellow
        $warnings += "Backend server connection timeout - may be slow to respond"
    } else {
        Write-Host "  ✗ Cannot connect to backend server: $($_.Exception.Message)" -ForegroundColor Red
        $issues += "Cannot connect to backend server: $($_.Exception.Message)"
    }
}

# Check 6: Database file
Write-Host "[6/7] Checking database..." -ForegroundColor Yellow
if (Test-Path "db.sqlite3") {
    Write-Host "  ✓ Database file exists" -ForegroundColor Green
    $success += "Database file exists"
} else {
    $warnings += "Database file not found. Run: python manage.py migrate"
    Write-Host "  ⚠ Database file not found" -ForegroundColor Yellow
}

# Check 7: Media directory
Write-Host "[7/7] Checking media directory..." -ForegroundColor Yellow
if (Test-Path "media") {
    Write-Host "  ✓ Media directory exists" -ForegroundColor Green
    $success += "Media directory exists"
} else {
    Write-Host "  ⚠ Media directory not found (will be created automatically)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Status Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "✓ Success Checks:" -ForegroundColor Green
    $success | ForEach-Object { Write-Host "  ✓ $_" -ForegroundColor Green }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠ Warnings:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  ⚠ $_" -ForegroundColor Yellow }
    Write-Host ""
}

if ($issues.Count -gt 0) {
    Write-Host "✗ Critical Issues:" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "  ✗ $_" -ForegroundColor Red }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan

# Provide recommendations
if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✓ All checks passed! Backend is ready." -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the backend server:" -ForegroundColor Cyan
    Write-Host "  .\start_backend_fixed.ps1" -ForegroundColor White
    Write-Host ""
    exit 0
} elseif ($issues.Count -gt 0) {
    Write-Host "✗ Critical issues detected. Please fix them first." -ForegroundColor Red
    Write-Host ""
    Write-Host "Quick fix:" -ForegroundColor Cyan
    Write-Host "  .\start_backend_fixed.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
} else {
    Write-Host "⚠ Some warnings detected, but backend should work." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start the backend server:" -ForegroundColor Cyan
    Write-Host "  .\start_backend_fixed.ps1" -ForegroundColor White
    Write-Host ""
    exit 0
}


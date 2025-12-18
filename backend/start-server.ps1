# PowerShell script to start Django backend server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ and try again." -ForegroundColor Red
    exit 1
}

# Check if Django is installed
try {
    $djangoVersion = python -c "import django; print('Django version:', django.get_version())" 2>&1
    Write-Host $djangoVersion -ForegroundColor Green
} catch {
    Write-Host "ERROR: Django is not installed!" -ForegroundColor Red
    Write-Host "Please install dependencies: pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}

# Check for port 8000
Write-Host ""
Write-Host "Checking if port 8000 is available..." -ForegroundColor Yellow
$portInUse = netstat -ano | Select-String ":8000"
if ($portInUse) {
    Write-Host "WARNING: Port 8000 is already in use!" -ForegroundColor Yellow
    Write-Host "Process using port 8000:" -ForegroundColor Yellow
    Write-Host $portInUse
    Write-Host ""
    Write-Host "To kill the process, find the PID and run:" -ForegroundColor Yellow
    Write-Host "  taskkill /PID <PID> /F" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Do you want to continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
} else {
    Write-Host "Port 8000 is available" -ForegroundColor Green
}

# Run Django system check
Write-Host ""
Write-Host "Running Django system check..." -ForegroundColor Yellow
python manage.py check
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Django system check found issues!" -ForegroundColor Yellow
    Write-Host "Continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django server on http://0.0.0.0:8000" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  - API: http://localhost:8000/api/" -ForegroundColor White
Write-Host "  - Health Check: http://localhost:8000/api/health/" -ForegroundColor White
Write-Host "  - Admin: http://localhost:8000/admin/" -ForegroundColor White
Write-Host ""
Write-Host "Press CTRL+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start Django development server
python manage.py runserver 0.0.0.0:8000


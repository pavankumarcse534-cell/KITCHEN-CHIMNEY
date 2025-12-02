# Script to install CadQuery and start backend server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fixing Backend Issues and Starting Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
# Get script directory - works both when executed as file and interactively
if ($PSScriptRoot) {
    $scriptPath = $PSScriptRoot
} else {
    $scriptPath = (Get-Location).Path
}
$backendPath = Join-Path $scriptPath "backend"

# Validate that backendPath was set correctly
if (-not $backendPath) {
    Write-Host "ERROR: Could not determine backend directory path" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: Could not find backend directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $backendPath
Write-Host "Changed to backend directory: $backendPath" -ForegroundColor Green
Write-Host ""

# Check if virtual environment exists
$venvActivate = Join-Path $backendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Host "ERROR: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run setup script first to create virtual environment." -ForegroundColor Red
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
    Write-Host "[OK] Virtual environment activated" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to activate virtual environment" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if CadQuery is installed
Write-Host "Checking CadQuery installation..." -ForegroundColor Yellow
python -c "import cadquery" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] CadQuery is not installed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Installing CadQuery..." -ForegroundColor Yellow
    Write-Host "This may take several minutes. Please wait..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        python -m pip install --upgrade pip
        python -m pip install cadquery
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] CadQuery installed successfully" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to install CadQuery" -ForegroundColor Red
            Write-Host "You may need to install it manually: pip install cadquery" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: Could not install CadQuery: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Please install manually: pip install cadquery" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] CadQuery is already installed" -ForegroundColor Green
}

Write-Host ""

# Verify other required packages
Write-Host "Verifying required packages..." -ForegroundColor Yellow
$packages = @("django", "rest_framework", "corsheaders", "PIL")
$missingPackages = @()

foreach ($package in $packages) {
    python -c "import $package" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $missingPackages += $package
        Write-Host "  [WARNING] $package is not installed" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] $package is installed" -ForegroundColor Green
    }
}

if ($missingPackages.Count -gt 0) {
    Write-Host ""
    Write-Host "Installing missing packages..." -ForegroundColor Yellow
    foreach ($package in $missingPackages) {
        Write-Host "  Installing $package..." -ForegroundColor Yellow
        python -m pip install $package 2>&1 | Out-Null
    }
    Write-Host "[OK] Missing packages installed" -ForegroundColor Green
}

Write-Host ""

# Check if port 8000 is available
Write-Host "Checking port 8000..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "[WARNING] Port 8000 is already in use!" -ForegroundColor Yellow
    $processId = $portInUse.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Found process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
        $response = Read-Host "Kill process and start server (K) or Exit (E)"
        if ($response -eq "K" -or $response -eq "k") {
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "[OK] Process killed" -ForegroundColor Green
                Start-Sleep -Seconds 2
            } catch {
                Write-Host "ERROR: Could not kill process. You may need administrator privileges." -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
        } else {
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Host "[OK] Port 8000 is available" -ForegroundColor Green
}

Write-Host ""

# Run Django system check
Write-Host "Running Django system check..." -ForegroundColor Yellow
python manage.py check 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Django system check found issues" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        exit 1
    }
} else {
    Write-Host "[OK] System check passed" -ForegroundColor Green
}

Write-Host ""

# Check for pending migrations
Write-Host "Checking for pending migrations..." -ForegroundColor Yellow
$migrationOutput = python manage.py showmigrations --plan 2>&1 | Out-String
$pendingMigrations = $migrationOutput | Select-String -Pattern "\[ \]"

if ($pendingMigrations) {
    Write-Host "[WARNING] There are pending migrations" -ForegroundColor Yellow
    $response = Read-Host "Apply migrations now? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "Applying migrations..." -ForegroundColor Yellow
        python manage.py migrate
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Migrations applied" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Migration failed, but continuing..." -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Django Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  - API: http://localhost:8000/api/" -ForegroundColor Green
Write-Host "  - Health Check: http://localhost:8000/api/health/" -ForegroundColor Green
Write-Host "  - Admin: http://localhost:8000/admin/" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start Django development server
python manage.py runserver

# If we get here, the server has stopped
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server stopped." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"


# Quick script to install CadQuery
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing CadQuery" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"

if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: Could not find backend directory" -ForegroundColor Red
    exit 1
}

Set-Location $backendPath

# Check if virtual environment exists
$venvActivate = Join-Path $backendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Host "ERROR: Virtual environment not found!" -ForegroundColor Red
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& $venvActivate

# Check if CadQuery is already installed
Write-Host "Checking if CadQuery is installed..." -ForegroundColor Yellow
$cadqueryCheck = python -c "import cadquery; print('CadQuery version:', cadquery.__version__)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] CadQuery is already installed" -ForegroundColor Green
    Write-Host $cadqueryCheck
    exit 0
}

Write-Host "[INFO] CadQuery is not installed. Installing now..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This may take several minutes. Please wait..." -ForegroundColor Yellow
Write-Host ""

# Upgrade pip first
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip 2>&1 | Out-Null

# Install CadQuery
Write-Host "Installing CadQuery..." -ForegroundColor Yellow
python -m pip install cadquery

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] CadQuery installed successfully!" -ForegroundColor Green
    
    # Verify installation
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Yellow
    $verify = python -c "import cadquery; print('CadQuery version:', cadquery.__version__)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $verify" -ForegroundColor Green
        Write-Host ""
        Write-Host "CadQuery is ready to use!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Installation completed but verification failed" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "ERROR: Failed to install CadQuery" -ForegroundColor Red
    Write-Host "Please try installing manually:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Yellow
    Write-Host "  venv\Scripts\activate" -ForegroundColor Yellow
    Write-Host "  pip install cadquery" -ForegroundColor Yellow
    exit 1
}

Write-Host ""


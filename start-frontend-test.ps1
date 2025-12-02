# Script to start frontend for testing
# Make sure backend is running first!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Frontend for Testing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "Checking backend server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "✓ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend server is NOT running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the backend server first:" -ForegroundColor Yellow
    Write-Host "  1. Open a new terminal" -ForegroundColor Yellow
    Write-Host "  2. Run: .\start-backend.ps1" -ForegroundColor Yellow
    Write-Host "  3. Wait for 'Starting development server at http://127.0.0.1:8000/'" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (Y/N)"
    if ($continue -ne "Y" -and $continue -ne "y") {
        exit 1
    }
}

Write-Host ""

# Change to frontend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $scriptPath "chimney-craft-3d-main"

if (-not (Test-Path $frontendPath)) {
    Write-Host "ERROR: Could not find frontend directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $frontendPath
Write-Host "Changed to frontend directory: $frontendPath" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Frontend Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The frontend will start on:" -ForegroundColor Green
Write-Host "  - Local: http://localhost:5173/" -ForegroundColor Green
Write-Host ""
Write-Host "Available pages:" -ForegroundColor Green
Write-Host "  - Main page: http://localhost:5173/" -ForegroundColor Green
Write-Host "  - STP Converter: http://localhost:5173/stp-converter" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the development server
npm run dev

# If we get here, the server has stopped
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Frontend server stopped." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"


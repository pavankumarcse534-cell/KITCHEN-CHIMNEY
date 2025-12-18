# PowerShell script to upload GLB files
# Usage: .\UPLOAD_GLB_SIMPLE.ps1 <model_type> <glb_file_path> [image_file_path]

param(
    [Parameter(Mandatory=$true)]
    [string]$ModelType,
    
    [Parameter(Mandatory=$true)]
    [string]$GlbFilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$ImageFilePath
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Simple GLB File Upload" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Activate virtual environment if it exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    & "venv\Scripts\Activate.ps1"
    Write-Host "Virtual environment activated" -ForegroundColor Green
} elseif (Test-Path "..\venv\Scripts\Activate.ps1") {
    & "..\venv\Scripts\Activate.ps1"
    Write-Host "Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "No virtual environment found, using system Python" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Uploading GLB file..." -ForegroundColor Cyan
Write-Host "  Model Type: $ModelType" -ForegroundColor White
Write-Host "  GLB File: $GlbFilePath" -ForegroundColor White
if ($ImageFilePath) {
    Write-Host "  Image File: $ImageFilePath" -ForegroundColor White
}
Write-Host ""

# Build command
$pythonCmd = "python upload_glb_simple.py `"$ModelType`" `"$GlbFilePath`""
if ($ImageFilePath) {
    $pythonCmd += " `"$ImageFilePath`""
}

# Run the Python script
Invoke-Expression $pythonCmd

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


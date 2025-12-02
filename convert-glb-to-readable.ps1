# GLB to Readable Format Converter Helper Script
# This script converts GLB files to readable glTF JSON format
# Usage: .\convert-glb-to-readable.ps1 <path-to-glb-file> [output-path]

param(
    [Parameter(Mandatory=$true)]
    [string]$GlbFilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath
)

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendScript = Join-Path $ScriptDir "backend\scripts\glb_to_readable.py"

# Check if the backend script exists
if (-not (Test-Path $BackendScript)) {
    Write-Host "Error: GLB conversion script not found at: $BackendScript" -ForegroundColor Red
    exit 1
}

# Check if the GLB file exists
if (-not (Test-Path $GlbFilePath)) {
    Write-Host "Error: GLB file not found: $GlbFilePath" -ForegroundColor Red
    exit 1
}

# Resolve absolute paths
$GlbFilePath = Resolve-Path $GlbFilePath
$BackendScript = Resolve-Path $BackendScript

# Activate virtual environment if it exists
$VenvPath = Join-Path $ScriptDir "backend\venv\Scripts\Activate.ps1"
if (Test-Path $VenvPath) {
    Write-Host "Activating virtual environment..." -ForegroundColor Cyan
    & $VenvPath
}

# Build Python command
$PythonArgs = @($BackendScript, $GlbFilePath)
if ($OutputPath) {
    $PythonArgs += "-o"
    $PythonArgs += $OutputPath
}

Write-Host "Converting GLB file to readable format..." -ForegroundColor Cyan
Write-Host "Input: $GlbFilePath" -ForegroundColor Gray

# Run the conversion script
try {
    python $PythonArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nConversion completed successfully!" -ForegroundColor Green
        
        # Determine output file path
        if ($OutputPath) {
            $OutputFile = $OutputPath
        } else {
            $OutputFile = [System.IO.Path]::ChangeExtension($GlbFilePath, ".gltf")
        }
        
        if (Test-Path $OutputFile) {
            Write-Host "Output file: $OutputFile" -ForegroundColor Green
            Write-Host "`nYou can now open this file in any text editor!" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`nConversion failed. Check the error messages above." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "Error running conversion script: $_" -ForegroundColor Red
    exit 1
}


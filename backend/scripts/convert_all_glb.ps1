# PowerShell script to convert all GLB files to readable glTF JSON format
# Usage: .\backend\scripts\convert_all_glb.ps1

$glbDir = "media\uploads\glb"
$scriptPath = "backend\scripts\glb_to_readable.py"

if (-not (Test-Path $glbDir)) {
    Write-Host "Error: Directory not found: $glbDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Converting all GLB files in $glbDir..." -ForegroundColor Green
Write-Host ""

$glbFiles = Get-ChildItem -Path $glbDir -Filter "*.glb"

if ($glbFiles.Count -eq 0) {
    Write-Host "No GLB files found in $glbDir" -ForegroundColor Yellow
    exit 0
}

$converted = 0
$skipped = 0

foreach ($glbFile in $glbFiles) {
    $glbPath = $glbFile.FullName
    $gltfPath = $glbPath -replace '\.glb$', '.gltf'
    
    if (Test-Path $gltfPath) {
        Write-Host "Skipping $($glbFile.Name) - already converted" -ForegroundColor Yellow
        $skipped++
    } else {
        Write-Host "Converting: $($glbFile.Name)..." -ForegroundColor Cyan
        python $scriptPath "`"$glbPath`""
        if ($LASTEXITCODE -eq 0) {
            $converted++
            Write-Host "  ✓ Successfully converted" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Conversion failed" -ForegroundColor Red
        }
        Write-Host ""
    }
}

Write-Host "=" * 60 -ForegroundColor Green
Write-Host "Conversion complete!" -ForegroundColor Green
Write-Host "  Converted: $converted files" -ForegroundColor Green
Write-Host "  Skipped: $skipped files (already converted)" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Green


# Diagnostic script to identify common issues
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "System Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$issues = @()
$warnings = @()

# Check 1: Backend server
Write-Host "1. Checking backend server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   [OK] Backend server is running" -ForegroundColor Green
        try {
            $health = $response.Content | ConvertFrom-Json
            Write-Host "   [OK] Health check passed" -ForegroundColor Green
            if ($health.glb_conversion) {
                if ($health.glb_conversion.available) {
                    Write-Host "   [OK] GLB conversion available" -ForegroundColor Green
                } else {
                    $warnings += "GLB conversion not available: $($health.glb_conversion.error)"
                    Write-Host "   [WARNING] GLB conversion not available" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "   [WARNING] Could not parse health response" -ForegroundColor Yellow
        }
    } else {
        $issues += "Backend server returned status $($response.StatusCode)"
        Write-Host "   [ERROR] Backend server returned status $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    $issues += "Backend server is not running"
    Write-Host "   [ERROR] Backend server is NOT running" -ForegroundColor Red
    Write-Host "      Start it with: .\start-backend.ps1" -ForegroundColor Yellow
}

Write-Host ""

# Check 2: Port availability
Write-Host "2. Checking port availability..." -ForegroundColor Yellow
$ports = @(8000, 5173, 8080)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connection) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "   [OK] Port $port is in use by: $($process.ProcessName)" -ForegroundColor Green
        } else {
            Write-Host "   [WARNING] Port $port is in use (process unknown)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   - Port $port is available" -ForegroundColor Gray
    }
}

Write-Host ""

# Check 3: Frontend dependencies
Write-Host "3. Checking frontend dependencies..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "chimney-craft-3d-main"
if (Test-Path $frontendPath) {
    $nodeModules = Join-Path $frontendPath "node_modules"
    if (Test-Path $nodeModules) {
        Write-Host "   [OK] Frontend dependencies installed" -ForegroundColor Green
    } else {
        $issues += "Frontend dependencies not installed"
        Write-Host "   [ERROR] Frontend dependencies not installed" -ForegroundColor Red
        Write-Host "      Run: cd chimney-craft-3d-main; npm install" -ForegroundColor Yellow
    }
} else {
    $issues += "Frontend directory not found"
    Write-Host "   [ERROR] Frontend directory not found" -ForegroundColor Red
}

Write-Host ""

# Check 4: Media directory
Write-Host "4. Checking media directory..." -ForegroundColor Yellow
$mediaPath = Join-Path $PSScriptRoot "media"
$glbPath = Join-Path $mediaPath "uploads\glb"
if (Test-Path $mediaPath) {
    Write-Host "   [OK] Media directory exists" -ForegroundColor Green
    if (Test-Path $glbPath) {
        Write-Host "   [OK] GLB upload directory exists" -ForegroundColor Green
        $glbFiles = Get-ChildItem -Path $glbPath -Filter "*.glb" -ErrorAction SilentlyContinue
        if ($glbFiles) {
            Write-Host "   [OK] Found $($glbFiles.Count) GLB file(s)" -ForegroundColor Green
        } else {
            Write-Host "   - No GLB files found in upload directory" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [WARNING] GLB upload directory does not exist (will be created on first upload)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARNING] Media directory does not exist (will be created on first upload)" -ForegroundColor Yellow
}

Write-Host ""

# Check 5: Test GLB files
Write-Host "5. Checking test GLB files..." -ForegroundColor Yellow
$testGlbFiles = @(
    "media\WMSS Single Skin.glb",
    "media\WMSS Single Skin_5Secs (2).glb"
)
$foundFiles = 0
foreach ($file in $testGlbFiles) {
    $filePath = Join-Path $PSScriptRoot $file
    if (Test-Path $filePath) {
        $fileSize = (Get-Item $filePath).Length / 1MB
        $fileSizeMB = [math]::Round($fileSize, 2)
        Write-Host "   [OK] Found: $file ($fileSizeMB MB)" -ForegroundColor Green
        $foundFiles++
    }
}
if ($foundFiles -eq 0) {
    Write-Host "   - No test GLB files found" -ForegroundColor Gray
}

Write-Host ""

# Check 6: Python dependencies
Write-Host "6. Checking Python dependencies..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
$venvPath = Join-Path $backendPath "venv\Scripts\python.exe"
if (Test-Path $venvPath) {
    Write-Host "   [OK] Virtual environment found" -ForegroundColor Green
    
    # Check Django
    $djangoCheck = & $venvPath -c "import django; print(django.get_version())" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Django installed: $djangoCheck" -ForegroundColor Green
    } else {
        $issues += "Django not installed"
        Write-Host "   [ERROR] Django not installed" -ForegroundColor Red
    }
    
    # Check CadQuery
    & $venvPath -c "import cadquery; print('OK')" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] CadQuery installed" -ForegroundColor Green
    } else {
        $warnings += "CadQuery not installed (STP conversion will not work)"
        Write-Host "   [WARNING] CadQuery not installed (STP conversion will not work)" -ForegroundColor Yellow
        Write-Host "      Install with: pip install cadquery" -ForegroundColor Yellow
    }
} else {
    $issues += "Virtual environment not found"
        Write-Host "   [ERROR] Virtual environment not found" -ForegroundColor Red
    Write-Host "      Run setup script first" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "[SUCCESS] All checks passed! System is ready." -ForegroundColor Green
} else {
    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-Host "Issues found:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  [ERROR] $issue" -ForegroundColor Red
        }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "Warnings:" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "  [WARNING] $warning" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "See TROUBLESHOOTING.md for solutions" -ForegroundColor Yellow
}

Write-Host ""


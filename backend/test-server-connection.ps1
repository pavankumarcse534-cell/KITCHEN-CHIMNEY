# Quick test script to verify Django server connection
# Run this after starting the server with start-backend.bat

Write-Host "Testing Django Backend Server Connection..." -ForegroundColor Cyan
Write-Host ""

$healthUrl = "http://localhost:8000/api/health/"
$apiUrl = "http://localhost:8000/api/"

# Test health endpoint
Write-Host "Testing health endpoint: $healthUrl" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ SUCCESS: Server is running and responding!" -ForegroundColor Green
        Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "  Response:" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "✗ FAILED: Server is not responding" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. The server is started with: start-backend.bat" -ForegroundColor Yellow
    Write-Host "  2. Port 8000 is not blocked by firewall" -ForegroundColor Yellow
    Write-Host "  3. No other process is using port 8000" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Testing API root endpoint: $apiUrl" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $apiUrl -TimeoutSec 5 -UseBasicParsing
    Write-Host "✓ API root is accessible" -ForegroundColor Green
} catch {
    Write-Host "⚠ API root returned: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server Connection Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


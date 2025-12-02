# PowerShell script to check if backend server is running
Write-Host "Checking backend server status..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend server is RUNNING" -ForegroundColor Green
        Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "  Response: $($response.Content)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Server is ready to accept requests!" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "✗ Backend server is NOT running" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start the server, run:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Yellow
    Write-Host "  python manage.py runserver" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or double-click: start_backend.bat" -ForegroundColor Yellow
    exit 1
}










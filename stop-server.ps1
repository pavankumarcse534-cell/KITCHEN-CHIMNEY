# PowerShell script to stop Django server running in background

$ErrorActionPreference = "Stop"

Write-Host "Stopping Django server..."

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptDir "server.pid"

# Try to read PID from file
if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile
    Write-Host "Found server PID: $pid"
    
    try {
        Stop-Process -Id $pid -Force -ErrorAction Stop
        Write-Host "Server stopped successfully."
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Process $pid not found or already stopped."
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "PID file not found. Searching for processes on port 8000..."
}

# Also kill any processes using port 8000
$connections = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $processes) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "python") {
            Write-Host "Stopping Python process $pid on port 8000..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "All processes on port 8000 stopped."
} else {
    Write-Host "No processes found on port 8000."
}

Write-Host ""
Write-Host "Done!"











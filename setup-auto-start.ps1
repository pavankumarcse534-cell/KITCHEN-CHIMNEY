# PowerShell script to set up Windows Task Scheduler for auto-starting Django server
# Run this script as Administrator to enable auto-start on Windows boot

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Setting up Django Server Auto-Start"
Write-Host "========================================"
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!"
    Write-Host "Right-click PowerShell and select 'Run as Administrator'"
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $scriptDir "start-server-permanent.bat"

if (-not (Test-Path $startScript)) {
    Write-Host "ERROR: start-server-permanent.bat not found!"
    exit 1
}

# Task Scheduler task name
$taskName = "DjangoChimneyCraftServer"

Write-Host "Creating Windows Task Scheduler entry..."
Write-Host "Task Name: $taskName"
Write-Host "Start Script: $startScript"
Write-Host ""

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action (run the batch file)
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$startScript`""

# Create the trigger (on system startup)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create the principal (run as current user)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

# Create settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Auto-start Django Chimney Craft Backend Server" | Out-Null
    Write-Host "SUCCESS: Task created successfully!"
    Write-Host ""
    Write-Host "The Django server will now start automatically when Windows boots."
    Write-Host ""
    Write-Host "To manage the task:"
    Write-Host "  1. Open Task Scheduler (taskschd.msc)"
    Write-Host "  2. Find task: $taskName"
    Write-Host "  3. You can enable/disable or delete it from there"
    Write-Host ""
    Write-Host "To remove auto-start, run: remove-auto-start.ps1"
} catch {
    Write-Host "ERROR: Failed to create scheduled task!"
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")











# PowerShell script to remove Windows Task Scheduler auto-start

$ErrorActionPreference = "Stop"

Write-Host "Removing Django Server Auto-Start..."

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!"
    Write-Host "Right-click PowerShell and select 'Run as Administrator'"
    exit 1
}

$taskName = "DjangoChimneyCraftServer"

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "SUCCESS: Auto-start task removed."
} else {
    Write-Host "No auto-start task found."
}

Write-Host "Done!"











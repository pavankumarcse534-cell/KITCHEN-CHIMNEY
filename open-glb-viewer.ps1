# PowerShell script to open GLB files in the 3D viewer
# Usage: .\open-glb-viewer.ps1 [path-to-glb-file]

param(
    [Parameter(Mandatory=$false, Position=0)]
    [string]$GlbFilePath
)

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ViewerPath = Join-Path $ScriptDir "glb-viewer.html"

# Check if viewer exists
if (-not (Test-Path $ViewerPath)) {
    Write-Host "Error: glb-viewer.html not found at: $ViewerPath" -ForegroundColor Red
    exit 1
}

# If no file path provided, try to get it from the currently selected file in VS Code/Cursor
if ([string]::IsNullOrEmpty($GlbFilePath)) {
    # Try to get file from clipboard (if user copied file path)
    $clipboard = Get-Clipboard -ErrorAction SilentlyContinue
    if ($clipboard -and (Test-Path $clipboard) -and $clipboard -match '\.glb$') {
        $GlbFilePath = $clipboard
        Write-Host "Using file from clipboard: $GlbFilePath" -ForegroundColor Yellow
    } else {
        # Prompt user to select a file
        Write-Host "No GLB file specified. Opening file picker..." -ForegroundColor Yellow
        Add-Type -AssemblyName System.Windows.Forms
        $openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
        $openFileDialog.Filter = "GLB Files (*.glb)|*.glb|GLTF Files (*.gltf)|*.gltf|All Files (*.*)|*.*"
        $openFileDialog.Title = "Select a GLB/GLTF file to view"
        
        if ($openFileDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $GlbFilePath = $openFileDialog.FileName
        } else {
            Write-Host "No file selected. Exiting." -ForegroundColor Yellow
            exit 0
        }
    }
}

# Validate file path
if (-not (Test-Path $GlbFilePath)) {
    Write-Host "Error: File not found: $GlbFilePath" -ForegroundColor Red
    exit 1
}

# Check if it's a GLB/GLTF file
$extension = [System.IO.Path]::GetExtension($GlbFilePath).ToLower()
if ($extension -ne ".glb" -and $extension -ne ".gltf") {
    Write-Host "Warning: File extension is not .glb or .gltf: $extension" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 0
    }
}

# Convert file paths to absolute paths (handle relative paths)
$absoluteGlbPath = if ([System.IO.Path]::IsPathRooted($GlbFilePath)) {
    $GlbFilePath
} else {
    [System.IO.Path]::GetFullPath((Join-Path $ScriptDir $GlbFilePath))
}

$absoluteViewerPath = [System.IO.Path]::GetFullPath($ViewerPath)

Write-Host "Opening GLB viewer..." -ForegroundColor Green
Write-Host "  GLB File: $absoluteGlbPath" -ForegroundColor Cyan
Write-Host "  Viewer: $absoluteViewerPath" -ForegroundColor Cyan

# Copy GLB file path to clipboard for easy drag-and-drop
try {
    Set-Clipboard -Value $absoluteGlbPath -ErrorAction SilentlyContinue
    Write-Host "  (GLB file path copied to clipboard)" -ForegroundColor Gray
} catch {
    # Ignore clipboard errors
}

# Open the HTML viewer file directly in the default browser
# This is the most reliable method
$browserOpened = $false

# Method 1: Use Invoke-Item (most reliable on Windows)
try {
    Invoke-Item $absoluteViewerPath -ErrorAction Stop
    $browserOpened = $true
    Write-Host "" -ForegroundColor Green
    Write-Host "[SUCCESS] Viewer opened in browser!" -ForegroundColor Green
} catch {
    Write-Host "Method 1 failed: $_" -ForegroundColor Yellow
}

# Method 2: Use Start-Process with the file path
if (-not $browserOpened) {
    try {
        Start-Process $absoluteViewerPath -ErrorAction Stop
        $browserOpened = $true
        Write-Host "" -ForegroundColor Green
        Write-Host "[SUCCESS] Viewer opened in browser!" -ForegroundColor Green
    } catch {
        Write-Host "Method 2 failed: $_" -ForegroundColor Yellow
    }
}

# Method 3: Use cmd start (fallback)
if (-not $browserOpened) {
    try {
        $viewerPathQuoted = "`"$absoluteViewerPath`""
        cmd /c start "" $viewerPathQuoted 2>$null
        Start-Sleep -Milliseconds 500
        $browserOpened = $true
        Write-Host "" -ForegroundColor Green
        Write-Host "[SUCCESS] Viewer opened in browser!" -ForegroundColor Green
    } catch {
        Write-Host "Method 3 failed: $_" -ForegroundColor Yellow
    }
}

# Provide instructions
if ($browserOpened) {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "Instructions:" -ForegroundColor Yellow
    Write-Host "  1. The viewer should now be open in your browser" -ForegroundColor White
    Write-Host "  2. Drag and drop your GLB file into the viewer, OR" -ForegroundColor White
    Write-Host "  3. Click 'Select GLB/GLTF File' and choose: $absoluteGlbPath" -ForegroundColor White
    Write-Host "" -ForegroundColor Cyan
    Write-Host "Tip: The GLB file path is copied to your clipboard for easy access!" -ForegroundColor Cyan
} else {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "[WARNING] Could not automatically open browser." -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Yellow
    Write-Host "Manual Instructions:" -ForegroundColor Yellow
    Write-Host "  1. Open this file in your browser:" -ForegroundColor White
    Write-Host "     $absoluteViewerPath" -ForegroundColor Cyan
    Write-Host "  2. Drag and drop your GLB file into the viewer:" -ForegroundColor White
    Write-Host "     $absoluteGlbPath" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
    Write-Host "The GLB file path is copied to your clipboard!" -ForegroundColor Cyan
}

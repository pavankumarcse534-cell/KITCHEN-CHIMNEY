# Quick Start Guide

## Start Both Servers

### Option 1: PowerShell Script (Recommended)

**Run in PowerShell:**
```powershell
.\START_SERVERS.ps1
```

Or double-click `START_SERVERS.ps1` in File Explorer (if PowerShell execution policy allows).

### Option 2: Batch File

**Double-click:** `START_SERVERS.bat`

Or run in Command Prompt:
```cmd
START_SERVERS.bat
```

### Option 3: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2 - Frontend:**
```bash
cd chimney-craft-3d-main
npm run dev
```

## Verify Servers Are Running

1. **Backend**: Open `http://localhost:8000/api/health/`
   - Should see: `{"status":"ok","server":"Django REST API","version":"1.0.0"}`

2. **Frontend**: Open `http://localhost:5173/` or `http://localhost:8080/`
   - Should see the home page with 8 model type cards

## Test Upload

1. Click on any model type card
2. Click "Upload" button
3. Select a GLB (.glb) or STEP (.stp, .step) file
4. File should upload and preview should appear

## Troubleshooting

### PowerShell Execution Policy Error

If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try again:
```powershell
.\START_SERVERS.ps1
```

### Port 8000 Already in Use

The scripts will automatically try to free the port. If it fails:
```powershell
# Find process using port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess

# Kill the process (replace <PID> with actual process ID)
Stop-Process -Id <PID> -Force
```

### Backend Server Not Starting

1. Check Python is installed: `python --version`
2. Check Django is installed: `python -c "import django; print(django.get_version())"`
3. Check you're in the backend directory
4. Check for error messages in the terminal

### Frontend Server Not Starting

1. Check Node.js is installed: `node --version`
2. Check npm is installed: `npm --version`
3. Install dependencies: `cd chimney-craft-3d-main && npm install`
4. Check for error messages in the terminal

## Expected Behavior

✅ **Should Work:**
- GLB file upload → Preview appears
- STEP file upload → Uploads successfully
- All 8 model types visible
- No CORS errors
- No 404 errors

❌ **Should Fail (with error):**
- PNG file upload → "PNG and SVG formats are not supported"
- SVG file upload → "PNG and SVG formats are not supported"

## Quick Commands

**Check Backend:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -UseBasicParsing
```

**Check Model Types:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/get-all-model-types/" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Stop Servers:**
- Close the PowerShell/Command Prompt windows where servers are running
- Or press `Ctrl+C` in each terminal


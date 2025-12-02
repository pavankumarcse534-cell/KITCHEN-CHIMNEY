# Upload GLB Files to Database - Instructions

This guide explains how to upload GLB files from `media/models/original/` directory to the database so they appear in the frontend preview page.

## Files Created

1. **`upload_glb_to_database.py`** - Links existing GLB files to model types (Recommended)
2. **`upload_original_glb_files.py`** - Copies files from original/ to models/ and uploads
3. **`upload_all_glb_files.bat`** - Windows batch file to run the upload script

## Quick Start (Windows)

1. Open Command Prompt or PowerShell
2. Navigate to the backend directory:
   ```bash
   cd "C:\Users\DELL PC\Downloads\Front End-chimney project\backend"
   ```
3. Run the batch file:
   ```bash
   upload_all_glb_files.bat
   ```

## Manual Run (Windows/Linux/Mac)

1. Navigate to the backend directory
2. Run the Python script:
   ```bash
   python upload_glb_to_database.py
   ```

## What the Script Does

The script will:

1. ✅ Ensure all 8 model types exist in the database
2. ✅ Link GLB files to their corresponding model types:
   - `WMSS_Single_Skin.glb` → **Wall Mounted Single Skin**
   - `WMSS_Single_Skin_5Secs_1_sVZ4uVd.glb` → **Wall Mounted Single Plenum**
   - `GA___Drawing_DS1__Date_201023041524.glb` → **Wall-Mounted Double Skin**
   - `GA___Drawing_DS2__Date_201023041758.glb` → **Wall-Mounted Compensating** & **UV Compensating**
   - `GA___Drawing_DS3__Date_201023042051.glb` → **Island Single Skin**
   - `GA___Drawing_DS4__Date_201023042629.glb` → **Island Double Skin**
   - `GA___Drawing_DS5__Date_201023043026.glb` → **Island Compensating**

3. ✅ Check both `models/` and `models/original/` directories
4. ✅ Create database records if they don't exist
5. ✅ Link files to the correct model types

## File Locations Checked

The script checks for files in these locations:
- `backend/media/models/WMSS_Single_Skin.glb`
- `backend/media/models/original/WMSS_Single_Skin.glb`
- `backend/media/models/GA___Drawing_DS1__Date_201023041524.glb`
- `backend/media/models/original/GA___Drawing_DS1__Date_201023041524.glb`
- (and so on for all files)

## Verification

After running the script, verify the upload:

1. **Check Django Admin:**
   - Go to: http://127.0.0.1:8000/admin/api/chimneydesign/
   - You should see 8 designs with GLB files linked

2. **Check API Endpoint:**
   - Go to: http://127.0.0.1:8000/api/get-all-model-types/
   - You should see all 8 model types with `glb_url` populated

3. **Check Frontend:**
   - Go to: http://localhost:5173/ (or your frontend URL)
   - Click on any chimney type
   - The 3D model should load in the viewer

## Troubleshooting

### Error: "File not found"
- Make sure the GLB files exist in `backend/media/models/` or `backend/media/models/original/`
- Check the file names match exactly (case-sensitive)

### Error: "Django not found"
- Make sure you're in the backend directory
- Make sure Django is installed: `pip install django`

### Models not showing in frontend
- Make sure the backend server is running: `python manage.py runserver`
- Check browser console for errors
- Verify the API returns GLB URLs: http://127.0.0.1:8000/api/get-all-model-types/

## File Mapping

| GLB File | Model Type | Database Title |
|----------|-----------|----------------|
| WMSS_Single_Skin.glb | wall_mounted_skin | Wall Mounted Single Skin |
| WMSS_Single_Skin_5Secs_1_sVZ4uVd.glb | wall_mounted_single_plenum | Wall Mounted Single Plenum |
| GA___Drawing_DS1__Date_201023041524.glb | wall_mounted_double_skin | Wall-Mounted Double Skin |
| GA___Drawing_DS2__Date_201023041758.glb | wall_mounted_compensating | Wall-Mounted Compensating |
| GA___Drawing_DS2__Date_201023041758.glb | uv_compensating | UV Compensating |
| GA___Drawing_DS3__Date_201023042051.glb | island_single_skin | Island Single Skin |
| GA___Drawing_DS4__Date_201023042629.glb | island_double_skin | Island Double Skin |
| GA___Drawing_DS5__Date_201023043026.glb | island_compensating | Island Compensating |

## Notes

- The script will **not** delete existing files
- If a design already exists, it will **update** it with the new file
- Files in `models/original/` are preferred if both locations exist
- The `uv_compensating` type uses the same file as `wall_mounted_compensating`


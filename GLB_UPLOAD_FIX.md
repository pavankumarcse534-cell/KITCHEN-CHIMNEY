# GLB Upload Fix - Troubleshooting Guide

## Issues Identified and Fixed

### 1. ✅ File Input Accept Attribute
- **Issue**: File input only accepted `.glb,.gltf`
- **Fix**: Updated to accept `.glb,.gltf,.stp,.step`
- **File**: `chimney-craft-3d-main/src/pages/Index.tsx`

### 2. ✅ Upload Endpoint
- **Status**: Already configured correctly
- **Endpoint**: `/api/upload-glb/` with `permissions.AllowAny`
- **File**: `backend/api/views/main_views.py`

### 3. ✅ Error Handling
- **Status**: Comprehensive error handling in place
- **Includes**: Network errors, CORS errors, 404 errors, timeout handling

## Common Issues and Solutions

### Issue 1: "Upload failed" Error

**Possible Causes:**
1. Backend server not running
2. CORS configuration issue
3. File size too large
4. Invalid file format

**Solutions:**
1. **Check Backend Server:**
   ```bash
   # Verify backend is running
   curl http://localhost:8000/api/health/
   ```

2. **Check CORS Settings:**
   - Verify `CORS_ALLOW_ALL_ORIGINS = True` in DEBUG mode
   - Check `backend/chimney_craft_backend/settings.py`

3. **Check File Size:**
   - Maximum file size: 500 MB
   - Check browser console for size errors

4. **Check File Format:**
   - Only `.glb`, `.gltf`, `.stp`, `.step` allowed
   - PNG and SVG are rejected

### Issue 2: "No GLB URL returned"

**Possible Causes:**
1. Backend response doesn't include `glb_file_url`
2. URL normalization issue
3. Model type not found

**Solutions:**
1. **Check Backend Response:**
   - Open browser DevTools → Network tab
   - Check upload response for `glb_file_url` field
   - Verify response has `success: true`

2. **Check Model Type:**
   - Ensure model type is selected before upload
   - Valid model types:
     - `wall_mounted_skin`
     - `wall_mounted_single_plenum`
     - `wall_mounted_double_skin`
     - `wall_mounted_compensating`
     - `uv_compensating`
     - `island_single_skin`
     - `island_double_skin`
     - `island_compensating`

### Issue 3: "CORS Error"

**Solutions:**
1. **Check Backend CORS Settings:**
   ```python
   # In settings.py
   CORS_ALLOW_ALL_ORIGINS = True  # In DEBUG mode
   ```

2. **Check Media File CORS:**
   - Verify `media_views.py` includes CORS headers
   - Check `Access-Control-Allow-Origin` header

### Issue 4: "Network Error"

**Solutions:**
1. **Check Backend URL:**
   - Verify API URL is correct
   - Check `VITE_API_URL` environment variable
   - Default: `http://localhost:8000`

2. **Check Network Connection:**
   - Ensure backend server is accessible
   - Check firewall settings
   - Verify port 8000 is not blocked

## Testing Steps

### 1. Test Backend Health
```bash
curl http://localhost:8000/api/health/
```

**Expected Response:**
```json
{"status": "ok", "server": "Django REST API", "version": "1.0.0"}
```

### 2. Test Upload Endpoint
```bash
curl -X POST http://localhost:8000/api/upload-glb/ \
  -F "file=@test.glb" \
  -F "model_type=wall_mounted_skin"
```

**Expected Response:**
```json
{
  "success": true,
  "glb_file_url": "http://localhost:8000/media/models/...",
  "design_title": "Wall Mounted Single Skin",
  "model_type": "wall_mounted_skin"
}
```

### 3. Test in Browser
1. Open frontend: `http://localhost:5173/`
2. Select a model type
3. Click "Upload GLB" button
4. Select a GLB file
5. Check browser console for errors
6. Check Network tab for upload request

## Debug Checklist

- [ ] Backend server is running on port 8000
- [ ] Frontend server is running
- [ ] CORS is enabled in backend settings
- [ ] File format is `.glb` or `.gltf`
- [ ] File size is under 500 MB
- [ ] Model type is selected
- [ ] Browser console shows no errors
- [ ] Network tab shows successful upload (200 status)
- [ ] Response includes `glb_file_url`
- [ ] GLB viewer receives the URL

## Files Modified

1. ✅ `chimney-craft-3d-main/src/pages/Index.tsx`
   - Updated file input accept attribute
   - Enhanced error handling

## Next Steps

1. **Restart Backend:**
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```

2. **Restart Frontend:**
   ```bash
   cd chimney-craft-3d-main
   npm run dev
   ```

3. **Test Upload:**
   - Try uploading a GLB file
   - Check browser console for errors
   - Verify file appears in viewer

## Status

✅ **File Input Updated** - Now accepts `.glb,.gltf,.stp,.step`
✅ **Error Handling Enhanced** - Comprehensive error messages
✅ **Upload Endpoint Verified** - Correctly configured

If issues persist, check browser console and network tab for specific error messages.


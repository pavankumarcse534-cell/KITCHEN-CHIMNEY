# Backend Server & CORS Fix

## ✅ Issues Fixed

1. **CORS Middleware Order** - Moved `CorsMiddleware` to the top (before `CommonMiddleware`)
2. **CORS Configuration** - Improved CORS settings for DEBUG mode
3. **Media File CORS** - Enhanced CORS headers for GLB/media files
4. **Server Startup Script** - Created `START_BACKEND.bat` for easy server startup

## 🚀 Starting Backend Server

### Option 1: Use Batch Script (Recommended)
```bash
cd backend
START_BACKEND.bat
```

### Option 2: Manual Start
```bash
cd backend
# Activate virtual environment if exists
venv\Scripts\activate  # Windows
python manage.py runserver 0.0.0.0:8000
```

## 🔧 CORS Configuration

### Current Settings (DEBUG=True):
- ✅ `CORS_ALLOW_ALL_ORIGINS = True` - Allows all origins in development
- ✅ `CORS_ALLOW_CREDENTIALS = True` - Allows credentials
- ✅ `CORS_URLS_REGEX = r'^/api/.*$|^/media/.*$'` - Applies to API and media files
- ✅ CORS middleware is positioned correctly (before CommonMiddleware)

### CORS Headers Added:
- `Access-Control-Allow-Origin` - Set dynamically based on request origin
- `Access-Control-Allow-Methods` - GET, HEAD, OPTIONS
- `Access-Control-Allow-Headers` - Accept, Content-Type, Origin, etc.
- `Access-Control-Expose-Headers` - Content-Type, Content-Length, etc.
- `Access-Control-Allow-Credentials` - true (when origin is specified)

## ✅ Verification

### Check Server Status:
```bash
cd backend
python check_server.py
```

### Test API Endpoint:
```bash
curl http://localhost:8000/api/health/
```

### Test CORS:
Open browser console on frontend (http://localhost:5173) and check:
- No CORS errors in console
- API requests succeed
- GLB files load correctly

## 🔍 Troubleshooting

### Server Not Starting?

1. **Check Port 8000:**
   ```bash
   netstat -ano | findstr ":8000"
   ```
   If port is in use, kill the process or use a different port

2. **Check Python/Django:**
   ```bash
   python --version
   python manage.py check
   ```

3. **Check Virtual Environment:**
   ```bash
   # Activate venv
   venv\Scripts\activate
   # Install dependencies if needed
   pip install -r requirements.txt
   ```

### CORS Errors?

1. **Check CORS Middleware Order:**
   - Should be BEFORE `CommonMiddleware` in `settings.py`

2. **Check DEBUG Mode:**
   - `DEBUG = True` in `settings.py`
   - `CORS_ALLOW_ALL_ORIGINS = True` when DEBUG=True

3. **Check Browser Console:**
   - Look for CORS error messages
   - Check Network tab for failed requests

4. **Test OPTIONS Request:**
   ```bash
   curl -X OPTIONS http://localhost:8000/api/health/ \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -v
   ```

## 📝 Files Modified

1. `backend/chimney_craft_backend/settings.py`
   - Fixed CORS middleware order
   - Improved CORS configuration

2. `backend/api/views/media_views.py`
   - Enhanced CORS headers for media files
   - Added OPTIONS handler

3. `backend/START_BACKEND.bat` (NEW)
   - Easy server startup script

4. `backend/check_server.py` (NEW)
   - Server and CORS verification script

## ✨ Next Steps

1. Start backend server: `cd backend && START_BACKEND.bat`
2. Verify server is running: `python check_server.py`
3. Start frontend: `cd chimney-craft-3d-main && npm run dev`
4. Test in browser: http://localhost:5173
5. Check browser console for any CORS errors


# Import Error Fix - ModuleNotFoundError

## Issue Fixed

**Error**: `ModuleNotFoundError: No module named 'api.views.admin_helpers'`

**Location**: `backend/api/views/main_views.py` line 666 (and other locations)

**Root Cause**: Incorrect import path. The code was using `.admin_helpers` (relative import looking for `api.views.admin_helpers`), but the actual file is at `api.admin_helpers`.

## Solution

Fixed all incorrect imports from:
```python
from .admin_helpers import ...  # ❌ Wrong - looks in api.views.admin_helpers
```

To:
```python
from ..admin_helpers import ...  # ✅ Correct - looks in api.admin_helpers
```

## Files Fixed

**File**: `backend/api/views/main_views.py`

Fixed imports in:
1. `upload_glb()` - line 445
2. `upload_image()` - line 525
3. `upload_3d_object()` - line 603
4. `get_model_by_type()` - line 666
5. `delete_model_by_type()` - line 810

## File Structure

```
backend/
  api/
    admin_helpers.py          ← Actual location
    views/
      main_views.py          ← File with imports (needs ..admin_helpers)
```

## Verification

All imports now correctly use:
- `from ..admin_helpers import MODEL_TYPE_MAPPING, get_design_by_model_type`

This correctly resolves to `api.admin_helpers` from `api.views.main_views`.

## Testing

After restarting the server:
1. Test `/api/get-model-by-type/?model_type=wall_mounted_skin` - should work without 500 error
2. Test other model type endpoints - should work correctly
3. Check server logs - no more ModuleNotFoundError

## Status

✅ **FIXED** - All import errors resolved


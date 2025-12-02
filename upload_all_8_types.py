#!/usr/bin/env python3
"""
Bulk upload script for all 8 chimney design model types
Usage: python upload_all_8_types.py <directory_with_glb_files>
"""

import requests
import json
import sys
import os
from pathlib import Path

API_BASE = os.getenv('API_BASE_URL', 'http://localhost:8000')

# All 8 model types
MODEL_TYPES = [
    'wall_mounted_skin',
    'wall_mounted_single_plenum',
    'wall_mounted_double_skin',
    'wall_mounted_compensating',
    'uv_compensating',
    'island_single_skin',
    'island_double_skin',
    'island_compensating',
]

# Model type display names
MODEL_TYPE_NAMES = {
    'wall_mounted_skin': 'WALL MOUNTED SINGLE SKIN',
    'wall_mounted_single_plenum': 'WALL MOUNTED SINGLE PLENUM',
    'wall_mounted_double_skin': 'WALL-MOUNTED DOUBLE SKIN',
    'wall_mounted_compensating': 'WALL-MOUNTED COMPENSATING',
    'uv_compensating': 'UV COMPENSATING',
    'island_single_skin': 'ISLAND SINGLE SKIN',
    'island_double_skin': 'ISLAND DOUBLE SKIN',
    'island_compensating': 'ISLAND COMPENSATING',
}

def find_glb_file(directory, model_type):
    """Find GLB file for a model type"""
    dir_path = Path(directory)
    
    # Common file name patterns
    patterns = [
        f"{model_type}.glb",
        f"{model_type}.GLB",
        f"{model_type.replace('_', '-')}.glb",
        f"{model_type.replace('_', ' ')}.glb",
        f"{MODEL_TYPE_NAMES[model_type].lower().replace(' ', '_')}.glb",
        f"{MODEL_TYPE_NAMES[model_type].lower().replace(' ', '-')}.glb",
    ]
    
    # Search for files matching patterns
    for pattern in patterns:
        for file_path in dir_path.glob(f"*{pattern}*"):
            if file_path.is_file() and file_path.suffix.lower() in ['.glb', '.gltf']:
                return file_path
    
    # If no pattern match, search all GLB files
    glb_files = list(dir_path.glob("*.glb")) + list(dir_path.glob("*.GLB"))
    if len(glb_files) == 1:
        return glb_files[0]
    
    return None

def upload_glb(file_path, model_type):
    """Upload GLB file with model type"""
    url = f"{API_BASE}/api/upload-glb/"
    
    if not file_path or not file_path.exists():
        return None, f"File not found: {file_path}"
    
    print(f"📤 Uploading: {file_path.name}")
    print(f"   Model Type: {model_type} ({MODEL_TYPE_NAMES[model_type]})")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'model_type': model_type}
            response = requests.post(url, files=files, data=data, timeout=300)  # 5 min timeout for large files
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Success!")
                print(f"   GLB URL: {result.get('glb_file_url')}")
                print(f"   Design ID: {result.get('design_id')}")
                return result, None
            else:
                error_msg = f"Upload failed: {response.status_code} - {response.text}"
                print(f"❌ {error_msg}")
                return None, error_msg
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        print(f"❌ {error_msg}")
        return None, error_msg

def main():
    if len(sys.argv) < 2:
        print("Usage: python upload_all_8_types.py <directory_with_glb_files>")
        print("\nExample:")
        print("  python upload_all_8_types.py ./glb_files")
        print("\nThe script will:")
        print("  1. Search for GLB files matching each model type")
        print("  2. Upload each file with the corresponding model_type")
        print("  3. Create/update ChimneyDesign entries in backend")
        print("\nModel Types:")
        for mt in MODEL_TYPES:
            print(f"  - {mt} ({MODEL_TYPE_NAMES[mt]})")
        sys.exit(1)
    
    directory = sys.argv[1]
    if not os.path.isdir(directory):
        print(f"❌ Error: Directory not found: {directory}")
        sys.exit(1)
    
    print("=" * 70)
    print("  Bulk Upload for All 8 Chimney Design Model Types")
    print("=" * 70)
    print(f"Directory: {directory}")
    print(f"API Base: {API_BASE}")
    print()
    
    results = {}
    success_count = 0
    fail_count = 0
    
    for model_type in MODEL_TYPES:
        print(f"\n{'='*70}")
        print(f"Processing: {MODEL_TYPE_NAMES[model_type]}")
        print(f"Model Type: {model_type}")
        print(f"{'='*70}")
        
        # Find GLB file
        glb_file = find_glb_file(directory, model_type)
        
        if not glb_file:
            print(f"⚠️  No GLB file found for {model_type}")
            print(f"   Searched patterns: {model_type}.glb, {model_type.replace('_', '-')}.glb, etc.")
            results[model_type] = {'status': 'skipped', 'reason': 'File not found'}
            fail_count += 1
            continue
        
        print(f"📁 Found file: {glb_file.name}")
        
        # Upload
        result, error = upload_glb(glb_file, model_type)
        
        if result:
            results[model_type] = {'status': 'success', 'result': result}
            success_count += 1
        else:
            results[model_type] = {'status': 'failed', 'error': error}
            fail_count += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("  Upload Summary")
    print("=" * 70)
    print(f"✅ Successful: {success_count}/{len(MODEL_TYPES)}")
    print(f"❌ Failed/Skipped: {fail_count}/{len(MODEL_TYPES)}")
    print()
    
    print("Details:")
    for model_type, result in results.items():
        status = result['status']
        if status == 'success':
            print(f"  ✅ {MODEL_TYPE_NAMES[model_type]}: {result['result'].get('glb_file_url', 'N/A')}")
        elif status == 'failed':
            print(f"  ❌ {MODEL_TYPE_NAMES[model_type]}: {result.get('error', 'Unknown error')}")
        else:
            print(f"  ⚠️  {MODEL_TYPE_NAMES[model_type]}: {result.get('reason', 'Skipped')}")
    
    print("\n" + "=" * 70)
    if success_count == len(MODEL_TYPES):
        print("🎉 All 8 model types uploaded successfully!")
        print("   You can now test in frontend by selecting any model type.")
    else:
        print("⚠️  Some uploads failed. Please check the errors above.")
    print("=" * 70)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Upload cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)








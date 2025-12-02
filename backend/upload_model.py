#!/usr/bin/env python3
"""
Simple script to upload GLB/images with model type
Usage: python upload_model.py <file_path> <model_type> [--type glb|image]
"""

import requests
import json
import sys
import os

API_BASE = os.getenv('API_BASE_URL', 'http://localhost:8000')

def upload_glb(file_path, model_type):
    """Upload GLB file with model type"""
    url = f"{API_BASE}/api/upload-glb/"
    
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        return None
    
    print(f"📤 Uploading GLB: {file_path}")
    print(f"   Model Type: {model_type}")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'model_type': model_type}
            response = requests.post(url, files=files, data=data)
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Upload successful!")
                print(f"   GLB URL: {result.get('glb_file_url')}")
                print(f"   Design ID: {result.get('design_id')}")
                return result
            else:
                error_msg = f"Upload failed: {response.status_code} - {response.text}"
                print(f"❌ {error_msg}")
                return None
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        print(f"❌ {error_msg}")
        return None

def upload_image(file_path, model_type):
    """Upload image file with model type"""
    url = f"{API_BASE}/api/upload-image/"
    
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        return None
    
    print(f"📤 Uploading Image: {file_path}")
    print(f"   Model Type: {model_type}")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'model_type': model_type}
            response = requests.post(url, files=files, data=data)
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Upload successful!")
                print(f"   Image URL: {result.get('image_file_url')}")
                print(f"   Design ID: {result.get('design_id')}")
                return result
            else:
                error_msg = f"Upload failed: {response.status_code} - {response.text}"
                print(f"❌ {error_msg}")
                return None
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        print(f"❌ {error_msg}")
        return None

def main():
    if len(sys.argv) < 3:
        print("Usage: python upload_model.py <file_path> <model_type> [--type glb|image]")
        print("\nExample:")
        print("  python upload_model.py model.glb wall_mounted_skin")
        print("  python upload_model.py image.jpg wall_mounted_skin --type image")
        print("\nAvailable model types:")
        print("  - wall_mounted_skin")
        print("  - wall_mounted_single_plenum")
        print("  - wall_mounted_double_skin")
        print("  - wall_mounted_compensating")
        print("  - uv_compensating")
        print("  - island_single_skin")
        print("  - island_double_skin")
        print("  - island_compensating")
        sys.exit(1)
    
    file_path = sys.argv[1]
    model_type = sys.argv[2]
    file_type = 'glb'  # default
    
    # Check for --type flag
    if '--type' in sys.argv:
        idx = sys.argv.index('--type')
        if idx + 1 < len(sys.argv):
            file_type = sys.argv[idx + 1].lower()
    
    # Auto-detect file type from extension
    if file_type == 'glb':
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']:
            file_type = 'image'
    
    print(f"🚀 Uploading to: {API_BASE}")
    print("=" * 60)
    
    if file_type == 'image':
        result = upload_image(file_path, model_type)
    else:
        result = upload_glb(file_path, model_type)
    
    if result:
        print("\n" + "=" * 60)
        print("✅ Upload complete! You can now test in frontend.")
        print(f"   Select model type: {model_type}")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ Upload failed. Please check the errors above.")
        print("=" * 60)
        sys.exit(1)

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








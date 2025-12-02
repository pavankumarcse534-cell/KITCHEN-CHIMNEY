"""
Test script to verify GLB upload endpoint is working
Run this from the backend directory: python test_glb_upload.py
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile
from pathlib import Path

def test_glb_upload():
    """Test the GLB upload endpoint"""
    client = Client()
    
    # Check if we have a test GLB file
    test_glb_path = None
    possible_paths = [
        "../media/WMSS Single Skin_5Secs (4).glb",
        "../media/WMSS Single Skin (2).glb",
        "media/uploads/glb/WMSS_Single_Skin_2_8e502712.glb",
    ]
    
    for path in possible_paths:
        full_path = os.path.join(os.path.dirname(__file__), path)
        if os.path.exists(full_path):
            test_glb_path = full_path
            break
    
    if not test_glb_path:
        print("❌ No test GLB file found. Please provide a GLB file to test.")
        return False
    
    print(f"📁 Using test file: {test_glb_path}")
    
    # Read the GLB file
    with open(test_glb_path, 'rb') as f:
        file_content = f.read()
    
    file_name = os.path.basename(test_glb_path)
    print(f"📦 File size: {len(file_content)} bytes ({len(file_content) / 1024 / 1024:.2f} MB)")
    
    # Create a SimpleUploadedFile
    uploaded_file = SimpleUploadedFile(
        name=file_name,
        content=file_content,
        content_type='model/gltf-binary'
    )
    
    # Test the upload endpoint
    print("\n🔄 Testing upload endpoint: /api/upload-glb/")
    response = client.post('/api/upload-glb/', {'file': uploaded_file})
    
    print(f"📊 Status Code: {response.status_code}")
    print(f"📄 Response: {response.content.decode('utf-8')[:500]}")
    
    if response.status_code == 200:
        import json
        data = json.loads(response.content)
        print("\n✅ Upload successful!")
        print(f"   File URL: {data.get('glb_file_url', 'N/A')}")
        print(f"   Filename: {data.get('glb_file', 'N/A')}")
        return True
    else:
        print(f"\n❌ Upload failed with status {response.status_code}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("GLB Upload Endpoint Test")
    print("=" * 60)
    success = test_glb_upload()
    print("\n" + "=" * 60)
    if success:
        print("✅ Test passed!")
    else:
        print("❌ Test failed!")
    print("=" * 60)


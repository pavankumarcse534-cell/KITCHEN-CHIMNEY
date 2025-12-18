"""
Test script to verify preview image upload functionality
Run this from the backend directory: python test_preview_upload.py
"""
import os
import sys
import django
from pathlib import Path

# Add the backend directory to the path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile
from io import BytesIO
from PIL import Image

def test_image_upload():
    """Test the image upload endpoint"""
    print("=" * 60)
    print("Testing Preview Image Upload Endpoint")
    print("=" * 60)
    
    # Create a test client
    client = Client()
    
    # Create a simple test image
    print("\n1. Creating test image...")
    img = Image.new('RGB', (100, 100), color='red')
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    
    test_file = SimpleUploadedFile(
        "test_preview.png",
        img_buffer.read(),
        content_type="image/png"
    )
    
    print(f"   ✓ Test image created: {test_file.name} ({test_file.size} bytes)")
    
    # Test upload with model_type
    print("\n2. Testing upload with model_type...")
    test_model_type = "wmss_single_skin_1_sec"
    
    response = client.post(
        '/api/upload-image/',
        {
            'file': test_file,
            'model_type': test_model_type,
            'is_thumbnail': 'true'
        },
        format='multipart'
    )
    
    print(f"   Status Code: {response.status_code}")
    print(f"   Response: {response.json() if response.status_code < 400 else response.content}")
    
    if response.status_code == 201:
        data = response.json()
        print(f"\n   ✅ Upload successful!")
        print(f"   - File path: {data.get('file_path')}")
        print(f"   - URL: {data.get('url')}")
        print(f"   - Model type: {data.get('model_type')}")
        print(f"   - Design ID: {data.get('design_id')}")
        return True
    else:
        print(f"\n   ❌ Upload failed!")
        try:
            error_data = response.json()
            print(f"   Error: {error_data.get('error', 'Unknown error')}")
        except:
            print(f"   Error: {response.content.decode()}")
        return False

def test_upload_without_model_type():
    """Test upload without model_type"""
    print("\n" + "=" * 60)
    print("Testing Upload Without Model Type")
    print("=" * 60)
    
    client = Client()
    
    # Create a simple test image
    img = Image.new('RGB', (100, 100), color='blue')
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    
    test_file = SimpleUploadedFile(
        "test_image.png",
        img_buffer.read(),
        content_type="image/png"
    )
    
    response = client.post(
        '/api/upload-image/',
        {
            'file': test_file,
            'is_thumbnail': 'false'
        },
        format='multipart'
    )
    
    print(f"   Status Code: {response.status_code}")
    if response.status_code == 201:
        data = response.json()
        print(f"   ✅ Upload successful!")
        print(f"   - File path: {data.get('file_path')}")
        print(f"   - URL: {data.get('url')}")
        return True
    else:
        print(f"   ❌ Upload failed!")
        try:
            error_data = response.json()
            print(f"   Error: {error_data.get('error', 'Unknown error')}")
        except:
            print(f"   Error: {response.content.decode()}")
        return False

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("Preview Image Upload Test")
    print("=" * 60)
    
    try:
        # Test 1: Upload with model_type
        result1 = test_image_upload()
        
        # Test 2: Upload without model_type
        result2 = test_upload_without_model_type()
        
        print("\n" + "=" * 60)
        print("Test Summary")
        print("=" * 60)
        print(f"Upload with model_type: {'✅ PASS' if result1 else '❌ FAIL'}")
        print(f"Upload without model_type: {'✅ PASS' if result2 else '❌ FAIL'}")
        
        if result1 and result2:
            print("\n✅ All tests passed!")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed. Check the output above.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


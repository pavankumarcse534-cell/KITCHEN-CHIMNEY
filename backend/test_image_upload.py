"""
Test script to verify image upload endpoint is working
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile
from io import BytesIO

def test_image_upload():
    """Test the image upload endpoint"""
    client = Client()
    
    # Create a simple test image (1x1 PNG)
    png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
    
    test_file = SimpleUploadedFile(
        "test_image.png",
        png_data,
        content_type="image/png"
    )
    
    print("Testing image upload endpoint...")
    response = client.post('/api/upload-image/', {'file': test_file})
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("✅ Image upload endpoint is working!")
        return True
    else:
        print("❌ Image upload endpoint failed!")
        return False

if __name__ == '__main__':
    test_image_upload()


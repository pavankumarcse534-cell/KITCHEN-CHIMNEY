#!/usr/bin/env python
"""
Test script to verify upload-3d-object endpoint is accessible
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.urls import reverse, resolve
from django.test import Client
from django.conf import settings

def test_endpoint():
    print("="*60)
    print("Testing Upload 3D Object Endpoint")
    print("="*60)
    
    # Test URL resolution
    try:
        url = reverse('upload-3d-object')
        print(f"✓ URL reverse successful: {url}")
    except Exception as e:
        print(f"✗ URL reverse failed: {e}")
        return False
    
    # Test URL pattern
    try:
        resolved = resolve('/api/upload-3d-object/')
        print(f"✓ URL resolve successful: {resolved.view_name}")
        print(f"  View function: {resolved.func.__name__}")
    except Exception as e:
        print(f"✗ URL resolve failed: {e}")
        return False
    
    # Test endpoint with test client
    client = Client()
    try:
        # POST without file (should return 400)
        response = client.post('/api/upload-3d-object/')
        print(f"✓ Endpoint accessible: Status {response.status_code}")
        if response.status_code == 400:
            print("  ✓ Correctly returns 400 when no file provided")
        return True
    except Exception as e:
        print(f"✗ Endpoint test failed: {e}")
        return False

if __name__ == '__main__':
    success = test_endpoint()
    sys.exit(0 if success else 1)










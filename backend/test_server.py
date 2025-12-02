"""
Simple test script to verify Django server configuration
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.conf import settings
from django.test import Client
from django.urls import reverse

def test_configuration():
    """Test basic Django configuration"""
    print("Testing Django Configuration...")
    print(f"Django Version: {django.get_version()}")
    print(f"DEBUG: {settings.DEBUG}")
    print(f"BASE_DIR: {settings.BASE_DIR}")
    print(f"PROJECT_ROOT: {settings.BASE_DIR.parent}")
    print()

def test_urls():
    """Test URL configuration"""
    print("Testing URL Configuration...")
    client = Client()
    
    # Test API endpoint
    try:
        response = client.get('/api/')
        print(f"✓ API endpoint accessible: {response.status_code}")
    except Exception as e:
        print(f"✗ API endpoint error: {e}")
    
    # Test admin endpoint
    try:
        response = client.get('/admin/')
        print(f"✓ Admin endpoint accessible: {response.status_code}")
    except Exception as e:
        print(f"✗ Admin endpoint error: {e}")
    
    # Test frontend endpoint
    try:
        response = client.get('/')
        print(f"✓ Frontend endpoint accessible: {response.status_code}")
        if response.status_code == 200:
            content = response.content.decode('utf-8')
            if 'html' in content.lower() or 'Frontend not found' in content:
                print("  → Frontend view is working (may need to build frontend)")
        else:
            print(f"  → Status: {response.status_code}")
    except Exception as e:
        print(f"✗ Frontend endpoint error: {e}")
    
    print()

def test_static_files():
    """Test static files configuration"""
    print("Testing Static Files Configuration...")
    print(f"STATIC_URL: {settings.STATIC_URL}")
    print(f"STATIC_ROOT: {settings.STATIC_ROOT}")
    print(f"STATICFILES_DIRS: {settings.STATICFILES_DIRS}")
    print(f"MEDIA_URL: {settings.MEDIA_URL}")
    print(f"MEDIA_ROOT: {settings.MEDIA_ROOT}")
    print()

def test_frontend_paths():
    """Test frontend file paths"""
    print("Testing Frontend Paths...")
    PROJECT_ROOT = settings.BASE_DIR.parent
    frontend_dist = os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main', 'dist')
    frontend_source = os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main')
    root_index = os.path.join(PROJECT_ROOT, 'index.html')
    
    paths = {
        'Frontend dist': frontend_dist,
        'Frontend source': frontend_source,
        'Root index.html': root_index,
    }
    
    for name, path in paths.items():
        exists = os.path.exists(path)
        status = "✓" if exists else "✗"
        print(f"{status} {name}: {path}")
        if exists and os.path.isfile(path):
            print(f"  → File exists")
        elif exists and os.path.isdir(path):
            print(f"  → Directory exists")
            # Check for index.html in dist
            if 'dist' in path:
                index_path = os.path.join(path, 'index.html')
                if os.path.exists(index_path):
                    print(f"  → index.html found in dist")
    print()

if __name__ == '__main__':
    print("=" * 60)
    print("Django Server Configuration Test")
    print("=" * 60)
    print()
    
    try:
        test_configuration()
        test_static_files()
        test_frontend_paths()
        test_urls()
        
        print("=" * 60)
        print("Test Complete!")
        print("=" * 60)
        print()
        print("To start the server, run:")
        print("  python manage.py runserver")
        print()
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


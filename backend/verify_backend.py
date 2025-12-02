#!/usr/bin/env python
"""
Backend Verification Script
Checks all backend configurations and endpoints
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.conf import settings
from django.core.management import execute_from_command_line
from django.urls import reverse
from django.test import Client
import json

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def check_django_config():
    print_section("Django Configuration Check")
    
    print(f"✓ DEBUG: {settings.DEBUG}")
    print(f"✓ ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
    print(f"✓ SECRET_KEY: {'Set' if settings.SECRET_KEY else 'NOT SET'}")
    print(f"✓ MEDIA_ROOT: {settings.MEDIA_ROOT}")
    print(f"✓ MEDIA_URL: {settings.MEDIA_URL}")
    print(f"✓ STATIC_ROOT: {settings.STATIC_ROOT}")
    print(f"✓ STATIC_URL: {settings.STATIC_URL}")
    
    # Check if media directory exists
    if os.path.exists(settings.MEDIA_ROOT):
        print(f"✓ MEDIA_ROOT directory exists")
    else:
        print(f"⚠ MEDIA_ROOT directory does not exist: {settings.MEDIA_ROOT}")
        try:
            os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
            print(f"✓ Created MEDIA_ROOT directory")
        except Exception as e:
            print(f"✗ Failed to create MEDIA_ROOT: {e}")

def check_cors_config():
    print_section("CORS Configuration Check")
    
    try:
        from corsheaders.conf import settings as cors_settings
        print(f"✓ CORS middleware installed")
        print(f"✓ CORS_ALLOW_ALL_ORIGINS: {getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False)}")
        print(f"✓ CORS_ALLOWED_ORIGINS: {getattr(settings, 'CORS_ALLOWED_ORIGINS', [])}")
        print(f"✓ CORS_ALLOW_CREDENTIALS: {getattr(settings, 'CORS_ALLOW_CREDENTIALS', False)}")
        print(f"✓ CORS_ALLOW_METHODS: {getattr(settings, 'CORS_ALLOW_METHODS', [])}")
    except ImportError:
        print("✗ CORS headers not installed")
    except Exception as e:
        print(f"✗ CORS check failed: {e}")

def check_file_upload_settings():
    print_section("File Upload Settings Check")
    
    print(f"✓ DATA_UPLOAD_MAX_MEMORY_SIZE: {getattr(settings, 'DATA_UPLOAD_MAX_MEMORY_SIZE', 'Not set')} bytes")
    print(f"✓ FILE_UPLOAD_MAX_MEMORY_SIZE: {getattr(settings, 'FILE_UPLOAD_MAX_MEMORY_SIZE', 'Not set')} bytes")
    print(f"✓ DATA_UPLOAD_MAX_NUMBER_FIELDS: {getattr(settings, 'DATA_UPLOAD_MAX_NUMBER_FIELDS', 'Not set')}")
    
    max_size_mb = getattr(settings, 'FILE_UPLOAD_MAX_MEMORY_SIZE', 0) / (1024 * 1024)
    print(f"✓ Max file size: {max_size_mb:.0f} MB")

def check_api_endpoints():
    print_section("API Endpoints Check")
    
    client = Client()
    endpoints = [
        ('/api/health/', 'GET', 'Health Check'),
        ('/api/upload-3d-object/', 'POST', '3D Object Upload'),
        ('/api/upload-glb/', 'POST', 'GLB Upload'),
        ('/api/upload-image/', 'POST', 'Image Upload'),
    ]
    
    for endpoint, method, name in endpoints:
        try:
            if method == 'GET':
                response = client.get(endpoint)
            else:
                # For POST, we expect 400 (no file) or 405 (method not allowed) which is fine
                response = client.post(endpoint)
            
            status = response.status_code
            if status in [200, 201, 400, 405]:
                print(f"✓ {name}: {endpoint} - Status {status} (OK)")
            else:
                print(f"⚠ {name}: {endpoint} - Status {status}")
        except Exception as e:
            print(f"✗ {name}: {endpoint} - Error: {e}")

def check_media_directories():
    print_section("Media Directories Check")
    
    media_root = settings.MEDIA_ROOT
    directories = [
        'uploads',
        'uploads/3d_objects',
        'uploads/3d_objects/thumbnails',
        'uploads/glb',
        'uploads/glb_thumbnails',
        'uploads/images',
        'models',
        'models/original',
    ]
    
    for dir_path in directories:
        full_path = os.path.join(media_root, dir_path)
        if os.path.exists(full_path):
            file_count = len([f for f in os.listdir(full_path) if os.path.isfile(os.path.join(full_path, f))])
            print(f"✓ {dir_path}/ - {file_count} files")
        else:
            try:
                os.makedirs(full_path, exist_ok=True)
                print(f"✓ {dir_path}/ - Created")
            except Exception as e:
                print(f"✗ {dir_path}/ - Failed to create: {e}")

def check_installed_apps():
    print_section("Installed Apps Check")
    
    required_apps = [
        'rest_framework',
        'corsheaders',
        'api',
    ]
    
    for app in required_apps:
        if app in settings.INSTALLED_APPS:
            print(f"✓ {app} installed")
        else:
            print(f"✗ {app} NOT installed")

def check_dependencies():
    print_section("Python Dependencies Check")
    
    dependencies = [
        'django',
        'djangorestframework',
        'django-cors-headers',
        'Pillow',
        'cadquery',
        'trimesh',
        'pygltflib',
        'numpy',
    ]
    
    for dep in dependencies:
        try:
            if dep == 'django':
                import django
                print(f"✓ {dep}: {django.get_version()}")
            elif dep == 'djangorestframework':
                import rest_framework
                print(f"✓ {dep}: {rest_framework.VERSION}")
            elif dep == 'django-cors-headers':
                import corsheaders
                print(f"✓ {dep}: installed")
            elif dep == 'Pillow':
                from PIL import Image
                print(f"✓ {dep}: {Image.__version__}")
            elif dep == 'cadquery':
                import cadquery as cq
                print(f"✓ {dep}: installed")
            elif dep == 'trimesh':
                import trimesh
                print(f"✓ {dep}: {trimesh.__version__}")
            elif dep == 'pygltflib':
                import pygltflib
                print(f"✓ {dep}: installed")
            elif dep == 'numpy':
                import numpy
                print(f"✓ {dep}: {numpy.__version__}")
        except ImportError:
            print(f"✗ {dep}: NOT installed")
        except Exception as e:
            print(f"⚠ {dep}: Error checking - {e}")

def main():
    print("\n" + "="*60)
    print("  BACKEND VERIFICATION & TROUBLESHOOTING")
    print("="*60)
    
    try:
        check_django_config()
        check_cors_config()
        check_file_upload_settings()
        check_installed_apps()
        check_dependencies()
        check_media_directories()
        check_api_endpoints()
        
        print_section("Verification Complete")
        print("✓ All checks completed")
        print("\nTo start the server, run:")
        print("  python manage.py runserver")
        print("\nTo test the API, visit:")
        print("  http://localhost:8000/api/health/")
        
    except Exception as e:
        print(f"\n✗ Verification failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())


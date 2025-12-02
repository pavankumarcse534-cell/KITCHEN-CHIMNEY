#!/usr/bin/env python
"""
Test script to verify Django admin static files configuration
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.contrib.staticfiles import finders
from django.conf import settings

print("=" * 60)
print("Django Admin Static Files Configuration Test")
print("=" * 60)
print()

# Check settings
print("Settings:")
print(f"  STATIC_URL: {settings.STATIC_URL}")
print(f"  STATIC_ROOT: {settings.STATIC_ROOT}")
print(f"  DEBUG: {settings.DEBUG}")
print(f"  INSTALLED_APPS includes staticfiles: {'django.contrib.staticfiles' in settings.INSTALLED_APPS}")
print()

# Check if admin static files can be found
print("Static Files Finder Test:")
admin_css = finders.find('admin/css/base.css')
admin_js = finders.find('admin/js/core.js')

print(f"  Admin CSS (base.css): {'✓ FOUND' if admin_css else '✗ NOT FOUND'}")
if admin_css:
    print(f"    Path: {admin_css}")

print(f"  Admin JS (core.js): {'✓ FOUND' if admin_js else '✗ NOT FOUND'}")
if admin_js:
    print(f"    Path: {admin_js}")

print()

# Check STATIC_ROOT directory
print("STATIC_ROOT Directory:")
static_root_exists = os.path.exists(settings.STATIC_ROOT)
print(f"  Exists: {'✓ YES' if static_root_exists else '✗ NO (will be created by collectstatic)'}")
if os.path.exists(os.path.dirname(settings.STATIC_ROOT)):
    parent_writable = os.access(os.path.dirname(settings.STATIC_ROOT), os.W_OK)
    print(f"  Parent writable: {'✓ YES' if parent_writable else '✗ NO'}")
print()

# Summary
print("=" * 60)
if admin_css and admin_js:
    print("✓ SUCCESS: Admin static files are accessible")
    print("  Django admin should work correctly with staticfiles_urlpatterns()")
else:
    print("✗ WARNING: Some admin static files not found")
    print("  This may indicate an issue with Django installation")
print("=" * 60)


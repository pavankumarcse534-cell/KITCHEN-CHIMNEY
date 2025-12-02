#!/usr/bin/env python
"""
Test script to verify all 8 model types are configured correctly
"""
import os
import django
import sys

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from api.admin_helpers import MODEL_TYPE_MAPPING, ensure_model_type_designs, get_design_by_model_type
from api.models import ChimneyDesign
from django.conf import settings
import os

print("=" * 60)
print("Testing 8 Model Types Configuration")
print("=" * 60)
print()

# Ensure all 8 model types exist
print("1. Ensuring all 8 model types exist in database...")
result = ensure_model_type_designs()
print(f"   ✅ Processed {len(result)} model types")
for r in result:
    print(f"   - {r['model_type']}: {r['action']} (ID: {r['id']})")
print()

# Check each model type
print("2. Checking each model type for GLB files...")
print()
all_ok = True
for model_type, title in MODEL_TYPE_MAPPING.items():
    design = get_design_by_model_type(model_type)
    if design:
        has_glb = bool(design.model_file)
        has_original = bool(design.original_file)
        
        # Check if file exists on disk
        glb_exists = False
        if design.model_file:
            try:
                if hasattr(design.model_file, 'path'):
                    glb_exists = os.path.exists(design.model_file.path)
                elif hasattr(design.model_file, 'name'):
                    file_path = os.path.join(settings.MEDIA_ROOT, design.model_file.name)
                    glb_exists = os.path.exists(file_path)
            except:
                pass
        
        status = "✅" if glb_exists else "⚠️"
        print(f"   {status} {model_type}:")
        print(f"      Title: {design.title}")
        print(f"      GLB in DB: {has_glb}")
        print(f"      Original in DB: {has_original}")
        print(f"      GLB on disk: {glb_exists}")
        if not glb_exists:
            all_ok = False
    else:
        print(f"   ❌ {model_type}: Design not found!")
        all_ok = False
    print()

print("=" * 60)
if all_ok:
    print("✅ All 8 model types are configured correctly!")
else:
    print("⚠️  Some model types are missing GLB files.")
    print("   Upload GLB files via Django admin: http://localhost:8000/admin/")
print("=" * 60)


#!/usr/bin/env python3
"""
Alternative script to directly link existing GLB files to model types
This script links files that already exist in media/models/ or media/models/original/

Usage: python upload_glb_to_database.py
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.conf import settings
from api.models import ChimneyDesign
from api.admin_helpers import MODEL_TYPE_MAPPING, get_design_by_model_type, ensure_model_type_designs
import logging

logger = logging.getLogger(__name__)

# Map of GLB file paths (relative to MEDIA_ROOT) to model types
GLB_FILE_TO_MODEL_TYPE = {
    # Files in models/ directory
    'models/WMSS_Single_Skin.glb': 'wall_mounted_skin',
    'models/original/WMSS_Single_Skin_5Secs_1_sVZ4uVd.glb': 'wall_mounted_single_plenum',
    'models/GA___Drawing_DS1__Date_201023041524.glb': 'wall_mounted_double_skin',
    'models/GA___Drawing_DS2__Date_201023041758.glb': 'wall_mounted_compensating',
    'models/GA___Drawing_DS3__Date_201023042051.glb': 'island_single_skin',
    'models/GA___Drawing_DS4__Date_201023042629.glb': 'island_double_skin',
    'models/GA___Drawing_DS5__Date_201023043026.glb': 'island_compensating',
    
    # Files in models/original/ directory (will be copied to models/)
    'models/original/WMSS_Single_Skin.glb': 'wall_mounted_skin',
    'models/original/GA___Drawing_DS1__Date_201023041524.glb': 'wall_mounted_double_skin',
    'models/original/GA___Drawing_DS2__Date_201023041758.glb': 'wall_mounted_compensating',
    'models/original/GA___Drawing_DS3__Date_201023042051.glb': 'island_single_skin',
    'models/original/GA___Drawing_DS4__Date_201023042629.glb': 'island_double_skin',
    'models/original/GA___Drawing_DS5__Date_201023043026.glb': 'island_compensating',
}

# uv_compensating uses the same file as wall_mounted_compensating
UV_COMPENSATING_FILE = 'models/GA___Drawing_DS2__Date_201023041758.glb'

def link_file_to_model_type(file_path_rel, model_type):
    """
    Link an existing file to a model type
    """
    file_path_abs = os.path.join(settings.MEDIA_ROOT, file_path_rel)
    
    if not os.path.exists(file_path_abs):
        print(f"⚠️  File not found: {file_path_abs}")
        return False
    
    model_title = MODEL_TYPE_MAPPING.get(model_type)
    if not model_title:
        print(f"❌ Invalid model_type: {model_type}")
        return False
    
    try:
        # Get or create design
        design = get_design_by_model_type(model_type)
        if not design:
            design = ChimneyDesign.objects.create(
                title=model_title,
                description=f"3D model for {model_title} (model_type: {model_type})",
                is_active=True
            )
            print(f"✅ Created design for {model_type}")
        
        # Open the file and save it properly using Django's FileField
        from django.core.files import File
        with open(file_path_abs, 'rb') as glb_file:
            # Get just the filename
            filename = os.path.basename(file_path_rel)
            # Save using Django's FileField - this ensures proper URL generation
            design.model_file.save(filename, File(glb_file), save=False)
            design.is_active = True
            design.save()
        
        # Verify the file was saved correctly
        if design.model_file:
            print(f"✅ Linked {file_path_rel} → {model_type} ({model_title})")
            print(f"   Design ID: {design.id}")
            print(f"   File saved as: {design.model_file.name}")
            # Try to get URL
            try:
                if hasattr(design.model_file, 'url'):
                    print(f"   File URL: {design.model_file.url}")
            except:
                pass
            return True
        else:
            print(f"❌ File was not saved correctly")
            return False
        
    except Exception as e:
        print(f"❌ Error linking {file_path_rel}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """
    Main function to link all GLB files to model types
    """
    print("=" * 60)
    print("Linking GLB files to model types")
    print("=" * 60)
    
    # Ensure all model types exist
    print("\n📋 Ensuring all model types exist...")
    ensure_model_type_designs()
    print("✅ All model types verified\n")
    
    print(f"📁 MEDIA_ROOT: {settings.MEDIA_ROOT}\n")
    
    # Link files
    linked_count = 0
    skipped_count = 0
    
    for file_path_rel, model_type in GLB_FILE_TO_MODEL_TYPE.items():
        print(f"\n📤 Processing: {file_path_rel} → {model_type}")
        if link_file_to_model_type(file_path_rel, model_type):
            linked_count += 1
        else:
            skipped_count += 1
    
    # Handle uv_compensating (uses same file as wall_mounted_compensating)
    print(f"\n📤 Processing: {UV_COMPENSATING_FILE} → uv_compensating (shared)")
    if link_file_to_model_type(UV_COMPENSATING_FILE, 'uv_compensating'):
        linked_count += 1
    else:
        skipped_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("Link Summary")
    print("=" * 60)
    print(f"✅ Successfully linked: {linked_count} files")
    print(f"⚠️  Skipped/Not found: {skipped_count} files")
    print("\n🎉 Linking complete!")
    print("\nYou can now view these models in the frontend preview page.")
    print("\nTo verify, check:")
    print("  - Django admin: http://127.0.0.1:8000/admin/api/chimneydesign/")
    print("  - API endpoint: http://127.0.0.1:8000/api/get-all-model-types/")

if __name__ == '__main__':
    main()


#!/usr/bin/env python3
"""
Script to upload GLB files from media/models/original/ directory to database
Links them to the correct model types for frontend preview

Usage: python upload_original_glb_files.py
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
from django.core.files import File
import logging

logger = logging.getLogger(__name__)

# Map of GLB filenames to model types
GLB_FILE_MAPPING = {
    'WMSS_Single_Skin.glb': 'wall_mounted_skin',
    'WMSS_Single_Skin_5Secs_1_sVZ4uVd.glb': 'wall_mounted_single_plenum',
    'GA___Drawing_DS1__Date_201023041524.glb': 'wall_mounted_double_skin',
    'GA___Drawing_DS2__Date_201023041758.glb': 'wall_mounted_compensating',  # Also used for uv_compensating
    'GA___Drawing_DS3__Date_201023042051.glb': 'island_single_skin',
    'GA___Drawing_DS4__Date_201023042629.glb': 'island_double_skin',
    'GA___Drawing_DS5__Date_201023043026.glb': 'island_compensating',
}

# Additional mapping for uv_compensating (uses same file as wall_mounted_compensating)
GLB_FILE_MAPPING_EXTRA = {
    'GA___Drawing_DS2__Date_201023041758.glb': 'uv_compensating',
}

def upload_glb_file(file_path, model_type):
    """
    Upload a GLB file to the database and link it to a model type
    """
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    filename = os.path.basename(file_path)
    model_title = MODEL_TYPE_MAPPING.get(model_type)
    
    if not model_title:
        print(f"❌ Invalid model_type: {model_type}")
        return False
    
    try:
        # Ensure design exists
        design = get_design_by_model_type(model_type)
        if not design:
            # Create design if it doesn't exist
            design = ChimneyDesign.objects.create(
                title=model_title,
                description=f"3D model for {model_title} (model_type: {model_type})",
                is_active=True
            )
            print(f"✅ Created design for {model_type}")
        else:
            print(f"📝 Found existing design for {model_type} (ID: {design.id})")
        
        # Open and save the file
        with open(file_path, 'rb') as glb_file:
            # Save to models/ directory (not original/)
            target_path = f'models/{filename}'
            design.model_file.save(filename, File(glb_file), save=True)
            design.is_active = True
            design.save()
            
            print(f"✅ Uploaded {filename} → {model_type} ({model_title})")
            print(f"   File saved as: {design.model_file.name}")
            print(f"   Design ID: {design.id}")
            return True
            
    except Exception as e:
        print(f"❌ Error uploading {filename}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """
    Main function to upload all GLB files from original/ directory
    """
    print("=" * 60)
    print("Uploading GLB files from media/models/original/")
    print("=" * 60)
    
    # Ensure all model types exist
    print("\n📋 Ensuring all model types exist...")
    ensure_model_type_designs()
    print("✅ All model types verified\n")
    
    # Get the original directory path
    original_dir = os.path.join(settings.MEDIA_ROOT, 'models', 'original')
    
    if not os.path.exists(original_dir):
        print(f"❌ Directory not found: {original_dir}")
        return
    
    print(f"📁 Scanning directory: {original_dir}\n")
    
    # Upload files based on mapping
    uploaded_count = 0
    skipped_count = 0
    
    # First, upload primary mappings
    for filename, model_type in GLB_FILE_MAPPING.items():
        file_path = os.path.join(original_dir, filename)
        
        if os.path.exists(file_path):
            print(f"\n📤 Processing: {filename}")
            if upload_glb_file(file_path, model_type):
                uploaded_count += 1
            else:
                skipped_count += 1
        else:
            print(f"⚠️  File not found: {filename}")
            skipped_count += 1
    
    # Upload extra mappings (like uv_compensating using same file)
    print("\n" + "=" * 60)
    print("Uploading additional model types (shared files)")
    print("=" * 60)
    
    for filename, model_type in GLB_FILE_MAPPING_EXTRA.items():
        file_path = os.path.join(original_dir, filename)
        
        if os.path.exists(file_path):
            print(f"\n📤 Processing: {filename} → {model_type}")
            # For shared files, we'll copy the file reference
            # Get the source design
            source_model_type = GLB_FILE_MAPPING.get(filename)
            if source_model_type:
                source_design = get_design_by_model_type(source_model_type)
                if source_design and source_design.model_file:
                    # Get or create target design
                    target_design = get_design_by_model_type(model_type)
                    if not target_design:
                        target_design = ChimneyDesign.objects.create(
                            title=MODEL_TYPE_MAPPING.get(model_type),
                            description=f"3D model for {MODEL_TYPE_MAPPING.get(model_type)} (model_type: {model_type})",
                            is_active=True
                        )
                    
                    # Copy the file reference
                    target_design.model_file = source_design.model_file
                    target_design.is_active = True
                    target_design.save()
                    print(f"✅ Linked {filename} → {model_type} (shared with {source_model_type})")
                    uploaded_count += 1
                else:
                    print(f"⚠️  Source file not found for {source_model_type}")
            else:
                # Upload directly if not in primary mapping
                if upload_glb_file(file_path, model_type):
                    uploaded_count += 1
        else:
            print(f"⚠️  File not found: {filename}")
            skipped_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("Upload Summary")
    print("=" * 60)
    print(f"✅ Successfully uploaded: {uploaded_count} files")
    print(f"⚠️  Skipped/Not found: {skipped_count} files")
    print("\n🎉 Upload complete!")
    print("\nYou can now view these models in the frontend preview page.")

if __name__ == '__main__':
    main()


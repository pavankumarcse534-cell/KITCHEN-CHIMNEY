"""
Script to ensure only primary GLB files are set for preview
This will keep only one primary GLB file per model type for cleaner preview
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

from api.models import ChimneyDesign, DesignGLBFile
from api.admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING, ensure_model_type_designs
from django.conf import settings

def ensure_primary_glb_files():
    """Ensure each model type has exactly one primary GLB file"""
    print("="*60)
    print("Ensure Primary GLB Files for Preview")
    print("="*60)
    print()
    
    ensure_model_type_designs()
    
    model_types = [
        'wmss_single_skin_1_sec',
        'one_collar_hole_single_skin',
    ]
    
    for model_type in model_types:
        title = MODEL_TYPE_MAPPING.get(model_type)
        print(f"\n📦 Processing: {title}")
        print("-" * 60)
        
        design = get_design_by_model_type(model_type)
        if not design:
            print(f"   ⚠️  Design not found")
            continue
        
        # Get all GLB files
        glb_files = DesignGLBFile.objects.filter(design=design, file_type='model').order_by('is_primary', '-created_at')
        glb_count = glb_files.count()
        
        print(f"   📊 Total GLB files: {glb_count}")
        
        # Check for primary file
        primary_file = glb_files.filter(is_primary=True).first()
        
        if primary_file:
            print(f"   ✅ Primary file exists: {primary_file.file_name}")
            print(f"      File: {primary_file.file.name}")
            
            # Verify file exists
            file_path = os.path.join(settings.MEDIA_ROOT, primary_file.file.name)
            if os.path.exists(file_path):
                print(f"   ✅ File exists on disk")
            else:
                print(f"   ⚠️  File not found on disk: {file_path}")
        else:
            # Set first file as primary
            first_file = glb_files.first()
            if first_file:
                first_file.is_primary = True
                first_file.save()
                print(f"   ✅ Set first file as primary: {first_file.file_name}")
            else:
                print(f"   ⚠️  No GLB files found")
        
        # Update design.model_file to point to primary file
        if primary_file or glb_files.first():
            primary = primary_file or glb_files.first()
            if not design.model_file or design.model_file.name != primary.file.name:
                design.model_file = primary.file.name
                design.original_file = primary.file.name
                design.original_file_format = 'GLB'
                design.is_active = True
                design.save()
                print(f"   ✅ Updated design.model_file")
        
        print(f"   💡 GLB files ready for preview")

if __name__ == '__main__':
    try:
        ensure_primary_glb_files()
        print("\n" + "="*60)
        print("✅ Preview GLB files configured")
        print("="*60)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


"""
Script to add multiple GLB files to the same ChimneyDesign
This will add 5 additional GLB files to uv_compensating_main_assembly_5_sec design
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

from django.core.files import File
from django.conf import settings
from django.db.models import Max
from api.models import ChimneyDesign, DesignGLBFile
from api.admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING
import shutil
import uuid

def add_multiple_glb_to_design(model_type: str, num_files: int = 5):
    """
    Add multiple GLB files to the same design
    
    Args:
        model_type: The model type to add files to
        num_files: Number of additional GLB files to add (default: 5)
    """
    print("=" * 60)
    print("Add Multiple GLB Files to Design")
    print("=" * 60)
    print(f"Model Type: {model_type}")
    print(f"Number of files to add: {num_files}")
    print()
    
    # Get design
    design = get_design_by_model_type(model_type)
    if not design:
        print(f"❌ Design not found for model_type: {model_type}")
        return False
    
    print(f"✅ Found design: {design.title} (ID: {design.id})")
    
    # Find the source GLB file
    source_glb_path = None
    source_file_name = None
    
    # First, try to get from existing DesignGLBFile
    existing_glb_file = DesignGLBFile.objects.filter(design=design, file_type='model').first()
    if existing_glb_file:
        if hasattr(existing_glb_file.file, 'path'):
            source_glb_path = existing_glb_file.file.path
        elif hasattr(existing_glb_file.file, 'name'):
            source_glb_path = os.path.join(settings.MEDIA_ROOT, existing_glb_file.file.name)
        else:
            source_glb_path = os.path.join(settings.MEDIA_ROOT, str(existing_glb_file.file))
        source_file_name = existing_glb_file.file_name or os.path.basename(source_glb_path)
        print(f"✅ Found source GLB from DesignGLBFile: {source_file_name}")
    
    # If not found, try from design.model_file
    if not source_glb_path or not os.path.exists(source_glb_path):
        if design.model_file:
            if hasattr(design.model_file, 'path'):
                source_glb_path = design.model_file.path
            elif hasattr(design.model_file, 'name'):
                source_glb_path = os.path.join(settings.MEDIA_ROOT, design.model_file.name)
            else:
                source_glb_path = os.path.join(settings.MEDIA_ROOT, str(design.model_file))
            source_file_name = os.path.basename(source_glb_path)
            print(f"✅ Found source GLB from model_file: {source_file_name}")
    
    # If still not found, try from design.original_file
    if not source_glb_path or not os.path.exists(source_glb_path):
        if design.original_file:
            if hasattr(design.original_file, 'path'):
                source_glb_path = design.original_file.path
            elif hasattr(design.original_file, 'name'):
                source_glb_path = os.path.join(settings.MEDIA_ROOT, design.original_file.name)
            else:
                source_glb_path = os.path.join(settings.MEDIA_ROOT, str(design.original_file))
            source_file_name = os.path.basename(source_glb_path)
            print(f"✅ Found source GLB from original_file: {source_file_name}")
    
    if not source_glb_path or not os.path.exists(source_glb_path):
        print(f"❌ GLB file not found for design")
        print(f"   Checked paths:")
        if existing_glb_file:
            print(f"   - DesignGLBFile: {source_glb_path}")
        if design.model_file:
            print(f"   - model_file: {design.model_file}")
        if design.original_file:
            print(f"   - original_file: {design.original_file}")
        return False
    
    print(f"✅ Source GLB file found: {source_glb_path}")
    print(f"   File size: {os.path.getsize(source_glb_path) / (1024*1024):.2f} MB")
    print()
    
    # Get the highest order number for this design
    max_order = DesignGLBFile.objects.filter(design=design).aggregate(
        max_order=Max('order')
    )['max_order'] or 0
    
    print(f"📊 Current GLB files in design: {DesignGLBFile.objects.filter(design=design).count()}")
    print(f"📊 Max order number: {max_order}")
    print()
    
    success_count = 0
    failed_count = 0
    
    # Add multiple copies
    for i in range(1, num_files + 1):
        try:
            # Generate unique filename
            file_ext = os.path.splitext(source_file_name)[1] or '.glb'
            unique_filename = f"{uuid.uuid4()}_{model_type}_copy_{i}{file_ext}"
            
            # Copy file to models/ directory
            target_path = os.path.join(settings.MEDIA_ROOT, 'models', unique_filename)
            shutil.copy2(source_glb_path, target_path)
            
            # Create relative path
            relative_path = f'models/{unique_filename}'
            
            # Create DesignGLBFile record
            glb_file = DesignGLBFile.objects.create(
                design=design,
                file=relative_path,
                file_type='model',
                file_name=f"{source_file_name} (Copy {i})",
                is_primary=False,  # Only the first file should be primary
                order=max_order + i
            )
            
            print(f"✅ Added GLB file {i}/{num_files}")
            print(f"   File: {relative_path}")
            print(f"   DesignGLBFile ID: {glb_file.id}")
            print(f"   Order: {glb_file.order}")
            success_count += 1
            
        except Exception as e:
            print(f"❌ Error adding file {i}/{num_files}: {str(e)}")
            import traceback
            traceback.print_exc()
            failed_count += 1
    
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"✅ Successfully added: {success_count} GLB files")
    print(f"❌ Failed: {failed_count} GLB files")
    print(f"📊 Total GLB files in design now: {DesignGLBFile.objects.filter(design=design).count()}")
    
    return success_count > 0

if __name__ == '__main__':
    # Add 5 GLB files to uv_compensating_main_assembly_5_sec
    model_type = 'uv_compensating_main_assembly_5_sec'
    num_files = 5
    
    print("\n" + "=" * 60)
    print("Add Multiple GLB Files Script")
    print("=" * 60)
    print(f"\nThis will add {num_files} GLB files to '{model_type}' design.")
    print(f"Design: {MODEL_TYPE_MAPPING.get(model_type, 'Unknown')}")
    print("\n" + "=" * 60)
    
    try:
        result = add_multiple_glb_to_design(model_type, num_files)
        if result:
            print("\n✅ Files added successfully!")
            print("\n💡 All GLB files will now appear in:")
            print("   - Backend admin: /admin/api/designglbfile/")
            print("   - Frontend preview page: /preview")
            print("   - API endpoint: /api/get-all-model-types/")
            sys.exit(0)
        else:
            print("\n❌ Failed to add files!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


"""
Script to duplicate a GLB file to multiple model types
This will copy the GLB file to 7 additional model types (8 total)
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
from api.models import ChimneyDesign, DesignGLBFile
from api.admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING, ensure_model_type_designs
import shutil
import uuid

def duplicate_glb_to_model_types(source_model_type: str, target_model_types: list):
    """
    Duplicate a GLB file from one model type to multiple other model types
    
    Args:
        source_model_type: The model type that has the GLB file
        target_model_types: List of model types to copy the GLB file to
    """
    print("=" * 60)
    print("Duplicating GLB File to Multiple Model Types")
    print("=" * 60)
    print(f"Source Model Type: {source_model_type}")
    print(f"Target Model Types: {target_model_types}")
    print()
    
    # Get source design
    source_design = get_design_by_model_type(source_model_type)
    if not source_design:
        print(f"❌ Source design not found for model_type: {source_model_type}")
        return False
    
    # Get the GLB file path
    glb_file_path = None
    if source_design.model_file:
        if hasattr(source_design.model_file, 'path'):
            glb_file_path = source_design.model_file.path
        elif hasattr(source_design.model_file, 'name'):
            glb_file_path = os.path.join(settings.MEDIA_ROOT, source_design.model_file.name)
        else:
            glb_file_path = os.path.join(settings.MEDIA_ROOT, str(source_design.model_file))
    
    if not glb_file_path or not os.path.exists(glb_file_path):
        print(f"❌ GLB file not found for source design")
        print(f"   Expected path: {glb_file_path}")
        return False
    
    print(f"✅ Source GLB file found: {glb_file_path}")
    print(f"   File size: {os.path.getsize(glb_file_path) / (1024*1024):.2f} MB")
    print()
    
    # Ensure all model types exist
    ensure_model_type_designs()
    
    success_count = 0
    failed_count = 0
    
    # Copy to each target model type
    for target_model_type in target_model_types:
        if target_model_type not in MODEL_TYPE_MAPPING:
            print(f"⚠️  Skipping invalid model_type: {target_model_type}")
            failed_count += 1
            continue
        
        try:
            # Get or create target design
            target_design = get_design_by_model_type(target_model_type)
            if not target_design:
                title = MODEL_TYPE_MAPPING.get(target_model_type)
                target_design = ChimneyDesign.objects.create(
                    title=title,
                    description=f"3D model for {title} (model_type: {target_model_type})",
                    is_active=True
                )
                print(f"✅ Created design for {target_model_type} (ID: {target_design.id})")
            
            # Copy the GLB file
            original_filename = os.path.basename(glb_file_path)
            # Generate unique filename to avoid conflicts
            file_ext = os.path.splitext(original_filename)[1]
            unique_filename = f"{uuid.uuid4()}_{target_model_type}{file_ext}"
            
            # Copy file to models/ directory
            target_path = os.path.join(settings.MEDIA_ROOT, 'models', unique_filename)
            shutil.copy2(glb_file_path, target_path)
            
            # Save to model_file field
            relative_path = f'models/{unique_filename}'
            target_design.model_file = relative_path
            target_design.original_file = relative_path
            target_design.original_file_format = 'GLB'
            target_design.is_active = True
            target_design.save()
            
            # Also create DesignGLBFile record
            from django.db.models import Max
            max_order = DesignGLBFile.objects.filter(design=target_design).aggregate(
                max_order=Max('order')
            )['max_order'] or 0
            
            DesignGLBFile.objects.create(
                design=target_design,
                file=relative_path,
                file_type='model',
                file_name=original_filename,
                is_primary=True,
                order=max_order + 1
            )
            
            print(f"✅ Copied GLB to {target_model_type} ({MODEL_TYPE_MAPPING.get(target_model_type)})")
            print(f"   File: {relative_path}")
            print(f"   Design ID: {target_design.id}")
            success_count += 1
            
        except Exception as e:
            print(f"❌ Error copying to {target_model_type}: {str(e)}")
            import traceback
            traceback.print_exc()
            failed_count += 1
    
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"✅ Successfully copied: {success_count} model types")
    print(f"❌ Failed: {failed_count} model types")
    print(f"📊 Total: {success_count + failed_count} model types")
    
    return success_count > 0

if __name__ == '__main__':
    from django.db.models import Max
    
    # Example: Duplicate UV_COMPENSATING_MAIN_ASSEMBLY_5_sec to 7 other model types
    source = 'uv_compensating_main_assembly_5_sec'
    
    # You can modify these target model types as needed
    targets = [
        'wmss_single_skin_1_sec',
        'wmss_single_skin_2_secs',
        'wmss_single_skin_5_secs',
        'wmch_compensating_main_assembly_2_sec',
        'wmch_compensating_1_sec',
        'uv_compensating_main_assembly_2_sec',
        'uv_compensating_single_section_1_sec',
    ]
    
    print("\n" + "=" * 60)
    print("GLB File Duplication Script")
    print("=" * 60)
    print(f"\nThis will copy the GLB file from '{source}' to {len(targets)} other model types.")
    print("\nTarget model types:")
    for i, target in enumerate(targets, 1):
        print(f"  {i}. {target} - {MODEL_TYPE_MAPPING.get(target, 'Unknown')}")
    
    print("\n" + "=" * 60)
    
    try:
        result = duplicate_glb_to_model_types(source, targets)
        if result:
            print("\n✅ Duplication completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Duplication failed!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


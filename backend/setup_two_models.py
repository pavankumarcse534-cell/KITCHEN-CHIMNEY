"""
Script to ensure both model types have GLB files and appear in preview:
1. WMSS SINGLE SKIN 1 SEC (wmss_single_skin_1_sec)
2. ONE COLLAR SINGLE SKIN (one_collar_single_skin)
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

from django.db.models import Max
from api.models import ChimneyDesign, DesignGLBFile
from api.admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING, ensure_model_type_designs
from django.conf import settings

def migrate_legacy_glb_file(design: ChimneyDesign):
    """Migrate legacy model_file to DesignGLBFile record"""
    if not design.model_file:
        return False
    
    # Check if DesignGLBFile already exists
    existing = DesignGLBFile.objects.filter(design=design, file_type='model').first()
    if existing:
        print(f"   ✅ DesignGLBFile already exists (ID: {existing.id})")
        return True
    
    try:
        # Get file path
        file_path = None
        if hasattr(design.model_file, 'name'):
            file_path = design.model_file.name
        elif isinstance(design.model_file, str):
            file_path = design.model_file
        
        if not file_path:
            return False
        
        # Verify file exists
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        if not os.path.exists(full_path):
            print(f"   ⚠️  File not found: {full_path}")
            return False
        
        # Get max order
        max_order = DesignGLBFile.objects.filter(design=design).aggregate(
            max_order=Max('order')
        )['max_order'] or 0
        
        # Create DesignGLBFile record
        glb_file = DesignGLBFile.objects.create(
            design=design,
            file=file_path,
            file_type='model',
            file_name=os.path.basename(file_path),
            is_primary=True,
            order=max_order + 1
        )
        
        print(f"   ✅ Created DesignGLBFile (ID: {glb_file.id})")
        print(f"      File: {file_path}")
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*60)
    print("Setup Two Model Types for Preview")
    print("="*60)
    print("\nModel Types:")
    print("  1. WMSS SINGLE SKIN 1 SEC (wmss_single_skin_1_sec)")
    print("  2. ONE COLLAR SINGLE SKIN (one_collar_single_skin)")
    print()
    
    # Ensure all model types exist
    ensure_model_type_designs()
    
    model_types = [
        'wmss_single_skin_1_sec',
        'one_collar_single_skin',
    ]
    
    success_count = 0
    
    for model_type in model_types:
        title = MODEL_TYPE_MAPPING.get(model_type, model_type)
        print(f"\n📦 Processing: {title}")
        print("-" * 60)
        
        design = get_design_by_model_type(model_type)
        if not design:
            print(f"   ⚠️  Design not found, creating...")
            design = ChimneyDesign.objects.create(
                title=title,
                description=f"3D model for {title} (model_type: {model_type})",
                is_active=True
            )
            print(f"   ✅ Created design (ID: {design.id})")
        else:
            print(f"   ✅ Design exists (ID: {design.id})")
            design.is_active = True
            design.save()
        
        # Migrate legacy GLB file if exists
        if design.model_file:
            if migrate_legacy_glb_file(design):
                success_count += 1
        else:
            # Check if DesignGLBFile exists
            glb_files = DesignGLBFile.objects.filter(design=design, file_type='model')
            if glb_files.exists():
                print(f"   ✅ {glb_files.count()} GLB file(s) already exist")
                success_count += 1
            else:
                print(f"   ⚠️  No GLB file found")
                print(f"   💡 Upload GLB file using:")
                print(f"      python upload_glb_simple.py {model_type} <path_to_glb_file>")
    
    print("\n" + "="*60)
    print("Summary")
    print("="*60)
    print(f"✅ Processed: {len(model_types)} model types")
    print(f"✅ With GLB files: {success_count}")
    print()
    print("💡 Next Steps:")
    print("   1. Check frontend preview: http://localhost:3000/preview")
    print("   2. Both models should appear if they have GLB files")
    print("   3. Check API: http://localhost:8000/api/get-all-model-types/")
    print("="*60)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


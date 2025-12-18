"""
Script to delete WMSS SINGLE SKIN 1 SEC and ONE COLLAR HOLE SINGLE SKIN from backend
This will delete the ChimneyDesign records and associated DesignGLBFile records
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
from api.admin_helpers import get_design_by_model_type

def delete_model_types():
    """Delete WMSS SINGLE SKIN 1 SEC and ONE COLLAR HOLE SINGLE SKIN"""
    print("="*60)
    print("Delete Model Types")
    print("="*60)
    print()
    
    model_types = [
        'wmss_single_skin_1_sec',
        'one_collar_hole_single_skin',
    ]
    
    for model_type in model_types:
        print(f"\n🗑️  Processing: {model_type}")
        print("-" * 60)
        
        design = get_design_by_model_type(model_type)
        if not design:
            print(f"   ⚠️  Design not found - already deleted or doesn't exist")
            continue
        
        print(f"   📊 Found design: {design.title} (ID: {design.id})")
        
        # Delete associated DesignGLBFile records
        glb_files = DesignGLBFile.objects.filter(design=design)
        glb_count = glb_files.count()
        if glb_count > 0:
            print(f"   🗑️  Deleting {glb_count} GLB file record(s)...")
            glb_files.delete()
            print(f"   ✅ Deleted {glb_count} GLB file record(s)")
        
        # Delete the design
        design_id = design.id
        design_title = design.title
        design.delete()
        print(f"   ✅ Deleted design: {design_title} (ID: {design_id})")
    
    print("\n" + "="*60)
    print("✅ Model types deleted successfully")
    print("="*60)

if __name__ == '__main__':
    try:
        # Check if running non-interactively (from batch script)
        import sys
        if len(sys.argv) > 1 and sys.argv[1] == '--yes':
            # Non-interactive mode
            delete_model_types()
        else:
            # Interactive mode
            confirm = input("\n⚠️  WARNING: This will permanently delete WMSS SINGLE SKIN 1 SEC and ONE COLLAR HOLE SINGLE SKIN.\n   Type 'yes' to confirm: ")
            if confirm.lower() != 'yes':
                print("❌ Deletion cancelled")
                sys.exit(0)
            
            delete_model_types()
    except EOFError:
        # Non-interactive mode (piped input)
        print("\n⚠️  Running in non-interactive mode...")
        delete_model_types()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


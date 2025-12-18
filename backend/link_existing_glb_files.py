"""
Script to link existing GLB files to model types
This will find GLB files in media/models and link them to the correct model types
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
from django.core.files.storage import default_storage
from django.db.models import Max
from api.models import ChimneyDesign, DesignGLBFile
from api.admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING, ensure_model_type_designs
from django.conf import settings

def find_and_link_glb_files():
    """Find GLB files and link them to model types"""
    print("="*60)
    print("Link Existing GLB Files to Model Types")
    print("="*60)
    print()
    
    # Ensure designs exist
    ensure_model_type_designs()
    
    model_types = {
        'wmss_single_skin_1_sec': ['wmss', 'single', 'skin', '1', 'sec'],
        'one_collar_hole_single_skin': ['1', 'collar', 'hole', 'single', 'skin'],  # Updated: files use "1_collar" not "one_collar"
    }
    
    # Find all GLB files
    media_models_dir = os.path.join(settings.MEDIA_ROOT, 'models')
    if not os.path.exists(media_models_dir):
        print(f"❌ Media models directory not found: {media_models_dir}")
        return
    
    glb_files = []
    for root, dirs, files in os.walk(media_models_dir):
        for file in files:
            if file.lower().endswith('.glb'):
                glb_files.append(os.path.join(root, file))
    
    print(f"📦 Found {len(glb_files)} GLB file(s) in media/models")
    print()
    
    success_count = 0
    
    for model_type, keywords in model_types.items():
        title = MODEL_TYPE_MAPPING.get(model_type)
        print(f"\n🔍 Searching for: {title}")
        print("-" * 60)
        
        # Find matching GLB files
        matching_files = []
        for glb_file in glb_files:
            file_lower = os.path.basename(glb_file).lower()
            if all(keyword.lower() in file_lower for keyword in keywords):
                matching_files.append(glb_file)
        
        if not matching_files:
            print(f"   ⚠️  No matching GLB files found")
            print(f"   💡 Looking for files containing: {', '.join(keywords)}")
            continue
        
        # Get or create design
        design = get_design_by_model_type(model_type)
        if not design:
            design = ChimneyDesign.objects.create(
                title=title,
                description=f"3D model for {title} (model_type: {model_type})",
                is_active=True
            )
            print(f"   ✅ Created design (ID: {design.id})")
        else:
            print(f"   ✅ Found design (ID: {design.id})")
        
        # Check existing DesignGLBFile records
        existing_files = DesignGLBFile.objects.filter(design=design, file_type='model')
        existing_paths = {str(f.file.name) for f in existing_files}
        
        # Link matching files
        for glb_file in matching_files:
            # Get relative path from MEDIA_ROOT
            relative_path = os.path.relpath(glb_file, settings.MEDIA_ROOT).replace('\\', '/')
            
            # Skip if already linked
            if relative_path in existing_paths:
                print(f"   ⏭️  Already linked: {os.path.basename(glb_file)}")
                continue
            
            try:
                # Get max order
                max_order = DesignGLBFile.objects.filter(design=design).aggregate(
                    max_order=Max('order')
                )['max_order'] or 0
                
                # Check if primary exists
                existing_primary = DesignGLBFile.objects.filter(design=design, is_primary=True, file_type='model').first()
                is_primary = not existing_primary
                
                # Create DesignGLBFile record
                glb_file_record = DesignGLBFile.objects.create(
                    design=design,
                    file=relative_path,
                    file_type='model',
                    file_name=os.path.basename(glb_file),
                    is_primary=is_primary,
                    order=max_order + 1
                )
                
                # Update design.model_file if this is the first file
                if not design.model_file:
                    design.model_file = relative_path
                    design.original_file = relative_path
                    design.original_file_format = 'GLB'
                    design.is_active = True
                    design.save()
                
                print(f"   ✅ Linked: {os.path.basename(glb_file)}")
                print(f"      DesignGLBFile ID: {glb_file_record.id}")
                print(f"      Is Primary: {is_primary}")
                success_count += 1
                
            except Exception as e:
                print(f"   ❌ Error linking {os.path.basename(glb_file)}: {str(e)}")
    
    print("\n" + "="*60)
    print("Summary")
    print("="*60)
    print(f"✅ Successfully linked: {success_count} GLB file(s)")
    print()
    print("💡 Next Steps:")
    print("   1. Check frontend: http://localhost:3000/")
    print("   2. Select combined model type from dropdown")
    print("   3. GLB files should now appear in 3D viewer")
    print("="*60)

if __name__ == '__main__':
    try:
        find_and_link_glb_files()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


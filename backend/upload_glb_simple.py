"""
Simple script to upload GLB files for specific model types
Usage: python upload_glb_simple.py <model_type> <glb_file_path> [image_file_path]
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
import uuid

def upload_glb_file(model_type: str, glb_file_path: str, image_file_path: str = None):
    """Upload GLB file and optionally an image file to a model type"""
    
    if model_type not in MODEL_TYPE_MAPPING:
        print(f"❌ Invalid model_type: {model_type}")
        print(f"   Available model types: {', '.join(MODEL_TYPE_MAPPING.keys())}")
        return False
    
    if not os.path.exists(glb_file_path):
        print(f"❌ GLB file not found: {glb_file_path}")
        return False
    
    # Ensure designs exist
    ensure_model_type_designs()
    
    try:
        # Get or create design
        design = get_design_by_model_type(model_type)
        if not design:
            title = MODEL_TYPE_MAPPING.get(model_type)
            design = ChimneyDesign.objects.create(
                title=title,
                description=f"3D model for {title} (model_type: {model_type})",
                is_active=True
            )
            print(f"✅ Created design: {title} (ID: {design.id})")
        else:
            print(f"✅ Found design: {design.title} (ID: {design.id})")
        
        # Upload GLB file
        original_filename = os.path.basename(glb_file_path)
        file_ext = os.path.splitext(original_filename)[1] or '.glb'
        unique_filename = f"{uuid.uuid4()}_{model_type}{file_ext}"
        
        with open(glb_file_path, 'rb') as source_file:
            file_path = default_storage.save(f'models/{unique_filename}', File(source_file))
        
        # Get max order
        max_order = DesignGLBFile.objects.filter(design=design).aggregate(
            max_order=Max('order')
        )['max_order'] or 0
        
        # Check if primary exists
        existing_primary = DesignGLBFile.objects.filter(design=design, is_primary=True, file_type='model').first()
        is_primary = not existing_primary
        
        # Create DesignGLBFile record
        glb_file = DesignGLBFile.objects.create(
            design=design,
            file=file_path,
            file_type='model',
            file_name=original_filename,
            is_primary=is_primary,
            order=max_order + 1
        )
        
        # Update design
        if not design.model_file:
            design.model_file = file_path
            design.original_file = file_path
            design.original_file_format = 'GLB'
        design.is_active = True
        design.save()
        
        print(f"✅ Uploaded GLB file: {original_filename}")
        print(f"   DesignGLBFile ID: {glb_file.id}")
        print(f"   Is Primary: {is_primary}")
        
        # Upload image if provided
        if image_file_path and os.path.exists(image_file_path):
            image_ext = os.path.splitext(image_file_path)[1] or '.png'
            image_filename = f"{uuid.uuid4()}_{model_type}{image_ext}"
            
            with open(image_file_path, 'rb') as source_file:
                image_path = default_storage.save(f'thumbnails/{image_filename}', File(source_file))
            
            design.thumbnail = image_path
            design.save()
            
            print(f"✅ Uploaded image: {os.path.basename(image_file_path)}")
        
        print(f"\n💡 Model is now available in:")
        print(f"   - Frontend preview: http://localhost:3000/preview")
        print(f"   - API endpoint: http://localhost:8000/api/get-all-model-types/")
        print(f"   - Backend admin: http://localhost:8000/admin/api/chimneydesign/{design.id}/")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python upload_glb_simple.py <model_type> <glb_file_path> [image_file_path]")
        print()
        print("Example:")
        print("  python upload_glb_simple.py wmss_single_skin_1_sec \"C:\\Users\\YourName\\Downloads\\WMSS.glb\"")
        print("  python upload_glb_simple.py one_collar_hole_single_skin \"C:\\Users\\YourName\\Downloads\\COLLAR.glb\"")
        print()
        print("💡 TIP: Use actual file paths, not placeholders like 'C:\\path\\to\\file.glb'")
        print()
        print("Available model types:")
        for mt, title in MODEL_TYPE_MAPPING.items():
            print(f"  - {mt}: {title}")
        sys.exit(1)
    
    model_type = sys.argv[1]
    glb_file_path = sys.argv[2]
    image_file_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Check if path is a placeholder
    if 'path\\to' in glb_file_path.lower() or 'path/to' in glb_file_path.lower():
        print("❌ Error: The file path appears to be a placeholder!")
        print(f"   Provided path: {glb_file_path}")
        print()
        print("💡 Please provide the actual path to your GLB file.")
        print("   Example:")
        print(f'   python upload_glb_simple.py {model_type} "C:\\Users\\DELL PC\\Downloads\\WMSS.glb"')
        print()
        print("🔍 Searching for GLB files in common locations...")
        
        # Search for GLB files
        search_paths = [
            os.path.expanduser("~/Downloads"),
            os.path.expanduser("~/Desktop"),
            "C:\\Users\\DELL PC\\Downloads",
            "C:\\Users\\DELL PC\\Desktop",
            ".",
            ".."
        ]
        
        found_files = []
        for search_path in search_paths:
            if os.path.exists(search_path):
                try:
                    for root, dirs, files in os.walk(search_path):
                        for file in files:
                            if file.lower().endswith('.glb'):
                                full_path = os.path.join(root, file)
                                found_files.append(full_path)
                                if len(found_files) >= 10:  # Limit to 10 files
                                    break
                        if len(found_files) >= 10:
                            break
                except:
                    pass
        
        if found_files:
            print(f"\n✅ Found {len(found_files)} GLB file(s):")
            for i, file_path in enumerate(found_files[:10], 1):
                print(f"   {i}. {file_path}")
            print("\n💡 Use one of these paths or provide your own file path.")
        else:
            print("\n⚠️  No GLB files found in common locations.")
            print("   Please provide the full path to your GLB file.")
        
        sys.exit(1)
    
    success = upload_glb_file(model_type, glb_file_path, image_file_path)
    sys.exit(0 if success else 1)


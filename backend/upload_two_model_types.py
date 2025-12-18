"""
Script to upload GLB files for two model types:
1. WMSS SINGLE SKIN 1 SEC (wmss_single_skin_1_sec)
2. ONE COLLAR SINGLE SKIN (one_collar_single_skin)

This script will:
- Create designs if they don't exist
- Upload GLB files from a specified directory
- Create DesignGLBFile records
- Ensure they appear in the frontend preview
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
from django.conf import settings
from django.db.models import Max
from api.models import ChimneyDesign, DesignGLBFile
from api.admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING, ensure_model_type_designs
import uuid

def upload_glb_to_model_type(model_type: str, glb_file_path: str, is_primary: bool = True):
    """
    Upload a GLB file to a specific model type
    
    Args:
        model_type: The model type to upload to
        glb_file_path: Path to the GLB file to upload
        is_primary: Whether this should be the primary file
    """
    if not os.path.exists(glb_file_path):
        print(f"❌ GLB file not found: {glb_file_path}")
        return False
    
    try:
        # Get or create design
        design = get_design_by_model_type(model_type)
        if not design:
            title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
            design = ChimneyDesign.objects.create(
                title=title,
                description=f"3D model for {title} (model_type: {model_type})",
                is_active=True
            )
            print(f"✅ Created design for {model_type} (ID: {design.id})")
        else:
            print(f"✅ Found existing design for {model_type} (ID: {design.id})")
        
        # Generate unique filename
        original_filename = os.path.basename(glb_file_path)
        file_ext = os.path.splitext(original_filename)[1] or '.glb'
        unique_filename = f"{uuid.uuid4()}_{model_type}{file_ext}"
        
        # Copy file to models/ directory
        with open(glb_file_path, 'rb') as source_file:
            file_path = default_storage.save(f'models/{unique_filename}', File(source_file))
        
        relative_path = file_path
        
        # Get the highest order number for this design
        max_order = DesignGLBFile.objects.filter(design=design).aggregate(
            max_order=Max('order')
        )['max_order'] or 0
        
        # Check if there's already a primary file
        existing_primary = DesignGLBFile.objects.filter(design=design, is_primary=True, file_type='model').first()
        if existing_primary and is_primary:
            is_primary = False
            print(f"⚠️  Primary file already exists, setting this as secondary")
        
        # Create DesignGLBFile record
        glb_file = DesignGLBFile.objects.create(
            design=design,
            file=relative_path,
            file_type='model',
            file_name=original_filename,
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
        
        print(f"✅ Uploaded GLB file: {original_filename}")
        print(f"   Saved as: {relative_path}")
        print(f"   DesignGLBFile ID: {glb_file.id}")
        print(f"   Is Primary: {is_primary}")
        print(f"   Order: {glb_file.order}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error uploading GLB file: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def upload_image_to_model_type(model_type: str, image_file_path: str, is_thumbnail: bool = True):
    """
    Upload an image file (preview/thumbnail) to a specific model type
    
    Args:
        model_type: The model type to upload to
        image_file_path: Path to the image file to upload
        is_thumbnail: Whether this is a thumbnail (True) or preview (False)
    """
    if not os.path.exists(image_file_path):
        print(f"❌ Image file not found: {image_file_path}")
        return False
    
    try:
        # Get or create design
        design = get_design_by_model_type(model_type)
        if not design:
            title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
            design = ChimneyDesign.objects.create(
                title=title,
                description=f"3D model for {title} (model_type: {model_type})",
                is_active=True
            )
            print(f"✅ Created design for {model_type} (ID: {design.id})")
        
        # Generate unique filename
        original_filename = os.path.basename(image_file_path)
        file_ext = os.path.splitext(original_filename)[1] or '.png'
        unique_filename = f"{uuid.uuid4()}_{model_type}{file_ext}"
        
        # Determine upload directory
        upload_dir = 'thumbnails' if is_thumbnail else 'images'
        
        # Copy file
        with open(image_file_path, 'rb') as source_file:
            file_path = default_storage.save(f'{upload_dir}/{unique_filename}', File(source_file))
        
        # Update design thumbnail
        if is_thumbnail:
            design.thumbnail = file_path
        design.is_active = True
        design.save()
        
        print(f"✅ Uploaded image file: {original_filename}")
        print(f"   Saved as: {file_path}")
        print(f"   Type: {'Thumbnail' if is_thumbnail else 'Preview'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error uploading image file: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function to upload GLB files for the two model types"""
    print("=" * 60)
    print("Upload GLB Files for Two Model Types")
    print("=" * 60)
    print()
    print("Model Types:")
    print("  1. WMSS SINGLE SKIN 1 SEC (wmss_single_skin_1_sec)")
    print("  2. ONE COLLAR SINGLE SKIN (one_collar_single_skin)")
    print()
    
    # Ensure designs exist
    ensure_model_type_designs()
    
    # Model types to process
    model_types = [
        ('wmss_single_skin_1_sec', 'WMSS SINGLE SKIN 1 SEC'),
        ('one_collar_single_skin', 'ONE COLLAR SINGLE SKIN'),
    ]
    
    print("=" * 60)
    print("Instructions:")
    print("=" * 60)
    print("1. Place your GLB files in a directory (e.g., 'glb_files/')")
    print("2. Name them:")
    print("   - WMSS_SINGLE_SKIN_1_SEC.glb (or similar)")
    print("   - ONE_COLLAR_SINGLE_SKIN.glb (or similar)")
    print("3. Optionally place preview images (PNG, JPG, SVG) in the same directory")
    print()
    
    # Ask for directory path
    glb_dir = input("Enter path to directory containing GLB files (or press Enter to skip file upload): ").strip()
    
    if not glb_dir:
        print("\n⚠️  No directory provided. Skipping file upload.")
        print("💡 You can upload files later via:")
        print("   - Backend admin: /admin/api/chimneydesign/")
        print("   - API endpoint: POST /api/upload-glb/")
        print("   - Frontend upload component")
        return
    
    if not os.path.exists(glb_dir):
        print(f"❌ Directory not found: {glb_dir}")
        return
    
    print()
    print("=" * 60)
    print("Processing Files")
    print("=" * 60)
    print()
    
    success_count = 0
    failed_count = 0
    
    # Process each model type
    for model_type, title in model_types:
        print(f"\n📦 Processing: {title} ({model_type})")
        print("-" * 60)
        
        # Look for GLB files
        glb_files = []
        image_files = []
        
        for file in os.listdir(glb_dir):
            file_path = os.path.join(glb_dir, file)
            if not os.path.isfile(file_path):
                continue
            
            file_lower = file.lower()
            
            # Check if it's a GLB file for this model type
            if file_lower.endswith(('.glb', '.gltf')):
                # Check if filename contains model type keywords
                model_keywords = {
                    'wmss_single_skin_1_sec': ['wmss', 'single', 'skin', '1', 'sec'],
                    'one_collar_single_skin': ['one', 'collar', 'single', 'skin'],
                }
                
                keywords = model_keywords.get(model_type, [])
                if any(keyword in file_lower for keyword in keywords):
                    glb_files.append(file_path)
            
            # Check if it's an image file
            elif file_lower.endswith(('.png', '.jpg', '.jpeg', '.svg', '.webp')):
                # Check if filename contains model type keywords
                model_keywords = {
                    'wmss_single_skin_1_sec': ['wmss', 'single', 'skin', '1', 'sec'],
                    'one_collar_single_skin': ['one', 'collar', 'single', 'skin'],
                }
                
                keywords = model_keywords.get(model_type, [])
                if any(keyword in file_lower for keyword in keywords):
                    image_files.append(file_path)
        
        # Upload GLB files
        if glb_files:
            print(f"   Found {len(glb_files)} GLB file(s):")
            for i, glb_file in enumerate(glb_files, 1):
                print(f"   {i}. {os.path.basename(glb_file)}")
                if upload_glb_to_model_type(model_type, glb_file, is_primary=(i == 1)):
                    success_count += 1
                else:
                    failed_count += 1
        else:
            print(f"   ⚠️  No GLB files found for {title}")
            print(f"   💡 You can upload manually later")
        
        # Upload image files
        if image_files:
            print(f"   Found {len(image_files)} image file(s):")
            for i, image_file in enumerate(image_files, 1):
                print(f"   {i}. {os.path.basename(image_file)}")
                if upload_image_to_model_type(model_type, image_file, is_thumbnail=True):
                    success_count += 1
                else:
                    failed_count += 1
    
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"✅ Successfully uploaded: {success_count} files")
    print(f"❌ Failed: {failed_count} files")
    print()
    print("💡 Next Steps:")
    print("   1. Check backend admin: http://localhost:8000/admin/api/chimneydesign/")
    print("   2. Check frontend preview: http://localhost:3000/preview")
    print("   3. Verify API endpoint: http://localhost:8000/api/get-all-model-types/")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


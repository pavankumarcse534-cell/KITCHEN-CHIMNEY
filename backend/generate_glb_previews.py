"""
Script to generate preview images from all GLB files in the original directory
This converts GLB files to PNG preview images that users can see
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.conf import settings
from api.utils import save_glb_preview_to_file
from api.models import ChimneyDesign
from api.admin_helpers import MODEL_TYPE_MAPPING, get_design_by_model_type
from django.core.files import File
import glob
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_previews_for_all_glb_files():
    """Generate preview images for all GLB files in models/original/"""
    original_dir = os.path.join(settings.MEDIA_ROOT, 'models', 'original')
    
    if not os.path.exists(original_dir):
        print(f"❌ Directory not found: {original_dir}")
        return
    
    # Find all GLB files
    glb_pattern = os.path.join(original_dir, '*.glb')
    glb_files = glob.glob(glb_pattern)
    
    if not glb_files:
        print(f"⚠️  No GLB files found in {original_dir}")
        return
    
    print(f"✅ Found {len(glb_files)} GLB files")
    print("")
    
    success_count = 0
    error_count = 0
    
    for glb_file in glb_files:
        glb_filename = os.path.basename(glb_file)
        print(f"Processing: {glb_filename}")
        
        try:
            # Generate preview image
            preview_path = save_glb_preview_to_file(glb_file)
            
            if preview_path and os.path.exists(preview_path):
                print(f"  ✅ Generated preview: {os.path.basename(preview_path)}")
                
                # Try to link to ChimneyDesign if possible
                # Extract model type from filename if possible
                glb_name_lower = glb_filename.lower()
                model_type = None
                
                # Try to match filename to model types
                if 'wmss' in glb_name_lower or 'single_skin' in glb_name_lower:
                    if '5secs' in glb_name_lower or 'plenum' in glb_name_lower:
                        model_type = 'wall_mounted_single_plenum'
                    else:
                        model_type = 'wall_mounted_skin'
                elif 'ds1' in glb_name_lower or 'double_skin' in glb_name_lower:
                    model_type = 'wall_mounted_double_skin'
                elif 'ds2' in glb_name_lower:
                    if 'uv' in glb_name_lower:
                        model_type = 'uv_compensating'
                    else:
                        model_type = 'wall_mounted_compensating'
                elif 'ds3' in glb_name_lower:
                    model_type = 'island_single_skin'
                elif 'ds4' in glb_name_lower:
                    model_type = 'island_double_skin'
                elif 'ds5' in glb_name_lower:
                    model_type = 'island_compensating'
                
                # Link preview to design if model_type found
                if model_type:
                    try:
                        design = get_design_by_model_type(model_type)
                        if design:
                            # Save preview as thumbnail
                            with open(preview_path, 'rb') as f:
                                preview_file = File(f, name=os.path.basename(preview_path))
                                if design.thumbnail:
                                    design.thumbnail.delete(save=False)
                                design.thumbnail.save(os.path.basename(preview_path), preview_file, save=False)
                                design.save()
                            print(f"  ✅ Linked preview to design: {design.title}")
                    except Exception as e:
                        logger.warning(f"  ⚠️  Could not link preview to design: {str(e)}")
                
                success_count += 1
            else:
                print(f"  ❌ Failed to generate preview")
                error_count += 1
                
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            error_count += 1
        
        print("")
    
    print("=" * 50)
    print(f"✅ Successfully generated: {success_count} preview images")
    if error_count > 0:
        print(f"❌ Errors: {error_count}")
    print("=" * 50)


if __name__ == '__main__':
    print("=" * 50)
    print("GLB to Preview Image Converter")
    print("=" * 50)
    print("")
    generate_previews_for_all_glb_files()


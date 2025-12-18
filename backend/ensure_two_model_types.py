"""
Script to ensure two model types have GLB files uploaded:
1. WMSS SINGLE SKIN 1 SEC (wmss_single_skin_1_sec)
2. ONE COLLAR (HOLE) SINGLE SKIN (one_collar_hole_single_skin)

This script will:
- Ensure designs exist for both model types
- Check if GLB files are uploaded
- Provide instructions if files need to be uploaded
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

def check_model_type_status(model_type: str):
    """Check if a model type has GLB files uploaded"""
    print(f"\n{'='*60}")
    print(f"Checking: {MODEL_TYPE_MAPPING.get(model_type, model_type)}")
    print(f"{'='*60}")
    
    # Ensure design exists
    ensure_model_type_designs()
    
    design = get_design_by_model_type(model_type)
    if not design:
        print(f"❌ Design not found for {model_type}")
        print(f"   Creating design...")
        title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
        design = ChimneyDesign.objects.create(
            title=title,
            description=f"3D model for {title} (model_type: {model_type})",
            is_active=True
        )
        print(f"✅ Created design: {title} (ID: {design.id})")
    else:
        print(f"✅ Design exists: {design.title} (ID: {design.id})")
        print(f"   Active: {design.is_active}")
    
    # Check for GLB files
    glb_files = DesignGLBFile.objects.filter(design=design, file_type='model')
    glb_count = glb_files.count()
    
    print(f"\n📦 GLB Files Status:")
    if glb_count > 0:
        print(f"   ✅ {glb_count} GLB file(s) found:")
        for i, glb_file in enumerate(glb_files, 1):
            print(f"      {i}. {glb_file.file_name or glb_file.file.name}")
            print(f"         Primary: {glb_file.is_primary}, Order: {glb_file.order}")
    else:
        print(f"   ⚠️  No GLB files found")
        print(f"   💡 Upload GLB file using:")
        print(f"      python upload_glb_simple.py {model_type} <path_to_glb_file>")
    
    # Check for thumbnail
    if design.thumbnail:
        print(f"\n🖼️  Thumbnail: ✅ Found")
    else:
        print(f"\n🖼️  Thumbnail: ⚠️  Not found")
        print(f"   💡 Upload thumbnail using:")
        print(f"      python upload_glb_simple.py {model_type} <path_to_glb_file> <path_to_image>")
    
    # Check model_file field (backward compatibility)
    if design.model_file:
        print(f"\n📄 Model File (legacy): ✅ {design.model_file.name}")
    else:
        print(f"\n📄 Model File (legacy): ⚠️  Not set")
    
    return {
        'design': design,
        'glb_count': glb_count,
        'has_thumbnail': bool(design.thumbnail),
        'has_model_file': bool(design.model_file)
    }

def main():
    print("="*60)
    print("Ensure Two Model Types Have GLB Files")
    print("="*60)
    print("\nModel Types to Check:")
    print("  1. WMSS SINGLE SKIN 1 SEC (wmss_single_skin_1_sec)")
    print("  2. ONE COLLAR (HOLE) SINGLE SKIN (one_collar_hole_single_skin)")
    print()
    
    model_types = [
        'wmss_single_skin_1_sec',
        'one_collar_hole_single_skin',
    ]
    
    results = {}
    for model_type in model_types:
        results[model_type] = check_model_type_status(model_type)
    
    print("\n" + "="*60)
    print("Summary")
    print("="*60)
    
    all_ready = True
    for model_type in model_types:
        result = results[model_type]
        title = MODEL_TYPE_MAPPING.get(model_type)
        status = "✅ Ready" if result['glb_count'] > 0 else "⚠️  Needs GLB File"
        print(f"\n{title}:")
        print(f"  Status: {status}")
        print(f"  GLB Files: {result['glb_count']}")
        print(f"  Thumbnail: {'✅' if result['has_thumbnail'] else '⚠️'}")
        
        if result['glb_count'] == 0:
            all_ready = False
    
    print("\n" + "="*60)
    if all_ready:
        print("✅ Both model types are ready!")
        print("\n💡 Next Steps:")
        print("   1. Check frontend: http://localhost:3000/")
        print("   2. Check preview page: http://localhost:3000/preview")
        print("   3. Both models should appear in the dropdown and preview")
    else:
        print("⚠️  Some model types need GLB files uploaded")
        print("\n💡 To upload GLB files:")
        print("   python upload_glb_simple.py <model_type> <path_to_glb_file>")
        print("\n   Example:")
        print("   python upload_glb_simple.py wmss_single_skin_1_sec ./WMSS_1_SEC.glb")
        print("   python upload_glb_simple.py one_collar_hole_single_skin ./ONE_COLLAR_HOLE.glb")
    
    print("="*60)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


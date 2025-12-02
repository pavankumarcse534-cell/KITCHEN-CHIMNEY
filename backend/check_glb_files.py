"""
Script to check if GLB files are uploaded for all 8 model types
Run: python manage.py shell < check_glb_files.py
Or: python check_glb_files.py (if Django is configured)
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from api.models import ChimneyDesign
from django.core.files.storage import default_storage
from django.conf import settings

# Model type mapping
MODEL_TYPES = {
    'wall_mounted_skin': 'Wall Mounted Single Skin',
    'wall_mounted_single_plenum': 'Wall Mounted Single Plenum',
    'wall_mounted_double_skin': 'Wall-Mounted Double Skin',
    'wall_mounted_compensating': 'Wall-Mounted Compensating',
    'uv_compensating': 'UV Compensating',
    'island_single_skin': 'Island Single Skin',
    'island_double_skin': 'Island Double Skin',
    'island_compensating': 'Island Compensating',
}

print("=" * 60)
print("Checking GLB Files for All 8 Model Types")
print("=" * 60)
print()

missing_files = []
has_files = []

for model_type, title in MODEL_TYPES.items():
    design = ChimneyDesign.objects.filter(
        title__iexact=title
    ).filter(is_active=True).first()
    
    if design:
        if design.model_file:
            file_path = design.model_file.name
            full_path = default_storage.path(file_path) if hasattr(default_storage, 'path') else os.path.join(settings.MEDIA_ROOT, file_path)
            exists = os.path.exists(full_path) if os.path.exists(os.path.dirname(full_path)) else False
            
            if exists:
                file_size = os.path.getsize(full_path) / (1024 * 1024)  # MB
                print(f"✅ {title}")
                print(f"   Model Type: {model_type}")
                print(f"   File: {file_path}")
                print(f"   Size: {file_size:.2f} MB")
                print(f"   URL: {design.model_file.url if hasattr(design.model_file, 'url') else 'N/A'}")
                has_files.append((model_type, title, file_path))
            else:
                print(f"⚠️  {title}")
                print(f"   Model Type: {model_type}")
                print(f"   File path exists in DB but file not found: {file_path}")
                missing_files.append((model_type, title, "File not found on disk"))
        else:
            print(f"❌ {title}")
            print(f"   Model Type: {model_type}")
            print(f"   No GLB file uploaded")
            missing_files.append((model_type, title, "No file in database"))
    else:
        print(f"❌ {title}")
        print(f"   Model Type: {model_type}")
        print(f"   Design record does not exist")
        missing_files.append((model_type, title, "Design record missing"))
    print()

print("=" * 60)
print(f"Summary: {len(has_files)}/{len(MODEL_TYPES)} model types have GLB files")
print("=" * 60)

if missing_files:
    print("\nMissing Files:")
    for model_type, title, reason in missing_files:
        print(f"  - {title} ({model_type}): {reason}")
    print("\nTo upload files:")
    print("1. Go to Django Admin: http://localhost:8000/admin/api/chimneydesign/")
    print("2. Edit each model type")
    print("3. Upload GLB file to 'Model file' field")
    print("4. Save")
else:
    print("\n✅ All model types have GLB files uploaded!")


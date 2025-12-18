"""
Script to check if GLB files are uploaded for all model types
Run: python manage.py shell < check_glb_files.py
Or: python check_glb_files.py (if Django is configured)
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from api.models import ChimneyDesign
from api.admin_helpers import MODEL_TYPE_MAPPING, get_design_by_model_type
from django.core.files.storage import default_storage
from django.conf import settings

# Use MODEL_TYPE_MAPPING from admin_helpers
MODEL_TYPES = MODEL_TYPE_MAPPING
total_types = len(MODEL_TYPES)

print("=" * 60)
print(f"Checking GLB Files for All {total_types} Model Types")
print("=" * 60)
print()

missing_files = []
has_files = []

for model_type, title in MODEL_TYPES.items():
    design = get_design_by_model_type(model_type)
    
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


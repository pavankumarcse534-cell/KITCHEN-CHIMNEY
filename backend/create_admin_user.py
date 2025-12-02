"""
Script to create or update Django admin superuser
Usage: python manage.py shell < create_admin_user.py
Or run: python create_admin_user.py (after setting up Django environment)
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.contrib.auth.models import User

def create_or_update_admin(username='admin', password='admin123', email='admin@example.com'):
    """Create or update admin user"""
    try:
        user = User.objects.get(username=username)
        print(f"User '{username}' already exists. Updating password...")
        user.set_password(password)
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.save()
        print(f"✅ Updated admin user '{username}' successfully!")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n🔐 Login at: http://localhost:8000/admin/")
    except User.DoesNotExist:
        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password
        )
        print(f"✅ Created admin user '{username}' successfully!")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n🔐 Login at: http://localhost:8000/admin/")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        username = sys.argv[1]
        password = sys.argv[2] if len(sys.argv) > 2 else 'admin123'
        email = sys.argv[3] if len(sys.argv) > 3 else f'{username}@example.com'
        create_or_update_admin(username, password, email)
    else:
        # Default admin user
        create_or_update_admin()


"""
Django Admin Management Script
Provides commands to create, list, and manage admin users
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
django.setup()

from django.contrib.auth.models import User

def list_admin_users():
    """List all admin/superuser accounts"""
    admins = User.objects.filter(is_superuser=True)
    print("\n" + "="*60)
    print("ADMIN USERS")
    print("="*60)
    if admins.exists():
        for user in admins:
            print(f"\nUsername: {user.username}")
            print(f"Email: {user.email or '(not set)'}")
            print(f"Active: {'Yes' if user.is_active else 'No'}")
            print(f"Staff: {'Yes' if user.is_staff else 'No'}")
            print(f"Superuser: {'Yes' if user.is_superuser else 'No'}")
            print("-" * 60)
    else:
        print("\nNo admin users found!")
    print("\n" + "="*60)

def create_admin(username, password, email=None):
    """Create a new admin user"""
    if not email:
        email = f'{username}@example.com'
    
    try:
        user = User.objects.get(username=username)
        print(f"\n⚠️  User '{username}' already exists!")
        print("Use 'change_password' command to update password.")
        return False
    except User.DoesNotExist:
        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password
        )
        print(f"\n✅ Created admin user '{username}' successfully!")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        return True

def change_password(username, new_password):
    """Change password for an admin user"""
    try:
        user = User.objects.get(username=username)
        user.set_password(new_password)
        user.save()
        print(f"\n✅ Password changed successfully for user '{username}'!")
        return True
    except User.DoesNotExist:
        print(f"\n❌ User '{username}' not found!")
        return False

def main():
    """Main command handler"""
    if len(sys.argv) < 2:
        print("\nDjango Admin Management Tool")
        print("="*60)
        print("\nUsage:")
        print("  python manage_admin.py list                    - List all admin users")
        print("  python manage_admin.py create <username> <password> [email]")
        print("  python manage_admin.py change_password <username> <new_password>")
        print("\nExamples:")
        print("  python manage_admin.py list")
        print("  python manage_admin.py create admin admin123 admin@example.com")
        print("  python manage_admin.py change_password admin newpassword123")
        print("\n" + "="*60)
        return
    
    command = sys.argv[1].lower()
    
    if command == 'list':
        list_admin_users()
    elif command == 'create':
        if len(sys.argv) < 4:
            print("\n❌ Error: Username and password required")
            print("Usage: python manage_admin.py create <username> <password> [email]")
            return
        username = sys.argv[2]
        password = sys.argv[3]
        email = sys.argv[4] if len(sys.argv) > 4 else None
        create_admin(username, password, email)
    elif command == 'change_password':
        if len(sys.argv) < 4:
            print("\n❌ Error: Username and new password required")
            print("Usage: python manage_admin.py change_password <username> <new_password>")
            return
        username = sys.argv[2]
        new_password = sys.argv[3]
        change_password(username, new_password)
    else:
        print(f"\n❌ Unknown command: {command}")
        print("Use 'python manage_admin.py' for help")

if __name__ == '__main__':
    main()


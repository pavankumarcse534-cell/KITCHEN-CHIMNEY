"""
Setup script to initialize the database with sample data
Run this after migrations: python manage.py shell < setup.py
"""

from django.contrib.auth.models import User
from api.models import Category, ChimneyDesign

# Create sample categories
categories = [
    {'name': 'Traditional', 'description': 'Traditional chimney designs'},
    {'name': 'Modern', 'description': 'Modern and contemporary designs'},
    {'name': 'Rustic', 'description': 'Rustic and country-style chimneys'},
    {'name': 'Industrial', 'description': 'Industrial and minimalist designs'},
]

for cat_data in categories:
    category, created = Category.objects.get_or_create(
        name=cat_data['name'],
        defaults={'description': cat_data['description']}
    )
    if created:
        print(f"Created category: {category.name}")

# Create a sample admin user if it doesn't exist
if not User.objects.filter(username='admin').exists():
    admin_user = User.objects.create_superuser(
        username='admin',
        email='admin@example.com',
        password='admin123'
    )
    print(f"Created admin user: {admin_user.username}")
    print("Password: admin123 (change this in production!)")
else:
    print("Admin user already exists")

print("\nSetup complete!")
print("You can now:")
print("1. Run the server: python manage.py runserver")
print("2. Access admin at: http://localhost:8000/admin/")
print("3. Access API at: http://localhost:8000/api/")


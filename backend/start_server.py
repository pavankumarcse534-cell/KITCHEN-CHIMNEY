#!/usr/bin/env python
"""
Start Django development server with proper configuration
"""
import os
import sys
import django
from django.core.management import execute_from_command_line

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chimney_craft_backend.settings')
    django.setup()
    
    # Check if port 8000 is available
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', 8000))
    if result == 0:
        print("⚠️  WARNING: Port 8000 is already in use!")
        print("   Please stop the existing server or use a different port.")
        sys.exit(1)
    sock.close()
    
    print("=" * 60)
    print("Starting Django Backend Server")
    print("=" * 60)
    print("Backend URL: http://localhost:8000")
    print("API Health: http://localhost:8000/api/health/")
    print("Admin: http://localhost:8000/admin/")
    print("=" * 60)
    print()
    
    # Start server
    execute_from_command_line(['manage.py', 'runserver', '0.0.0.0:8000'])


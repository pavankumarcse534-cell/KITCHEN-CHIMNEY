#!/usr/bin/env python
"""
Check if backend server is running and CORS is configured correctly
"""
import requests
import sys

def check_server():
    """Check if server is responding"""
    try:
        print("Checking backend server...")
        response = requests.get('http://localhost:8000/api/health/', timeout=5)
        if response.status_code == 200:
            print("✅ Backend server is running!")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend server returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend server is NOT running!")
        print("   Please start the server: python manage.py runserver 0.0.0.0:8000")
        return False
    except Exception as e:
        print(f"❌ Error checking server: {e}")
        return False

def check_cors():
    """Check CORS headers"""
    try:
        print("\nChecking CORS configuration...")
        response = requests.options(
            'http://localhost:8000/api/health/',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
            },
            timeout=5
        )
        
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        }
        
        print(f"   CORS Headers:")
        for header, value in cors_headers.items():
            if value:
                print(f"   ✅ {header}: {value}")
            else:
                print(f"   ⚠️  {header}: Not set")
        
        if cors_headers['Access-Control-Allow-Origin']:
            print("\n✅ CORS is configured correctly!")
            return True
        else:
            print("\n⚠️  CORS headers may not be set correctly")
            return False
    except Exception as e:
        print(f"❌ Error checking CORS: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Backend Server & CORS Check")
    print("=" * 60)
    print()
    
    server_ok = check_server()
    cors_ok = check_cors() if server_ok else False
    
    print()
    print("=" * 60)
    if server_ok and cors_ok:
        print("✅ All checks passed!")
    else:
        print("⚠️  Some issues detected. Please fix them.")
    print("=" * 60)
    
    sys.exit(0 if (server_ok and cors_ok) else 1)


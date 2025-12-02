#!/usr/bin/env python3
"""
Test script for Model Type Integration
Tests the backend API endpoints for model type functionality
"""

import requests
import json
import sys
import os

# Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
TEST_MODEL_TYPES = [
    'wall_mounted_skin',
    'wall_mounted_single_plenum',
    'wall_mounted_double_skin',
    'wall_mounted_compensating',
    'uv_compensating',
    'island_single_skin',
    'island_double_skin',
    'island_compensating',
]

def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)

def print_success(text):
    """Print success message"""
    print(f"✅ {text}")

def print_error(text):
    """Print error message"""
    print(f"❌ {text}")

def print_info(text):
    """Print info message"""
    print(f"ℹ️  {text}")

def test_health_check():
    """Test if backend is running"""
    print_header("Testing Backend Health")
    try:
        response = requests.get(f"{API_BASE_URL}/api/health/", timeout=5)
        if response.status_code == 200:
            print_success("Backend is running and healthy")
            print(f"   Response: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            print_error(f"Backend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_error(f"Cannot connect to backend at {API_BASE_URL}")
        print_info("Make sure the backend server is running:")
        print_info("  cd backend && python manage.py runserver")
        return False
    except Exception as e:
        print_error(f"Error checking backend: {str(e)}")
        return False

def test_get_model_by_type(model_type):
    """Test getting model by type"""
    print_header(f"Testing GET Model by Type: {model_type}")
    try:
        url = f"{API_BASE_URL}/api/get-model-by-type/?model_type={model_type}"
        print_info(f"Request URL: {url}")
        
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"API responded successfully")
            print(f"\nResponse:")
            print(json.dumps(data, indent=2))
            
            if data.get('success'):
                if data.get('glb_url'):
                    print_success(f"GLB URL found: {data['glb_url']}")
                if data.get('image_url'):
                    print_success(f"Image URL found: {data['image_url']}")
                if not data.get('glb_url') and not data.get('image_url'):
                    print_info("No GLB or image found for this model type")
                    print_info("Upload a file with this model_type to test")
            else:
                print_info(f"Message: {data.get('message', 'No message')}")
            
            return True
        else:
            print_error(f"API returned status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Error testing get model by type: {str(e)}")
        return False

def test_upload_endpoints():
    """Test upload endpoints (without actual files)"""
    print_header("Testing Upload Endpoints Structure")
    
    # Test GLB upload endpoint (should return error without file)
    print_info("Testing POST /api/upload-glb/ (without file)")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/upload-glb/",
            data={'model_type': 'wall_mounted_skin'},
            timeout=5
        )
        if response.status_code == 400:
            data = response.json()
            if 'No file provided' in data.get('error', ''):
                print_success("GLB upload endpoint is accessible and validates input")
            else:
                print_info(f"Response: {json.dumps(data, indent=2)}")
        else:
            print_info(f"Unexpected status: {response.status_code}")
    except Exception as e:
        print_error(f"Error testing GLB upload: {str(e)}")
    
    # Test Image upload endpoint (should return error without file)
    print_info("Testing POST /api/upload-image/ (without file)")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/upload-image/",
            data={'model_type': 'wall_mounted_skin'},
            timeout=5
        )
        if response.status_code == 400:
            data = response.json()
            if 'No file provided' in data.get('error', ''):
                print_success("Image upload endpoint is accessible and validates input")
            else:
                print_info(f"Response: {json.dumps(data, indent=2)}")
        else:
            print_info(f"Unexpected status: {response.status_code}")
    except Exception as e:
        print_error(f"Error testing image upload: {str(e)}")

def main():
    """Main test function"""
    print_header("Model Type Integration Test Suite")
    print(f"Testing against: {API_BASE_URL}")
    print(f"To change API URL, set API_BASE_URL environment variable")
    
    # Test 1: Health check
    if not test_health_check():
        print("\n⚠️  Backend is not running. Please start it first.")
        sys.exit(1)
    
    # Test 2: Test upload endpoints structure
    test_upload_endpoints()
    
    # Test 3: Test getting models for each model type
    print_header("Testing All Model Types")
    results = {}
    for model_type in TEST_MODEL_TYPES:
        results[model_type] = test_get_model_by_type(model_type)
    
    # Summary
    print_header("Test Summary")
    total = len(TEST_MODEL_TYPES)
    passed = sum(1 for v in results.values() if v)
    
    print(f"Total model types tested: {total}")
    print(f"Successful API calls: {passed}")
    print(f"Failed API calls: {total - passed}")
    
    if passed == total:
        print_success("All API calls succeeded!")
    else:
        print_info("Some model types don't have associated files yet.")
        print_info("Upload files with model_type parameter to test full functionality.")
    
    print("\n" + "=" * 60)
    print("Next Steps:")
    print("1. Upload GLB/images with model_type parameter")
    print("2. Test selecting model types in frontend")
    print("3. Verify 3D models load automatically")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


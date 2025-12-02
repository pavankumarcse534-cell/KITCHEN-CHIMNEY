"""
Test script for GLB upload and STP conversion system
Run this after starting the Django backend server
"""
import os
import sys
import requests
import json
from pathlib import Path

API_BASE_URL = "http://localhost:8000/api"

def test_health_check():
    """Test if the backend server is running"""
    print("=" * 60)
    print("1. Testing Backend Health Check")
    print("=" * 60)
    try:
        response = requests.get(f"{API_BASE_URL}/health/", timeout=5)
        if response.status_code == 200:
            print("✓ Backend server is running")
            print(f"  Response: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            print(f"✗ Backend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to backend server")
        print("  Please start the backend server first:")
        print("  - Run: start-backend.ps1 (PowerShell)")
        print("  - Or: start-backend.bat (Command Prompt)")
        return False
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return False

def test_glb_upload(glb_file_path):
    """Test uploading a GLB file"""
    print("\n" + "=" * 60)
    print("2. Testing GLB File Upload")
    print("=" * 60)
    
    if not os.path.exists(glb_file_path):
        print(f"✗ GLB file not found: {glb_file_path}")
        return None
    
    file_size = os.path.getsize(glb_file_path)
    print(f"  File: {glb_file_path}")
    print(f"  Size: {file_size / 1024 / 1024:.2f} MB")
    
    try:
        with open(glb_file_path, 'rb') as f:
            files = {'file': (os.path.basename(glb_file_path), f, 'model/gltf-binary')}
            response = requests.post(
                f"{API_BASE_URL}/upload-glb/",
                files=files,
                timeout=300  # 5 minutes for large files
            )
        
        if response.status_code == 200:
            result = response.json()
            print("✓ GLB file uploaded successfully")
            print(f"  Original filename: {result.get('original_filename')}")
            print(f"  Saved as: {result.get('glb_file')}")
            print(f"  File URL: {result.get('glb_file_url')}")
            print(f"  File size: {result.get('file_size')} bytes")
            
            # Test if the file is accessible
            glb_url = result.get('glb_file_url')
            if not glb_url.startswith('http'):
                glb_url = f"http://localhost:8000{glb_url}"
            
            print(f"\n  Testing file accessibility: {glb_url}")
            file_response = requests.head(glb_url, timeout=10)
            if file_response.status_code == 200:
                print("✓ Uploaded file is accessible via URL")
            else:
                print(f"⚠ File URL returned status {file_response.status_code}")
            
            return result
        else:
            print(f"✗ Upload failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"  Error: {error_data.get('error', 'Unknown error')}")
                print(f"  Message: {error_data.get('message', 'No message')}")
            except:
                print(f"  Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"✗ Error during upload: {str(e)}")
        return None

def test_glb_file_access(glb_url):
    """Test if a GLB file is accessible"""
    print("\n" + "=" * 60)
    print("3. Testing GLB File Access")
    print("=" * 60)
    
    if not glb_url.startswith('http'):
        glb_url = f"http://localhost:8000{glb_url}"
    
    print(f"  URL: {glb_url}")
    
    try:
        response = requests.head(glb_url, timeout=10)
        if response.status_code == 200:
            print("✓ File is accessible")
            content_type = response.headers.get('Content-Type', 'unknown')
            content_length = response.headers.get('Content-Length', 'unknown')
            print(f"  Content-Type: {content_type}")
            print(f"  Content-Length: {content_length} bytes")
            return True
        else:
            print(f"✗ File access failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error accessing file: {str(e)}")
        return False

def test_stp_upload(stp_file_path):
    """Test uploading and converting an STP file"""
    print("\n" + "=" * 60)
    print("4. Testing STP to GLB Conversion")
    print("=" * 60)
    
    if not os.path.exists(stp_file_path):
        print(f"✗ STP file not found: {stp_file_path}")
        print("  Skipping STP conversion test")
        return None
    
    file_size = os.path.getsize(stp_file_path)
    print(f"  File: {stp_file_path}")
    print(f"  Size: {file_size / 1024 / 1024:.2f} MB")
    print("  Note: This may take several minutes for large files...")
    
    try:
        with open(stp_file_path, 'rb') as f:
            files = {'file': (os.path.basename(stp_file_path), f, 'application/octet-stream')}
            response = requests.post(
                f"{API_BASE_URL}/upload-stp/",
                files=files,
                timeout=600  # 10 minutes for conversion
            )
        
        if response.status_code == 200:
            result = response.json()
            print("✓ STP file converted successfully")
            print(f"  Original filename: {result.get('original_filename')}")
            print(f"  GLB file: {result.get('glb_file')}")
            print(f"  GLB URL: {result.get('glb_file_url')}")
            return result
        else:
            print(f"✗ Conversion failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"  Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"  Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"✗ Error during conversion: {str(e)}")
        return None

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("GLB Upload and STP Conversion System Test")
    print("=" * 60)
    print()
    
    # Test 1: Health check
    if not test_health_check():
        print("\n⚠ Backend server is not running. Please start it first.")
        sys.exit(1)
    
    # Test 2: GLB upload (use existing GLB file if available)
    glb_files = [
        "media/WMSS Single Skin.glb",
        "media/WMSS Single Skin_5Secs (2).glb",
    ]
    
    uploaded_result = None
    for glb_file in glb_files:
        if os.path.exists(glb_file):
            uploaded_result = test_glb_upload(glb_file)
            if uploaded_result:
                break
    
    if not uploaded_result:
        print("\n⚠ No GLB files found to test upload")
        print("  You can test manually by uploading a GLB file through the frontend")
    
    # Test 3: File access
    if uploaded_result:
        test_glb_file_access(uploaded_result.get('glb_file_url'))
    
    # Test 4: STP conversion (if STP file exists)
    stp_files = [
        "media/uploads/stp/*.stp",
        "media/uploads/stp/*.step",
    ]
    
    # Look for STP files
    stp_file = None
    for pattern in stp_files:
        import glob
        matches = glob.glob(pattern)
        if matches:
            stp_file = matches[0]
            break
    
    if stp_file:
        test_stp_upload(stp_file)
    else:
        print("\n⚠ No STP files found to test conversion")
        print("  Place a .stp or .step file in media/uploads/stp/ to test")
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print("✓ Backend server is running")
    if uploaded_result:
        print("✓ GLB upload test completed")
    print("\nTo test the 3D viewer:")
    print("1. Start the frontend: cd chimney-craft-3d-main && npm run dev")
    print("2. Open the GLB viewer page in your browser")
    print("3. Upload a GLB file or select an existing one")
    print("4. The 3D model should display automatically")
    print("=" * 60)

if __name__ == "__main__":
    main()


import os
import requests
import base64
import uuid
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class APSClient:
    """Autodesk Platform Services API client"""
    
    BASE_URL = "https://developer.api.autodesk.com"
    
    def __init__(self):
        self.client_id = os.getenv('APS_CLIENT_ID')
        self.client_secret = os.getenv('APS_CLIENT_SECRET')
        
        if not self.client_id or not self.client_secret:
            raise ValueError("APS_CLIENT_ID and APS_CLIENT_SECRET must be set in environment variables")
    
    def get_public_token(self) -> Dict:
        """
        Get a public read-only token for the frontend viewer.
        Scope: viewables:read
        """
        url = f"{self.BASE_URL}/authentication/v2/token"
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials',
            'scope': 'viewables:read'
        }
        
        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()
        return response.json()
    
    def get_internal_token(self) -> Dict:
        """
        Get an internal token with write access for uploads.
        Scope: bucket:create bucket:read data:create data:write data:read
        """
        url = f"{self.BASE_URL}/authentication/v2/token"
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials',
            'scope': 'bucket:create bucket:read data:create data:write data:read'
        }
        
        
        response = requests.post(url, headers=headers, data=data)
        
        # Log the response for debugging
        if response.status_code != 200:
            logger.error(f"APS token request failed: {response.status_code}")
            logger.error(f"Response body: {response.text}")
            
        response.raise_for_status()
        return response.json()
    
    def create_bucket(self, token: str, bucket_key: str) -> Dict:
        """
        Create a temporary bucket (30-day lifetime).
        """
        url = f"{self.BASE_URL}/oss/v2/buckets"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        data = {
            'bucketKey': bucket_key,
            'policyKey': 'temporary'  # 30-day lifetime (was 'transient' 24h)
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        # Bucket might already exist (409), which is fine
        if response.status_code == 409:
            return {'bucketKey': bucket_key, 'exists': True}
        
        response.raise_for_status()
        return response.json()
    
    def upload_file_s3(self, token: str, bucket_key: str, object_key: str, file_content: bytes) -> Dict:
        """
        Upload file using S3 signed upload (3-step process).
        CRITICAL: This is the correct way to upload, not legacy binary upload.
        """
        # Step 1: Get signed S3 upload URL
        url = f"{self.BASE_URL}/oss/v2/buckets/{bucket_key}/objects/{object_key}/signeds3upload"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        # Request signed URL
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        signed_data = response.json()
        
        upload_key = signed_data.get('uploadKey')
        urls = signed_data.get('urls', [])
        
        if not urls:
            raise ValueError("No upload URLs returned from APS")
        
        # Step 2: Upload file content to S3 URL
        s3_url = urls[0]  # Use first URL for single-part upload
        s3_response = requests.put(s3_url, data=file_content)
        s3_response.raise_for_status()
        
        # Get ETag from response
        etag = s3_response.headers.get('ETag', '').strip('"')
        
        # Step 3: Finalize the upload
        finalize_url = f"{self.BASE_URL}/oss/v2/buckets/{bucket_key}/objects/{object_key}/signeds3upload"
        finalize_headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        finalize_data = {
            'uploadKey': upload_key,
            'size': len(file_content),
            'eTags': [etag] if etag else []
        }
        
        finalize_response = requests.post(finalize_url, headers=finalize_headers, json=finalize_data)
        finalize_response.raise_for_status()
        
        return finalize_response.json()
    
    def translate_to_svf(self, token: str, urn: str) -> Dict:
        """
        Trigger Model Derivative translation job to SVF format.
        """
        url = f"{self.BASE_URL}/modelderivative/v2/designdata/job"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'x-ads-force': 'true'  # Force re-translation if needed
        }
        data = {
            'input': {
                'urn': urn
            },
            'output': {
                'formats': [
                    {
                        'type': 'svf',
                        'views': ['2d', '3d']
                    }
                ]
            }
        }
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    
    def get_translation_status(self, token: str, urn: str) -> Dict:
        """
        Get translation status and progress.
        Returns: { progress: 0-100, status: 'inprogress'|'success'|'failed', error: '' }
        """
        url = f"{self.BASE_URL}/modelderivative/v2/designdata/{urn}/manifest"
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        manifest = response.json()
        
        status = manifest.get('status', 'pending')
        progress = manifest.get('progress', '0%').replace('%', '').replace('complete', '100')
        
        try:
            progress_int = int(progress)
        except (ValueError, TypeError):
            progress_int = 0
        
        # Extract error messages if failed
        error_msg = ''
        if status == 'failed':
            derivatives = manifest.get('derivatives', [])
            for derivative in derivatives:
                messages = derivative.get('messages', [])
                for msg in messages:
                    if msg.get('type') == 'error':
                        error_msg += msg.get('message', '') + '; '
        
        return {
            'progress': progress_int,
            'status': status,
            'error': error_msg.strip('; ')
        }
    
    @staticmethod
    def encode_urn(object_id: str) -> str:
        """
        Encode object ID to URN format (base64 URL-safe).
        """
        urn = base64.urlsafe_b64encode(object_id.encode()).decode()
        return urn.rstrip('=')  # Remove padding
    
    @staticmethod
    def generate_bucket_key() -> str:
        """
        Generate a unique bucket key with app prefix.
        """
        return f"chimney-app-{uuid.uuid4().hex[:16]}"
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to be URL-safe.
        """
        # Remove special characters, keep alphanumeric, dots, hyphens, underscores
        import re
        safe_name = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        # Add timestamp to ensure uniqueness
        timestamp = uuid.uuid4().hex[:8]
        name, ext = os.path.splitext(safe_name)
        return f"{name}_{timestamp}{ext}"

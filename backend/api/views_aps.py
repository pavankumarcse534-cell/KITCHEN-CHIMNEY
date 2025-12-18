from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.files.uploadedfile import UploadedFile
from .aps_utils import APSClient
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
def get_aps_token(request):
    """
    Get a public read-only token for the Autodesk Viewer.
    Scope: viewables:read
    """
    try:
        client = APSClient()
        token_data = client.get_public_token()
        
        return Response({
            'access_token': token_data.get('access_token'),
            'expires_in': token_data.get('expires_in'),
            'token_type': token_data.get('token_type', 'Bearer')
        })
    
    except ValueError as e:
        logger.error(f"APS configuration error: {str(e)}")
        return Response(
            {'error': 'APS credentials not configured. Please set APS_CLIENT_ID and APS_CLIENT_SECRET.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    except Exception as e:
        logger.error(f"Error getting APS token: {str(e)}")
        return Response(
            {'error': f'Failed to get APS token: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def upload_cad_file(request):
    """
    Upload a CAD file, create bucket, upload to S3, and trigger translation.
    Returns the URN for the frontend to use.
    """
    try:
        # Validate file
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file: UploadedFile = request.FILES['file']
        
        # File size validation (max 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        if uploaded_file.size > max_size:
            return Response(
                {'error': f'File too large. Maximum size is {max_size / (1024*1024)}MB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # File type validation
        allowed_extensions = ['.step', '.stp', '.sldprt', '.iges', '.igs', '.dwg', '.ipt', '.iam', '.f3d']
        file_ext = uploaded_file.name.lower().split('.')[-1]
        if f'.{file_ext}' not in allowed_extensions:
            return Response(
                {'error': f'Unsupported file type. Allowed: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Initialize APS client
        client = APSClient()
        
        # Get internal token with write access
        logger.info("Getting internal APS token...")
        token_data = client.get_internal_token()
        access_token = token_data.get('access_token')
        
        # Generate unique bucket key
        bucket_key = APSClient.generate_bucket_key()
        logger.info(f"Creating bucket: {bucket_key}")
        
        # Create transient bucket (24h lifetime)
        client.create_bucket(access_token, bucket_key)
        
        # Sanitize filename
        safe_filename = APSClient.sanitize_filename(uploaded_file.name)
        logger.info(f"Uploading file: {safe_filename}")
        
        # Read file content
        file_content = uploaded_file.read()
        
        # Upload using S3 signed upload (3-step process)
        upload_result = client.upload_file_s3(
            access_token,
            bucket_key,
            safe_filename,
            file_content
        )
        
        # Get object ID and encode to URN
        object_id = upload_result.get('objectId')
        if not object_id:
            raise ValueError("No objectId returned from upload")
        
        urn = APSClient.encode_urn(object_id)
        logger.info(f"File uploaded successfully. URN: {urn}")
        
        # Trigger translation to SVF
        logger.info("Triggering translation to SVF...")
        translation_result = client.translate_to_svf(access_token, urn)
        
        return Response({
            'urn': urn,
            'bucket_key': bucket_key,
            'object_key': safe_filename,
            'translation_status': translation_result.get('result', 'pending')
        })
    
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    except Exception as e:
        logger.error(f"Error uploading CAD file: {str(e)}")
        return Response(
            {'error': f'Upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_translation_status(request, urn):
    """
    Get translation status for a given URN.
    Returns progress (0-100), status, and error messages if any.
    """
    try:
        client = APSClient()
        
        # Get internal token
        token_data = client.get_internal_token()
        access_token = token_data.get('access_token')
        
        # Get translation status
        status_data = client.get_translation_status(access_token, urn)
        
        return Response(status_data)
    
    except Exception as e:
        logger.error(f"Error getting translation status: {str(e)}")
        return Response(
            {
                'progress': 0,
                'status': 'failed',
                'error': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

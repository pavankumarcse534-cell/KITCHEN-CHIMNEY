from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
import uuid
import re
import logging

logger = logging.getLogger(__name__)

from ..models import Category, ChimneyDesign, UserProject, Order, ContactMessage
from ..serializers import (
    UserSerializer, UserRegistrationSerializer, CategorySerializer,
    ChimneyDesignSerializer, ChimneyDesignListSerializer,
    UserProjectSerializer, OrderSerializer, ContactMessageSerializer
)
from ..admin_helpers import MODEL_TYPE_MAPPING, get_design_by_model_type
# Note: convert_glb_to_dwg function not yet implemented in utils.py
# Will be added when DWG conversion is fully implemented


def normalize_url(url):
    """
    Normalize URL to use localhost instead of 0.0.0.0 for browser compatibility.
    0.0.0.0 is valid for server binding but not for browser access.
    """
    if not url:
        return url
    # Replace 0.0.0.0 with localhost in URLs
    url = url.replace('http://0.0.0.0:', 'http://localhost:')
    url = url.replace('https://0.0.0.0:', 'https://localhost:')
    # Also replace 127.0.0.1 with localhost for consistency (optional, but cleaner)
    # url = url.replace('http://127.0.0.1:', 'http://localhost:')
    return url


def build_browser_accessible_uri(request, relative_url):
    """
    Build absolute URI and normalize it to be browser-accessible.
    Ensures URLs use localhost instead of 0.0.0.0.
    """
    if not relative_url:
        return None
    absolute_url = request.build_absolute_uri(relative_url)
    return normalize_url(absolute_url)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_all_model_types(request):
    """Get all 8 model types with their preview images and GLB URLs"""
    try:
        model_types_list = []
        
        # Hardcoded GLB file paths (relative to MEDIA_ROOT) - check multiple possible locations
        # Also check for uploaded files with unique IDs and all files in original/ directory
        HARDCODED_GLB_PATHS = {
            'wall_mounted_skin': [
                'models/WMSS_Single_Skin.glb', 
                'models/original/WMSS_Single_Skin.glb',
                # Check for uploaded files matching pattern
                'models/WMSS_Single_Skin_*.glb',
                # Check all files in original/ directory
                'models/original/WMSS_Single_Skin*.glb',
                'models/original/*.glb',  # Fallback: any GLB in original/
            ],
            'wall_mounted_single_plenum': [
                'models/original/WMSS_Single_Skin_5Secs_1_sVZ4uVd.glb', 
                'models/WMSS_Single_Skin_5Secs_1_sVZ4uVd.glb',
                'models/original/WMSS_Single_Skin_5Secs*.glb',
                'models/original/*.glb',
            ],
            'wall_mounted_double_skin': [
                'models/GA___Drawing_DS1__Date_201023041524.glb', 
                'models/original/GA___Drawing_DS1__Date_201023041524.glb',
                'models/original/GA___Drawing_DS1*.glb',
                'models/original/*.glb',
            ],
            'wall_mounted_compensating': [
                'models/GA___Drawing_DS2__Date_201023041758.glb', 
                'models/original/GA___Drawing_DS2__Date_201023041758.glb',
                'models/original/GA___Drawing_DS2*.glb',
                'models/original/*.glb',
            ],
            'uv_compensating': [
                'models/GA___Drawing_DS2__Date_201023041758.glb', 
                'models/original/GA___Drawing_DS2__Date_201023041758.glb',
                'models/original/GA___Drawing_DS2*.glb',
                'models/original/*.glb',
            ],
            'island_single_skin': [
                'models/GA___Drawing_DS3__Date_201023042051.glb', 
                'models/original/GA___Drawing_DS3__Date_201023042051.glb',
                'models/original/GA___Drawing_DS3*.glb',
                'models/original/*.glb',
            ],
            'island_double_skin': [
                'models/GA___Drawing_DS4__Date_201023042629.glb', 
                'models/original/GA___Drawing_DS4__Date_201023042629.glb',
                'models/original/GA___Drawing_DS4*.glb',
                'models/original/*.glb',
            ],
            'island_compensating': [
                'models/GA___Drawing_DS5__Date_201023043026.glb', 
                'models/original/GA___Drawing_DS5__Date_201023043026.glb',
                'models/original/GA___Drawing_DS5*.glb',
                'models/original/*.glb',
            ],
        }
        
        for model_type, title in MODEL_TYPE_MAPPING.items():
            design = get_design_by_model_type(model_type)
            
            # Get GLB URL
            glb_url = None
            if design and design.model_file:
                try:
                    relative_url = None
                    file_name = None
                    
                    # Get file name first
                    if hasattr(design.model_file, 'name') and design.model_file.name:
                        file_name = design.model_file.name
                    elif isinstance(design.model_file, str):
                        file_name = design.model_file
                    
                    # Method 1: Use FileField.url property (most reliable)
                    if hasattr(design.model_file, 'url') and design.model_file.url:
                        relative_url = design.model_file.url
                        logger.info(f'Method 1 - Using FileField.url: {relative_url}')
                    # Method 2: Use storage.url with file name
                    elif file_name:
                        try:
                            relative_url = default_storage.url(file_name)
                            logger.info(f'Method 2 - Using storage.url: {relative_url}')
                        except Exception as storage_error:
                            logger.warning(f'storage.url failed: {storage_error}, trying manual construction')
                            # Method 3: Manual construction from file name
                            if file_name:
                                if not file_name.startswith('/media/'):
                                    if not file_name.startswith('/'):
                                        relative_url = '/media/' + file_name
                                    else:
                                        relative_url = '/media' + file_name
                                else:
                                    relative_url = file_name
                                logger.info(f'Method 3 - Manual construction: {relative_url}')
                    
                    if relative_url:
                        # Ensure URL starts with /media/ if it's a media file
                        if not relative_url.startswith('/media/') and not relative_url.startswith('http'):
                            if not relative_url.startswith('/'):
                                relative_url = '/media/' + relative_url
                            elif not relative_url.startswith('/media/'):
                                if 'models/' in relative_url or 'uploads/' in relative_url:
                                    relative_url = '/media' + relative_url
                        
                        # Verify file actually exists before returning URL
                        if relative_url.startswith('/media/'):
                            file_path_from_url = relative_url.replace('/media/', '')
                            full_file_path = os.path.join(settings.MEDIA_ROOT, file_path_from_url)
                            if os.path.exists(full_file_path):
                                # Build absolute URL using request (normalized for browser access)
                                glb_url = build_browser_accessible_uri(request, relative_url)
                                logger.info(f'Final GLB URL for {model_type}: {glb_url}')
                            else:
                                logger.warning(f'GLB file does not exist on disk: {full_file_path}')
                                glb_url = None
                        else:
                            # Build absolute URL using request (normalized for browser access)
                            glb_url = build_browser_accessible_uri(request, relative_url)
                            logger.info(f'Final GLB URL for {model_type}: {glb_url}')
                    else:
                        logger.warning(f'Could not construct URL for {model_type}. File name: {file_name}')
                except Exception as e:
                    logger.warning(f'Error getting GLB URL for {model_type}: {str(e)}')
                    import traceback
                    logger.error(traceback.format_exc())
            
            # Use hardcoded URL if no GLB in database - try multiple locations
            if not glb_url and model_type in HARDCODED_GLB_PATHS:
                possible_paths = HARDCODED_GLB_PATHS[model_type]
                for relative_path in possible_paths:
                    # Handle wildcard patterns (e.g., WMSS_Single_Skin_*.glb)
                    if '*' in relative_path:
                        import glob
                        pattern = os.path.join(settings.MEDIA_ROOT, relative_path)
                        matching_files = glob.glob(pattern)
                        if matching_files:
                            # Use the first matching file
                            matching_file = matching_files[0]
                            # Get relative path from MEDIA_ROOT
                            rel_path = os.path.relpath(matching_file, settings.MEDIA_ROOT).replace('\\', '/')
                            media_url = f'/media/{rel_path}'
                            glb_url = build_browser_accessible_uri(request, media_url)
                            logger.info(f'Found matching GLB file for {model_type}: {glb_url} (file: {matching_file})')
                            break
                    else:
                        file_path = os.path.join(settings.MEDIA_ROOT, relative_path)
                        if os.path.exists(file_path):
                            # Build URL using request to ensure correct host/port (normalized for browser access)
                            media_url = f'/media/{relative_path}'
                            glb_url = build_browser_accessible_uri(request, media_url)
                            logger.info(f'Using hardcoded GLB file for {model_type}: {glb_url} (file exists at: {file_path})')
                            break
                if not glb_url:
                    logger.warning(f'Hardcoded GLB file not found for {model_type} in any of these locations: {possible_paths}')
            
            # Get preview image URL
            preview_url = None
            if design and design.thumbnail:
                try:
                    # Get thumbnail URL
                    if hasattr(design.thumbnail, 'url'):
                        thumbnail_relative_url = design.thumbnail.url
                    else:
                        thumbnail_relative_url = default_storage.url(design.thumbnail.name)
                    
                    # Ensure URL is properly formatted and file exists
                    if thumbnail_relative_url:
                        if not thumbnail_relative_url.startswith('http'):
                            if not thumbnail_relative_url.startswith('/'):
                                thumbnail_relative_url = '/' + thumbnail_relative_url
                            # Verify file exists before returning URL
                            if thumbnail_relative_url.startswith('/media/'):
                                file_path_from_url = thumbnail_relative_url.replace('/media/', '')
                                full_file_path = os.path.join(settings.MEDIA_ROOT, file_path_from_url)
                                if os.path.exists(full_file_path):
                                    preview_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                                    logger.info(f'Preview image URL for {model_type}: {preview_url}')
                                else:
                                    logger.warning(f'Preview image file does not exist on disk: {full_file_path}')
                                    preview_url = None
                            else:
                                preview_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                                logger.info(f'Preview image URL for {model_type}: {preview_url}')
                        else:
                            preview_url = thumbnail_relative_url
                            logger.info(f'Preview image URL for {model_type}: {preview_url}')
                except Exception as e:
                    logger.warning(f'Error getting preview URL for {model_type}: {str(e)}')
            
            # If no preview image in database, try to find generated preview from GLB
            if not preview_url and glb_url:
                try:
                    # Extract GLB file path from URL
                    glb_path = None
                    if '/media/' in glb_url:
                        # Extract relative path
                        media_part = glb_url.split('/media/')[-1]
                        glb_path = os.path.join(settings.MEDIA_ROOT, media_part)
                        
                        if os.path.exists(glb_path):
                            # Check if preview already exists (same directory, _preview.png suffix)
                            preview_path = os.path.splitext(glb_path)[0] + '_preview.png'
                            if os.path.exists(preview_path):
                                # Preview exists, use it
                                preview_relative = os.path.relpath(preview_path, settings.MEDIA_ROOT).replace('\\', '/')
                                preview_url = build_browser_accessible_uri(request, f'/media/{preview_relative}')
                                logger.info(f'Using existing preview image: {preview_url}')
                except Exception as e:
                    logger.warning(f'Error checking for preview image: {str(e)}')
            
            model_type_info = {
                'model_type': model_type,
                'title': MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title()),
                'glb_url': glb_url,
                'preview_url': preview_url,
                'has_model': bool(glb_url),
                'has_preview': bool(preview_url),
            }
            
            model_types_list.append(model_type_info)
        
        return Response({
            'success': True,
            'model_types': model_types_list
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f'Error getting all model types: {str(e)}')
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {'error': f'Server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ViewSets
class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Category model"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class ChimneyDesignViewSet(viewsets.ModelViewSet):
    """ViewSet for ChimneyDesign model"""
    queryset = ChimneyDesign.objects.filter(is_active=True)
    permission_classes = [permissions.AllowAny]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ChimneyDesignListSerializer
        return ChimneyDesignSerializer


class UserProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for UserProject model"""
    serializer_class = UserProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return projects for the current user"""
        return UserProject.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Set the user when creating a project"""
        serializer.save(user=self.request.user)


class OrderViewSet(viewsets.ModelViewSet):
    """ViewSet for Order model"""
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return orders for the current user"""
        return Order.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Set the user when creating an order"""
        serializer.save(user=self.request.user)


class ContactMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for ContactMessage model"""
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]


# Authentication views
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """User registration"""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    """User login"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'Username and password required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    if user:
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })
    return Response(
        {'error': 'Invalid credentials'}, 
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    """User logout"""
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'message': 'Successfully logged out'})


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def profile(request):
    """Get or update user profile"""
    if request.method == 'GET':
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    elif request.method == 'PUT':
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Utility views
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def stats(request):
    """Get statistics"""
    user = request.user
    stats_data = {
        'projects_count': UserProject.objects.filter(user=user).count(),
        'orders_count': Order.objects.filter(user=user).count(),
        'designs_count': ChimneyDesign.objects.filter(is_active=True).count(),
    }
    return Response(stats_data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """Health check endpoint"""
    return Response({'status': 'ok', 'message': 'Server is running'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def upload_glb(request):
    """Upload GLB file and associate with model type"""
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    if not (file.name.lower().endswith('.glb') or file.name.lower().endswith('.gltf')):
        return Response(
            {'error': 'File must be a GLB or GLTF file'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get model_type from form data or query params
    model_type = request.POST.get('model_type') or request.query_params.get('model_type')
    
    try:
        # Generate unique filename
        filename = f"{uuid.uuid4()}_{file.name}"
        # Save to models/ directory (main location for GLB files)
        file_path = default_storage.save(f'models/{filename}', file)
        logger.info(f'GLB file saved to: {file_path}')
        
        # If model_type is provided, associate with ChimneyDesign
        design = None
        if model_type:
            from ..admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING
            design = get_design_by_model_type(model_type)
            if not design:
                # Create design if it doesn't exist
                title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
                design = ChimneyDesign.objects.create(
                    title=title,
                    description=f"3D model for {title} (model_type: {model_type})",
                    is_active=True,
                    created_by=request.user if request.user.is_authenticated else None
                )
                logger.info(f'Created new design for model_type: {model_type} (ID: {design.id})')
            
            # Update the design with the new GLB file
            # For GLB files, both model_file and original_file point to the same file
            # model_file is used by frontend for 3D viewer
            # original_file is kept for reference/backup
            design.model_file = file_path
            design.original_file = file_path  # Same file for GLB format
            design.original_file_format = 'GLB'
            design.save()
            logger.info(f'Associated GLB file with model_type: {model_type} (Design ID: {design.id})')
            logger.info(f'Model file path: {file_path}')
            logger.info(f'Original file path: {file_path}')
        
        # Build absolute URL (normalized for browser access)
        file_url = default_storage.url(file_path)
        if not file_url.startswith('http'):
            file_url = build_browser_accessible_uri(request, file_url)
        
        logger.info(f'GLB URL: {file_url}')
        
        return Response({
            'success': True,
            'file_path': file_path,
            'url': file_url,
            'glb_file_url': file_url,
            'design_title': design.title if design else None,
            'model_type': model_type
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f'Error uploading GLB: {str(e)}')
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def upload_image(request):
    """Upload image file (thumbnail or preview) and associate with model type"""
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    if not any(file.name.lower().endswith(ext) for ext in allowed_extensions):
        return Response(
            {'error': 'File must be an image'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get model_type from form data or query params
    model_type = request.POST.get('model_type') or request.query_params.get('model_type')
    # Check if this is a thumbnail upload (default) or regular image
    is_thumbnail = request.POST.get('is_thumbnail', 'true').lower() == 'true'
    
    try:
        # Save to thumbnails/ if it's a thumbnail, images/ otherwise
        folder = 'thumbnails' if is_thumbnail else 'images'
        filename = f"{uuid.uuid4()}_{file.name}"
        file_path = default_storage.save(f'{folder}/{filename}', file)
        
        # If model_type is provided and it's a thumbnail, associate with ChimneyDesign
        design = None
        if model_type and is_thumbnail:
            from ..admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING
            design = get_design_by_model_type(model_type)
            if not design:
                # Create design if it doesn't exist
                title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
                design = ChimneyDesign.objects.create(
                    title=title,
                    description=f"3D model for {title} (model_type: {model_type})",
                    is_active=True,
                    created_by=request.user if request.user.is_authenticated else None
                )
            
            # Update the design with the new thumbnail
            design.thumbnail = file_path
            design.save()
            logger.info(f'Associated thumbnail with model_type: {model_type} (Design ID: {design.id})')
        
        # Build absolute URL (normalized for browser access)
        file_url = default_storage.url(file_path)
        if not file_url.startswith('http'):
            file_url = build_browser_accessible_uri(request, file_url)
        
        return Response({
            'success': True,
            'file_path': file_path,
            'url': file_url,
            'image_file_url': file_url,
            'thumbnail_url': file_url if is_thumbnail else None,
            'design_title': design.title if design else None,
            'model_type': model_type
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f'Error uploading image: {str(e)}')
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def upload_3d_object(request):
    """Upload 3D object file (STP/STEP/DWG) and associate with model type"""
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    # Only allow STP/STEP and GLB/GLTF formats (no PNG, SVG, or other formats)
    allowed_extensions = ['.glb', '.gltf', '.stp', '.step']
    file_ext = None
    for ext in allowed_extensions:
        if file.name.lower().endswith(ext):
            file_ext = ext
            break
    
    if not file_ext:
        return Response(
            {'error': 'File must be a GLB (.glb, .gltf) or STEP (.stp, .step) file. PNG and SVG formats are not supported.'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get model_type from form data or query params
    model_type = request.POST.get('model_type') or request.query_params.get('model_type')
    
    try:
        # Save original file
        filename = f"{uuid.uuid4()}_{file.name}"
        original_file_path = default_storage.save(f'models/original/{filename}', file)
        
        # For STP/STEP/DWG files, they will be converted to GLB later
        # For now, save the original and return
        # The conversion can happen asynchronously or via a separate endpoint
        
        # If model_type is provided, associate with ChimneyDesign
        design = None
        if model_type:
            from ..admin_helpers import get_design_by_model_type, MODEL_TYPE_MAPPING
            design = get_design_by_model_type(model_type)
            if not design:
                # Create design if it doesn't exist
                title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
                design = ChimneyDesign.objects.create(
                    title=title,
                    description=f"3D model for {title} (model_type: {model_type})",
                    is_active=True,
                    created_by=request.user if request.user.is_authenticated else None
                )
            
            # Store original file
            design.original_file = original_file_path
            design.original_file_format = file_ext.upper().replace('.', '')
            
            # If it's already a GLB, also set as model_file
            if file_ext in ['.glb', '.gltf']:
                design.model_file = original_file_path
            # For other formats, model_file will be set after conversion
            
            design.save()
            logger.info(f'Associated 3D object with model_type: {model_type} (Design ID: {design.id})')
        
        # Build absolute URL (normalized for browser access)
        file_url = default_storage.url(original_file_path)
        if not file_url.startswith('http'):
            file_url = build_browser_accessible_uri(request, file_url)
        
        return Response({
            'success': True,
            'file_path': original_file_path,
            'url': file_url,
            'glb_file_url': file_url if file_ext in ['.glb', '.gltf'] else None,
            'original_file_url': file_url,
            'file_format': file_ext.upper().replace('.', ''),
            'needs_conversion': file_ext not in ['.glb', '.gltf'],
            'design_title': design.title if design else None,
            'model_type': model_type
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f'Error uploading 3D object: {str(e)}')
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_model_by_type(request):
    """Get model by type - returns design with image_url and glb_url for frontend"""
    # Accept both 'type' and 'model_type' query parameters for compatibility
    model_type = request.query_params.get('type') or request.query_params.get('model_type')
    if not model_type:
        return Response(
            {'error': 'Model type parameter required (use ?type= or ?model_type=)'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    design = get_design_by_model_type(model_type)
    if not design:
        # Create design if it doesn't exist (so user can upload)
        from ..admin_helpers import MODEL_TYPE_MAPPING
        title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
        design = ChimneyDesign.objects.create(
            title=title,
            description=f"3D model for {title} (model_type: {model_type})",
            is_active=True
        )
        logger.info(f'Created design for model_type: {model_type} (ID: {design.id})')
    
    # Get base serializer data
    serializer = ChimneyDesignSerializer(design)
    response_data = serializer.data
    
    # Add image_url from thumbnail field for frontend compatibility
    image_url = None
    if design.thumbnail:
        try:
            if hasattr(design.thumbnail, 'url'):
                thumbnail_relative_url = design.thumbnail.url
            else:
                thumbnail_relative_url = default_storage.url(design.thumbnail.name)
            
            if thumbnail_relative_url:
                if not thumbnail_relative_url.startswith('http'):
                    if not thumbnail_relative_url.startswith('/'):
                        thumbnail_relative_url = '/' + thumbnail_relative_url
                    # Verify file exists before returning URL
                    if thumbnail_relative_url.startswith('/media/'):
                        file_path_from_url = thumbnail_relative_url.replace('/media/', '')
                        full_file_path = os.path.join(settings.MEDIA_ROOT, file_path_from_url)
                        if os.path.exists(full_file_path):
                            image_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                            logger.info(f'Image URL for {model_type}: {image_url}')
                        else:
                            logger.warning(f'Thumbnail file does not exist on disk: {full_file_path}')
                            image_url = None
                    else:
                        image_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                        logger.info(f'Image URL for {model_type}: {image_url}')
                else:
                    image_url = thumbnail_relative_url
                    logger.info(f'Image URL for {model_type}: {image_url}')
        except Exception as e:
            logger.warning(f'Error getting image URL for {model_type}: {str(e)}')
    
    # Add glb_url from model_file field for frontend compatibility
    glb_url = None
    if design.model_file:
        try:
            relative_url = None
            file_name = None
            
            # Get file name first
            if hasattr(design.model_file, 'name') and design.model_file.name:
                file_name = design.model_file.name
            elif isinstance(design.model_file, str):
                file_name = design.model_file
            
            logger.info(f'Getting GLB URL for {model_type}, file_name: {file_name}')
            
            # Method 1: Use FileField.url property (most reliable)
            if hasattr(design.model_file, 'url') and design.model_file.url:
                relative_url = design.model_file.url
                logger.info(f'Method 1 - Using FileField.url: {relative_url}')
            # Method 2: Use storage.url with file name
            elif file_name:
                try:
                    relative_url = default_storage.url(file_name)
                    logger.info(f'Method 2 - Using storage.url: {relative_url}')
                except Exception as storage_error:
                    logger.warning(f'storage.url failed: {storage_error}, trying manual construction')
                    # Method 3: Manual construction from file name
                    if file_name:
                        if not file_name.startswith('/media/'):
                            if not file_name.startswith('/'):
                                relative_url = '/media/' + file_name
                            else:
                                relative_url = '/media' + file_name
                        else:
                            relative_url = file_name
                        logger.info(f'Method 3 - Manual construction: {relative_url}')
            
            # If model_file URL construction failed, try original_file as fallback
            if not relative_url and design.original_file:
                try:
                    logger.info(f'Trying original_file as fallback for {model_type}')
                    if hasattr(design.original_file, 'url') and design.original_file.url:
                        relative_url = design.original_file.url
                        logger.info(f'Using original_file.url: {relative_url}')
                    elif hasattr(design.original_file, 'name'):
                        try:
                            relative_url = default_storage.url(design.original_file.name)
                            logger.info(f'Using original_file storage.url: {relative_url}')
                        except Exception as orig_error:
                            logger.warning(f'original_file storage.url failed: {orig_error}')
                except Exception as e:
                    logger.warning(f'Error getting original_file URL: {str(e)}')
            
            if relative_url:
                # Ensure URL starts with /media/ if it's a media file
                if not relative_url.startswith('/media/') and not relative_url.startswith('http'):
                    if not relative_url.startswith('/'):
                        relative_url = '/media/' + relative_url
                    elif not relative_url.startswith('/media/'):
                        if 'models/' in relative_url or 'uploads/' in relative_url:
                            relative_url = '/media' + relative_url
                
                # Verify file actually exists before returning URL
                try:
                    # Extract file path from relative URL
                    if relative_url.startswith('/media/'):
                        file_path_from_url = relative_url.replace('/media/', '')
                        full_file_path = os.path.join(settings.MEDIA_ROOT, file_path_from_url)
                        if os.path.exists(full_file_path):
                            # Build absolute URL using request (normalized for browser access)
                            glb_url = build_browser_accessible_uri(request, relative_url)
                            logger.info(f'Final GLB URL for {model_type}: {glb_url}')
                        else:
                            logger.warning(f'GLB file does not exist on disk: {full_file_path}')
                            logger.warning(f'File path in database: {file_name}, but file not found')
                            glb_url = None
                    else:
                        # If it's already an absolute URL, just use it (but still check if file exists)
                        glb_url = build_browser_accessible_uri(request, relative_url)
                        logger.info(f'Final GLB URL for {model_type}: {glb_url}')
                except Exception as file_check_error:
                    logger.warning(f'Error checking file existence for {model_type}: {str(file_check_error)}')
                    glb_url = None
            else:
                logger.warning(f'Could not construct URL for {model_type}. File name: {file_name}')
                logger.warning(f'Model file exists: {bool(design.model_file)}, Original file exists: {bool(design.original_file)}')
        except Exception as e:
            logger.warning(f'Error getting GLB URL for {model_type}: {str(e)}')
            import traceback
            logger.error(traceback.format_exc())
    
    # Add frontend-compatible fields
    response_data['image_url'] = image_url
    response_data['glb_url'] = glb_url
    response_data['success'] = True
    response_data['model_type'] = model_type
    response_data['title'] = design.title
    response_data['has_glb'] = bool(glb_url)
    response_data['has_thumbnail'] = bool(image_url)
    
    # If no GLB file, provide helpful message
    if not glb_url:
        response_data['message'] = f'No GLB file uploaded for {design.title}. Use the upload button to add a GLB file.'
    
    return Response(response_data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_all_models(request):
    """List all models"""
    designs = ChimneyDesign.objects.filter(is_active=True)
    serializer = ChimneyDesignListSerializer(designs, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_model_by_type(request):
    """Delete model by type"""
    model_type = request.query_params.get('type')
    if not model_type:
        return Response(
            {'error': 'Model type parameter required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    design = get_design_by_model_type(model_type)
    if not design:
        # Create design if it doesn't exist (so user can upload)
        from ..admin_helpers import MODEL_TYPE_MAPPING
        title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
        design = ChimneyDesign.objects.create(
            title=title,
            description=f"3D model for {title} (model_type: {model_type})",
            is_active=True
        )
        logger.info(f'Created design for model_type: {model_type} (ID: {design.id})')
    
    # Only allow deletion if user is staff or created the design
    if not (request.user.is_staff or design.created_by == request.user):
        return Response(
            {'error': 'Permission denied'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    design.delete()
    return Response({'message': f'Model type {model_type} deleted successfully'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def convert_glb_to_dwg_view(request):
    """
    Convert GLB file to DWG format.
    Note: This is a placeholder implementation. Full GLB to DWG conversion
    requires specialized CAD libraries and may not be fully implemented.
    """
    try:
        glb_url = request.data.get('glb_url')
        model_type = request.data.get('model_type', '')
        
        if not glb_url:
            return Response(
                {'error': 'glb_url parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # For now, return an error indicating conversion is not fully implemented
        # The frontend will handle this gracefully by downloading the GLB file instead
        return Response(
            {
                'error': 'GLB to DWG conversion is not yet fully implemented. Please download the GLB file and convert using CAD software.',
                'glb_url': glb_url,
                'message': 'DWG conversion requires specialized CAD libraries. Please use external conversion tools.'
            },
            status=status.HTTP_501_NOT_IMPLEMENTED
        )
        
    except Exception as e:
        logger.error(f'Error in convert_glb_to_dwg_view: {str(e)}')
        return Response(
            {'error': f'Conversion error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

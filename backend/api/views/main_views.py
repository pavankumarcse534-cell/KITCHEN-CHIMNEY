from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Q, Max
from django.db import connection
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone
import django
import os
import uuid
import re
import logging
from urllib.parse import unquote

logger = logging.getLogger(__name__)

from ..models import Category, ChimneyDesign, UserProject, Order, ContactMessage, DesignGLBFile
from ..serializers import (
    UserSerializer, UserRegistrationSerializer, CategorySerializer,
    ChimneyDesignSerializer, ChimneyDesignListSerializer,
    UserProjectSerializer, OrderSerializer, ContactMessageSerializer
)
from ..admin_helpers import MODEL_TYPE_MAPPING, get_design_by_model_type

# Helper to check if file is a 3D model
def is_model_file(filename):
    if not filename: return False
    ext = filename.lower().split('.')[-1]
    return ext in ['stp', 'step', 'glb', 'gltf']



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
    """Get all model types with their preview images and GLB URLs.
    This now relies only on database-stored files (no hardcoded fallback paths).
    Auto-creates missing model types to ensure all 17 types are available.
    """
    try:
        # Ensure all model types exist in database (auto-create missing ones)
        from ..admin_helpers import ensure_model_type_designs
        ensure_model_type_designs()
        
        model_types_list = []
        seen_model_types = set()  # Track model types to prevent duplicates
        
        for model_type, title in MODEL_TYPE_MAPPING.items():
            # Skip if already processed (prevent duplicates)
            if model_type in seen_model_types:
                continue
            seen_model_types.add(model_type)
            
            # Check if this is a combined model type
            combined_types = []
            if model_type == 'wmss_single_skin_1_sec_and_one_collar_hole_single_skin':
                # Note: one_collar_hole_single_skin was removed, so only fetch from wmss_single_skin_1_sec
                # Files can also be uploaded directly to the combined design
                combined_types = ['wmss_single_skin_1_sec']
            
            # Handle combined model types differently
            if combined_types:
                # For combined types, fetch files from component types
                all_glb_urls = []
                all_glb_files = []
                preview_url = None
                
                for component_type in combined_types:
                    component_design = get_design_by_model_type(component_type)
                    if component_design:
                        # Get GLB files from this component
                        component_glb_files = DesignGLBFile.objects.filter(design=component_design).order_by('order', '-created_at')
                        for glb_file in component_glb_files:
                            try:
                                file_url = None
                                file_name = None
                                
                                if hasattr(glb_file.file, 'name') and glb_file.file.name:
                                    file_name = glb_file.file.name
                                elif isinstance(glb_file.file, str):
                                    file_name = glb_file.file
                                
                                if file_name:
                                    if hasattr(glb_file.file, 'url') and glb_file.file.url:
                                        relative_url = glb_file.file.url
                                    else:
                                        try:
                                            relative_url = default_storage.url(file_name)
                                        except Exception:
                                            if not file_name.startswith('/media/'):
                                                relative_url = '/media/' + file_name if not file_name.startswith('/') else '/media' + file_name
                                            else:
                                                relative_url = file_name
                                    
                                    if relative_url:
                                        if not relative_url.startswith('http'):
                                            file_url = build_browser_accessible_uri(request, relative_url)
                                        else:
                                            file_url = relative_url
                                    
                                    if file_url:
                                        all_glb_urls.append(file_url)
                                        all_glb_files.append({
                                            'id': glb_file.id,
                                            'url': file_url,
                                            'file_path': file_name,
                                            'file_name': glb_file.file_name or file_name.split('/')[-1],
                                            'file_type': glb_file.file_type,
                                            'is_primary': glb_file.is_primary,
                                            'order': glb_file.order,
                                            'component_type': component_type
                                        })
                            except Exception as e:
                                logger.warning(f'Error getting URL for GLB file {glb_file.id} from {component_type}: {str(e)}')
                        
                        # Get preview image from first component that has one
                        if not preview_url and component_design.thumbnail:
                            try:
                                if hasattr(component_design.thumbnail, 'url'):
                                    thumbnail_relative_url = component_design.thumbnail.url
                                else:
                                    thumbnail_relative_url = default_storage.url(component_design.thumbnail.name)
                                
                                if thumbnail_relative_url:
                                    if not thumbnail_relative_url.startswith('http'):
                                        preview_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                                    else:
                                        preview_url = thumbnail_relative_url
                            except Exception as e:
                                logger.warning(f'Error getting preview URL for {component_type}: {str(e)}')
                
                # Create model type info for combined type
                model_type_info = {
                    'model_type': model_type,
                    'title': title,
                    'glb_url': all_glb_urls[0] if all_glb_urls else None,
                    'glb_files': all_glb_files,
                    'all_glb_urls': all_glb_urls,
                    'preview_url': preview_url,
                    'has_model': len(all_glb_urls) > 0,
                    'has_preview': bool(preview_url),
                    'is_combined': True,
                    'component_types': combined_types
                }
                
                model_types_list.append(model_type_info)
                continue  # Skip normal processing for combined types
            
            # Normal processing for non-combined model types
            design = get_design_by_model_type(model_type)
            
            # If still not found after ensure, log warning but continue
            if not design:
                logger.warning(f'⚠️ Model type {model_type} ({title}) not found even after ensure_model_type_designs')
                continue
            
            # Get GLB URL directly from model_file / original_file
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
                            # URL-decode the path to handle spaces and special characters
                            file_path_from_url = unquote(file_path_from_url)
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
            
            # Get preview image URL
            preview_url = None
            if design and design.thumbnail:
                try:
                    # Get thumbnail file name/path
                    thumbnail_file_name = None
                    if hasattr(design.thumbnail, 'name'):
                        thumbnail_file_name = design.thumbnail.name
                    elif isinstance(design.thumbnail, str):
                        thumbnail_file_name = design.thumbnail
                    
                    if thumbnail_file_name:
                        logger.info(f'Getting preview URL for {model_type}, thumbnail file: {thumbnail_file_name}')
                        
                        # Method 1: Use FileField.url property (most reliable)
                        thumbnail_relative_url = None
                        if hasattr(design.thumbnail, 'url') and design.thumbnail.url:
                            thumbnail_relative_url = design.thumbnail.url
                            logger.info(f'Method 1 - Using FileField.url: {thumbnail_relative_url}')
                        # Method 2: Use storage.url with file name
                        else:
                            try:
                                thumbnail_relative_url = default_storage.url(thumbnail_file_name)
                                logger.info(f'Method 2 - Using storage.url: {thumbnail_relative_url}')
                            except Exception as storage_error:
                                logger.warning(f'storage.url failed: {storage_error}, trying manual construction')
                                # Method 3: Manual construction from file name
                                if thumbnail_file_name:
                                    if not thumbnail_file_name.startswith('/media/'):
                                        if not thumbnail_file_name.startswith('/'):
                                            thumbnail_relative_url = '/media/' + thumbnail_file_name
                                        else:
                                            thumbnail_relative_url = '/media' + thumbnail_file_name
                                    else:
                                        thumbnail_relative_url = thumbnail_file_name
                                    logger.info(f'Method 3 - Manual construction: {thumbnail_relative_url}')
                        
                        # Ensure URL is properly formatted and file exists
                        if thumbnail_relative_url:
                            if not thumbnail_relative_url.startswith('http'):
                                if not thumbnail_relative_url.startswith('/'):
                                    thumbnail_relative_url = '/' + thumbnail_relative_url
                                # Verify file exists before returning URL
                                if thumbnail_relative_url.startswith('/media/'):
                                    file_path_from_url = thumbnail_relative_url.replace('/media/', '')
                                    # URL-decode the path to handle spaces and special characters
                                    file_path_from_url = unquote(file_path_from_url)
                                    full_file_path = os.path.join(settings.MEDIA_ROOT, file_path_from_url)
                                    if os.path.exists(full_file_path):
                                        preview_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                                        logger.info(f'✅ Preview image URL for {model_type}: {preview_url}')
                                    else:
                                        logger.warning(f'⚠️ Preview image file does not exist on disk: {full_file_path}')
                                        preview_url = None
                                else:
                                    preview_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                                    logger.info(f'✅ Preview image URL for {model_type}: {preview_url}')
                            else:
                                preview_url = thumbnail_relative_url
                                logger.info(f'✅ Preview image URL for {model_type}: {preview_url}')
                        else:
                            logger.warning(f'⚠️ Could not construct preview URL for {model_type}. File name: {thumbnail_file_name}')
                except Exception as e:
                    logger.warning(f'❌ Error getting preview URL for {model_type}: {str(e)}')
                    import traceback
                    logger.error(traceback.format_exc())
            
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
            
            # Get all GLB files from DesignGLBFile
            glb_files_list = []
            all_glb_urls = []
            try:
                from ..models import DesignGLBFile
                design_glb_files = DesignGLBFile.objects.filter(design=design).order_by('order', '-created_at')
                for glb_file in design_glb_files:
                    try:
                        file_url = None
                        file_name = None
                        
                        # Get file name
                        if hasattr(glb_file.file, 'name') and glb_file.file.name:
                            file_name = glb_file.file.name
                        elif isinstance(glb_file.file, str):
                            file_name = glb_file.file
                        
                        if file_name:
                            # Get URL
                            if hasattr(glb_file.file, 'url') and glb_file.file.url:
                                relative_url = glb_file.file.url
                            else:
                                try:
                                    relative_url = default_storage.url(file_name)
                                except Exception:
                                    if not file_name.startswith('/media/'):
                                        relative_url = '/media/' + file_name if not file_name.startswith('/') else '/media' + file_name
                                    else:
                                        relative_url = file_name
                            
                            if relative_url:
                                if not relative_url.startswith('http'):
                                    file_url = build_browser_accessible_uri(request, relative_url)
                                else:
                                    file_url = relative_url
                            
                            if file_url:
                                glb_file_info = {
                                    'id': glb_file.id,
                                    'url': file_url,
                                    'file_path': file_name,
                                    'file_name': glb_file.file_name or file_name.split('/')[-1],
                                    'file_type': glb_file.file_type,
                                    'is_primary': glb_file.is_primary,
                                    'order': glb_file.order
                                }
                                glb_files_list.append(glb_file_info)
                                all_glb_urls.append(file_url)
                                
                                # Use primary file URL if not already set
                                if glb_file.is_primary and glb_file.file_type == 'model' and not glb_url:
                                    glb_url = file_url
                    except Exception as e:
                        logger.warning(f'Error getting URL for GLB file {glb_file.id}: {str(e)}')
            except Exception as e:
                logger.warning(f'Error getting GLB files for design {design.id}: {str(e)}')
            
            # If no primary URL from DesignGLBFile, use the one from model_file (backward compatibility)
            if not glb_url and all_glb_urls:
                glb_url = all_glb_urls[0]  # Use first GLB file as primary
            
            model_type_info = {
                'model_type': model_type,
                'title': MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title()),
                'glb_url': glb_url,  # Primary GLB URL for backward compatibility
                'glb_files': glb_files_list,  # All GLB files
                'all_glb_urls': all_glb_urls,  # All GLB URLs for easy access
                'preview_url': preview_url,
                'has_model': bool(glb_url or all_glb_urls),
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
    """Enhanced health check endpoint with detailed status information"""
    health_data = {
        'status': 'ok',
        'message': 'Server is running',
        'server': 'Django REST API',
        'version': '1.0.0',
        'django_version': django.get_version(),
        'timestamp': timezone.now().isoformat(),
    }
    
    # Check database connectivity
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            health_data['database'] = {
                'status': 'ok',
                'connected': True,
                'engine': settings.DATABASES['default']['ENGINE'].split('.')[-1]
            }
    except Exception as e:
        health_data['database'] = {
            'status': 'error',
            'connected': False,
            'error': str(e)
        }
        health_data['status'] = 'degraded'
    
    # Check media directory
    try:
        media_root = settings.MEDIA_ROOT
        media_exists = os.path.exists(media_root)
        media_writable = os.access(media_root, os.W_OK) if media_exists else False
        
        health_data['media'] = {
            'status': 'ok' if (media_exists and media_writable) else 'warning',
            'directory': media_root,
            'exists': media_exists,
            'writable': media_writable
        }
        
        if not media_exists or not media_writable:
            health_data['status'] = 'degraded'
    except Exception as e:
        health_data['media'] = {
            'status': 'error',
            'error': str(e)
        }
        health_data['status'] = 'degraded'
    
    # Check static files
    try:
        static_root = settings.STATIC_ROOT
        static_exists = os.path.exists(static_root) if static_root else True
        
        health_data['static'] = {
            'status': 'ok',
            'directory': static_root,
            'exists': static_exists
        }
    except Exception as e:
        health_data['static'] = {
            'status': 'error',
            'error': str(e)
        }
    
    # Return appropriate status code based on health
    status_code = status.HTTP_200_OK if health_data['status'] == 'ok' else status.HTTP_503_SERVICE_UNAVAILABLE
    
    return Response(health_data, status=status_code)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def upload_glb(request):
    """Upload single or multiple GLB files and associate with model type
    
    Supports:
    - Single file: 'file' in request.FILES
    - Multiple files: 'files[]' in request.FILES (array of files)
    - File type: 'file_type' in request.POST ('model' or 'original', default: 'model')
    """
    # Check for single file or multiple files
    files_to_upload = []
    
    # Check for multiple files first (files[] array)
    if 'files[]' in request.FILES:
        files_to_upload = request.FILES.getlist('files[]')
    # Fallback to single file
    elif 'file' in request.FILES:
        files_to_upload = [request.FILES['file']]
    else:
        return Response(
            {'error': 'No file provided. Use "file" for single upload or "files[]" for multiple uploads'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not files_to_upload:
        return Response(
            {'error': 'No files provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate all files are STP/STEP/GLB/GLTF and filter out unwanted files
    filtered_files = []
    for file in files_to_upload:
        ext = file.name.lower().split('.')[-1]
        if ext not in ['stp', 'step', 'glb', 'gltf']:
            return Response(
                {'error': f'File "{file.name}" must be a STEP (.stp, .step) or GLB (.glb) file'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter out unwanted file: WMSS Single Skin 1 sec (1).glb
        file_name_lower = file.name.lower()
        if ('wmss' in file_name_lower and 
            'single' in file_name_lower and 
            'skin' in file_name_lower and 
            '1' in file_name_lower and 
            'sec' in file_name_lower and 
            '(1)' in file_name_lower):
            logger.info(f'🚫 Filtered out unwanted file: {file.name}')
            continue  # Skip this file
        
        filtered_files.append(file)
    
    # Update files_to_upload to use filtered list
    files_to_upload = filtered_files
    
    if not files_to_upload:
        return Response(
            {'error': 'No valid files to upload after filtering'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get model_type from form data or query params
    model_type = request.POST.get('model_type') or request.query_params.get('model_type')
    # Get file_type (model or original)
    file_type = request.POST.get('file_type', 'model')
    if file_type not in ['model', 'original']:
        file_type = 'model'
    
    try:
        uploaded_files = []
        design = None
        
        # If model_type is provided, get or create design
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
        
        # Upload each file
        for idx, file in enumerate(files_to_upload):
            # Generate unique filename
            filename = f"{uuid.uuid4()}_{file.name}"
            # Save to models/ directory
            file_path = default_storage.save(f'models/{filename}', file)
            logger.info(f'GLB file saved to: {file_path}')
            
            # Build absolute URL (normalized for browser access)
            file_url = default_storage.url(file_path)
            if not file_url.startswith('http'):
                file_url = build_browser_accessible_uri(request, file_url)
            
            file_info = {
                'file_path': file_path,
                'url': file_url,
                'glb_file_url': file_url,
                'file_name': file.name,
                'file_type': file_type
            }
            
            # If design exists, create DesignGLBFile record
            if design:
                # Determine if this should be the primary file
                # First uploaded file of type 'model' becomes primary
                is_primary = False
                if file_type == 'model' and idx == 0:
                    # Check if there's already a primary file
                    existing_primary = DesignGLBFile.objects.filter(design=design, is_primary=True, file_type='model').first()
                    if not existing_primary:
                        is_primary = True
                
                # Get the highest order number for this design
                max_order = DesignGLBFile.objects.filter(design=design).aggregate(
                    max_order=Max('order')
                )['max_order'] or 0
                
                # Create DesignGLBFile record
                glb_file = DesignGLBFile.objects.create(
                    design=design,
                    file=file_path,
                    file_type=file_type,
                    file_name=file.name,
                    is_primary=is_primary,
                    order=max_order + idx + 1
                )
                file_info['glb_file_id'] = glb_file.id
                file_info['is_primary'] = is_primary
                
                logger.info(f'Created DesignGLBFile record: ID={glb_file.id}, type={file_type}, primary={is_primary}')
                
                # For backward compatibility, also update design.model_file and original_file
                # if this is the first file of its type
                if file_type == 'model' and not design.model_file:
                    design.model_file = file_path
                    design.original_file_format = 'STEP' if file.name.lower().endswith(('.stp', '.step')) else 'GLB'
                elif file_type == 'original' and not design.original_file:
                    design.original_file = file_path
                    design.original_file_format = 'STEP' if file.name.lower().endswith(('.stp', '.step')) else 'GLB'
                
                design.save()
            
            uploaded_files.append(file_info)
        
        # Prepare response
        response_data = {
            'success': True,
            'files_uploaded': len(uploaded_files),
            'files': uploaded_files,
            'design_title': design.title if design else None,
            'model_type': model_type
        }
        
        # For single file upload, maintain backward compatibility
        if len(uploaded_files) == 1:
            single_file = uploaded_files[0]
            response_data['file_path'] = single_file['file_path']
            response_data['url'] = single_file['url']
            response_data['glb_file_url'] = single_file['glb_file_url']
        
        logger.info(f'Successfully uploaded {len(uploaded_files)} GLB file(s) for model_type: {model_type}')
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f'Error uploading GLB: {str(e)}')
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def upload_image(request):
    """Upload image file (thumbnail or preview) and associate with model type"""
    logger.info(f'📤 Image upload request received - Method: {request.method}, Content-Type: {request.content_type}')
    logger.info(f'📤 Request.FILES keys: {list(request.FILES.keys()) if request.FILES else "No files"}')
    logger.info(f'📤 Request.POST keys: {list(request.POST.keys()) if request.POST else "No POST data"}')
    
    if 'file' not in request.FILES:
        logger.error('❌ No file in request.FILES')
        return Response(
            {'error': 'No file provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    logger.info(f'📤 File received: {file.name}, Size: {file.size} bytes, Content-Type: {file.content_type}')
    
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    if not any(file.name.lower().endswith(ext) for ext in allowed_extensions):
        logger.error(f'❌ Invalid file extension: {file.name}')
        return Response(
            {'error': 'File must be an image'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get model_type from form data or query params
    model_type = request.POST.get('model_type') or request.query_params.get('model_type')
    is_thumbnail = request.POST.get('is_thumbnail', 'true').lower() == 'true'
    logger.info(f'📤 Model type: {model_type}, Is thumbnail: {is_thumbnail}')
    
    try:
        # Ensure media directory exists
        media_root = settings.MEDIA_ROOT
        if not os.path.exists(media_root):
            os.makedirs(media_root, exist_ok=True)
            logger.info(f'📁 Created media root directory: {media_root}')
        
        # Ensure thumbnails/images subdirectories exist
        folder = 'thumbnails' if is_thumbnail else 'images'
        folder_path = os.path.join(media_root, folder)
        if not os.path.exists(folder_path):
            os.makedirs(folder_path, exist_ok=True)
            logger.info(f'📁 Created folder directory: {folder_path}')
        
        # Save to thumbnails/ if it's a thumbnail, images/ otherwise
        filename = f"{uuid.uuid4()}_{file.name}"
        logger.info(f'💾 Saving file to: {folder}/{filename}')
        file_path = default_storage.save(f'{folder}/{filename}', file)
        logger.info(f'✅ File saved to: {file_path}')
        
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
                logger.info(f'Created new design for model_type: {model_type} (Design ID: {design.id})')
            
            # Update the design with the new thumbnail
            try:
                design.thumbnail = file_path
                design.save()
                logger.info(f'✅ Associated thumbnail with model_type: {model_type} (Design ID: {design.id}, File: {file_path})')
                
                # Verify thumbnail was saved correctly
                if hasattr(design.thumbnail, 'name'):
                    logger.info(f'✅ Thumbnail saved as: {design.thumbnail.name}')
                elif design.thumbnail:
                    logger.info(f'✅ Thumbnail saved as: {design.thumbnail}')
            except Exception as save_error:
                logger.error(f'❌ Error saving thumbnail: {str(save_error)}')
                import traceback
                logger.error(traceback.format_exc())
                raise
        
        # Build absolute URL (normalized for browser access)
        file_url = default_storage.url(file_path)
        if not file_url.startswith('http'):
            file_url = build_browser_accessible_uri(request, file_url)
        
        response_data = {
            'success': True,
            'file_path': file_path,
            'url': file_url,
            'image_file_url': file_url,
            'thumbnail_url': file_url if is_thumbnail else None,
            'design_title': design.title if design else None,
            'model_type': model_type
        }
        
        # Add design ID for reference
        if design:
            response_data['design_id'] = design.id
        
        logger.info(f'✅ Image upload successful - Model Type: {model_type}, URL: {file_url}, Design ID: {design.id if design else None}')
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f'❌ Error uploading image: {str(e)}')
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {
                'error': str(e),
                'error_type': type(e).__name__,
                'message': 'Failed to upload image. Please check server logs for details.'
            }, 
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
    """Get model by type - returns design with image_url and glb_url for frontend
    
    Supports combined model types (e.g., 'wmss_single_skin_1_sec_and_one_collar_hole_single_skin')
    which will fetch files from both component model types.
    """
    # Accept both 'type' and 'model_type' query parameters for compatibility
    # Note: MODEL_TYPE_MAPPING is already imported at module level
    model_type = request.query_params.get('type') or request.query_params.get('model_type')
    if not model_type:
        return Response(
            {'error': 'Model type parameter required (use ?type= or ?model_type=)'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if this is a combined model type
    combined_types = []
    if model_type == 'wmss_single_skin_1_sec_and_one_collar_hole_single_skin':
        # Note: one_collar_hole_single_skin was removed, so only fetch from wmss_single_skin_1_sec
        # Files can also be uploaded directly to the combined design
        combined_types = ['wmss_single_skin_1_sec']
    
    # If combined type, fetch files from both component types AND the combined design itself
    if combined_types:
        all_glb_files = []
        all_image_urls = []
        # Use module-level MODEL_TYPE_MAPPING (imported at top of file, line 28)
        # Access it via the module to avoid scoping issues
        import api.admin_helpers as admin_helpers_module
        combined_title = admin_helpers_module.MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
        
        # First, check if there's a design directly for the combined model type
        combined_design = get_design_by_model_type(model_type)
        if combined_design:
            # Get GLB files directly associated with the combined design
            combined_glb_files = DesignGLBFile.objects.filter(design=combined_design).order_by('order', '-created_at')
            for glb_file in combined_glb_files:
                try:
                    file_url = None
                    file_name = None
                    
                    if hasattr(glb_file.file, 'name') and glb_file.file.name:
                        file_name = glb_file.file.name
                    elif isinstance(glb_file.file, str):
                        file_name = glb_file.file
                    
                    if file_name:
                        if hasattr(glb_file.file, 'url') and glb_file.file.url:
                            relative_url = glb_file.file.url
                        else:
                            try:
                                relative_url = default_storage.url(file_name)
                            except Exception:
                                if not file_name.startswith('/media/'):
                                    relative_url = '/media/' + file_name if not file_name.startswith('/') else '/media' + file_name
                                else:
                                    relative_url = file_name
                        
                        if relative_url:
                            if not relative_url.startswith('http'):
                                file_url = build_browser_accessible_uri(request, relative_url)
                            else:
                                file_url = relative_url
                        
                        if file_url:
                            file_display_name = glb_file.file_name or file_name.split('/')[-1]
                            # Filter out unwanted file: WMSS Single Skin 1 sec (1).glb
                            file_name_lower = file_display_name.lower()
                            if ('wmss' in file_name_lower and 
                                'single' in file_name_lower and 
                                'skin' in file_name_lower and 
                                '1' in file_name_lower and 
                                'sec' in file_name_lower and 
                                '(1)' in file_name_lower):
                                logger.info(f'🚫 Filtered out unwanted file from combined design: {file_display_name}')
                                continue  # Skip this file
                            
                            glb_file_info = {
                                'id': glb_file.id,
                                'url': file_url,
                                'file_path': file_name,
                                'file_name': file_display_name,
                                'file_type': glb_file.file_type,
                                'is_primary': glb_file.is_primary,
                                'order': glb_file.order,
                                'component_type': 'combined'  # Mark as from combined design
                            }
                            all_glb_files.append(glb_file_info)
                except Exception as e:
                    logger.warning(f'Error getting URL for GLB file {glb_file.id} from combined design: {str(e)}')
            
            # Get image URL from combined design
            if combined_design.thumbnail:
                try:
                    if hasattr(combined_design.thumbnail, 'url'):
                        thumbnail_relative_url = combined_design.thumbnail.url
                    else:
                        thumbnail_relative_url = default_storage.url(combined_design.thumbnail.name)
                    
                    if thumbnail_relative_url:
                        if not thumbnail_relative_url.startswith('http'):
                            image_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                        else:
                            image_url = thumbnail_relative_url
                        
                        if image_url and image_url not in all_image_urls:
                            all_image_urls.append(image_url)
                except Exception as e:
                    logger.warning(f'Error getting image URL for combined design: {str(e)}')
        
        # Then, fetch files from component types
        for component_type in combined_types:
            component_design = get_design_by_model_type(component_type)
            if component_design:
                # Get GLB files from this component
                component_glb_files = DesignGLBFile.objects.filter(design=component_design).order_by('order', '-created_at')
                for glb_file in component_glb_files:
                    try:
                        file_url = None
                        file_name = None
                        
                        if hasattr(glb_file.file, 'name') and glb_file.file.name:
                            file_name = glb_file.file.name
                        elif isinstance(glb_file.file, str):
                            file_name = glb_file.file
                        
                        if file_name:
                            if hasattr(glb_file.file, 'url') and glb_file.file.url:
                                relative_url = glb_file.file.url
                            else:
                                try:
                                    relative_url = default_storage.url(file_name)
                                except Exception:
                                    if not file_name.startswith('/media/'):
                                        relative_url = '/media/' + file_name if not file_name.startswith('/') else '/media' + file_name
                                    else:
                                        relative_url = file_name
                            
                            if relative_url:
                                if not relative_url.startswith('http'):
                                    file_url = build_browser_accessible_uri(request, relative_url)
                                else:
                                    file_url = relative_url
                            
                            if file_url:
                                file_display_name = glb_file.file_name or file_name.split('/')[-1]
                                # Filter out unwanted file: WMSS Single Skin 1 sec (1).glb
                                file_name_lower = file_display_name.lower()
                                if ('wmss' in file_name_lower and 
                                    'single' in file_name_lower and 
                                    'skin' in file_name_lower and 
                                    '1' in file_name_lower and 
                                    'sec' in file_name_lower and 
                                    '(1)' in file_name_lower):
                                    logger.info(f'🚫 Filtered out unwanted file from {component_type}: {file_display_name}')
                                    continue  # Skip this file
                                
                                glb_file_info = {
                                    'id': glb_file.id,
                                    'url': file_url,
                                    'file_path': file_name,
                                    'file_name': file_display_name,
                                    'file_type': glb_file.file_type,
                                    'is_primary': glb_file.is_primary,
                                    'order': glb_file.order,
                                    'component_type': component_type
                                }
                                all_glb_files.append(glb_file_info)
                    except Exception as e:
                        logger.warning(f'Error getting URL for GLB file {glb_file.id} from {component_type}: {str(e)}')
                
                # Get image URL from component design
                if component_design.thumbnail:
                    try:
                        if hasattr(component_design.thumbnail, 'url'):
                            thumbnail_relative_url = component_design.thumbnail.url
                        else:
                            thumbnail_relative_url = default_storage.url(component_design.thumbnail.name)
                        
                        if thumbnail_relative_url:
                            if not thumbnail_relative_url.startswith('http'):
                                image_url = build_browser_accessible_uri(request, thumbnail_relative_url)
                            else:
                                image_url = thumbnail_relative_url
                            
                            if image_url and image_url not in all_image_urls:
                                all_image_urls.append(image_url)
                    except Exception as e:
                        logger.warning(f'Error getting image URL for {component_type}: {str(e)}')
        
        # Build combined response
        response_data = {
            'success': True,
            'model_type': model_type,
            'title': combined_title,
            'glb_files': all_glb_files,
            'glb_files_count': len(all_glb_files),
            'glb_url': all_glb_files[0]['url'] if all_glb_files else None,  # Primary GLB URL
            'image_url': all_image_urls[0] if all_image_urls else None,  # Primary image URL
            'has_glb': len(all_glb_files) > 0,
            'has_thumbnail': len(all_image_urls) > 0,
            'is_combined': True,
            'component_types': combined_types
        }
        
        if not all_glb_files:
            response_data['message'] = f'No GLB files uploaded for {combined_title}. Upload files for the component types: {", ".join(combined_types)}'
        
        return Response(response_data)
    
    # Handle regular (non-combined) model types
    design = get_design_by_model_type(model_type)
    
    # Auto-create design if it doesn't exist (for better UX)
    if not design:
        from ..admin_helpers import MATERIAL_TYPE_MAPPING
        # Note: MODEL_TYPE_MAPPING is already imported at module level
        
        # Check if model_type is valid
        if model_type not in MODEL_TYPE_MAPPING:
            return Response(
                {
                    'success': False,
                    'model_type': model_type,
                    'message': f'Invalid model type "{model_type}". Valid types: {", ".join(MODEL_TYPE_MAPPING.keys())}'
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Auto-create the design with default material type
        title = MODEL_TYPE_MAPPING.get(model_type)
        default_material = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
        
        try:
            design = ChimneyDesign.objects.create(
                title=title,
                description=f"3D model for {title} (model_type: {model_type})",
                material_type=default_material,
                is_active=True
            )
            logger.info(f'✅ Auto-created design for model_type: {model_type} (ID: {design.id}, Material: {default_material})')
        except Exception as create_error:
            logger.error(f'Error auto-creating design for {model_type}: {str(create_error)}')
            return Response(
                {
                    'success': False,
                    'model_type': model_type,
                    'message': f'Error creating model type "{model_type}": {str(create_error)}'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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
                        # URL-decode the path to handle spaces and special characters
                        file_path_from_url = unquote(file_path_from_url)
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
    
    # Get all GLB files from DesignGLBFile
    glb_files_list = []
    # Filter primary GLB URL if it matches unwanted file
    primary_glb_url = None
    if glb_url:
        # Check if the primary URL points to unwanted file
        glb_url_lower = glb_url.lower()
        if not ('wmss%20single%20skin%201%20sec%20(1)' in glb_url_lower or 
                'wmss single skin 1 sec (1)' in glb_url_lower):
            primary_glb_url = glb_url
        else:
            logger.info(f'🚫 Filtered out unwanted file from primary GLB URL: {glb_url}')
    
    try:
        design_glb_files = DesignGLBFile.objects.filter(design=design).order_by('order', '-created_at')
        for glb_file in design_glb_files:
            try:
                file_url = None
                file_name = None
                
                # Get file name
                if hasattr(glb_file.file, 'name') and glb_file.file.name:
                    file_name = glb_file.file.name
                elif isinstance(glb_file.file, str):
                    file_name = glb_file.file
                
                if file_name:
                    # Get URL
                    if hasattr(glb_file.file, 'url') and glb_file.file.url:
                        relative_url = glb_file.file.url
                    else:
                        try:
                            relative_url = default_storage.url(file_name)
                        except Exception:
                            if not file_name.startswith('/media/'):
                                relative_url = '/media/' + file_name if not file_name.startswith('/') else '/media' + file_name
                            else:
                                relative_url = file_name
                    
                    if relative_url:
                        if not relative_url.startswith('http'):
                            file_url = build_browser_accessible_uri(request, relative_url)
                        else:
                            file_url = relative_url
                    
                    if file_url:
                        file_display_name = glb_file.file_name or file_name.split('/')[-1]
                        # Filter out unwanted file: WMSS Single Skin 1 sec (1).glb
                        file_name_lower = file_display_name.lower()
                        if ('wmss' in file_name_lower and 
                            'single' in file_name_lower and 
                            'skin' in file_name_lower and 
                            '1' in file_name_lower and 
                            'sec' in file_name_lower and 
                            '(1)' in file_name_lower):
                            logger.info(f'🚫 Filtered out unwanted file from {model_type}: {file_display_name}')
                            continue  # Skip this file
                        
                        glb_file_info = {
                            'id': glb_file.id,
                            'url': file_url,
                            'file_path': file_name,
                            'file_name': file_display_name,
                            'file_type': glb_file.file_type,
                            'is_primary': glb_file.is_primary,
                            'order': glb_file.order
                        }
                        glb_files_list.append(glb_file_info)
                        
                        # Use primary file URL if not already set (but filter unwanted file)
                        if glb_file.is_primary and glb_file.file_type == 'model' and not primary_glb_url:
                            file_display_name = glb_file.file_name or file_name.split('/')[-1]
                            file_name_lower = file_display_name.lower()
                            # Don't set as primary if it's the unwanted file
                            if not ('wmss' in file_name_lower and 
                                    'single' in file_name_lower and 
                                    'skin' in file_name_lower and 
                                    '1' in file_name_lower and 
                                    'sec' in file_name_lower and 
                                    '(1)' in file_name_lower):
                                primary_glb_url = file_url
                            else:
                                logger.info(f'🚫 Filtered out unwanted file from primary GLB URL: {file_display_name}')
            except Exception as e:
                logger.warning(f'Error getting URL for GLB file {glb_file.id}: {str(e)}')
    except Exception as e:
        logger.warning(f'Error getting GLB files for design {design.id}: {str(e)}')
    
    # If no primary URL from DesignGLBFile, use the one from model_file (backward compatibility)
    # But filter out unwanted file
    if not primary_glb_url and glb_url:
        glb_url_lower = glb_url.lower()
        if not ('wmss%20single%20skin%201%20sec%20(1)' in glb_url_lower or 
                'wmss single skin 1 sec (1)' in glb_url_lower):
            primary_glb_url = glb_url
        else:
            logger.info(f'🚫 Filtered out unwanted file from fallback primary GLB URL: {glb_url}')
    
    # Add frontend-compatible fields
    response_data['image_url'] = image_url
    response_data['glb_url'] = primary_glb_url  # Primary GLB URL for backward compatibility
    response_data['glb_files'] = glb_files_list  # All GLB files
    response_data['glb_files_count'] = len(glb_files_list)
    response_data['success'] = True
    response_data['model_type'] = model_type
    response_data['title'] = design.title
    response_data['has_glb'] = bool(primary_glb_url or glb_files_list)
    response_data['has_thumbnail'] = bool(image_url)
    
    # If no GLB file, provide helpful message
    if not primary_glb_url and not glb_files_list:
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


@api_view(['DELETE'])
@permission_classes([permissions.AllowAny])  # Changed to AllowAny, we check auth manually
def delete_glb_file(request):
    """
    Delete a single GLB file by ID.
    Requires authentication and staff permissions or ownership.
    """
    try:
        # Check if user is authenticated (works with both session and token auth)
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        glb_file_id = request.query_params.get('id') or request.data.get('id')
        
        if not glb_file_id:
            return Response(
                {'error': 'GLB file ID parameter required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            glb_file_id = int(glb_file_id)
        except ValueError:
            return Response(
                {'error': 'Invalid GLB file ID'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the GLB file
        glb_file = get_object_or_404(DesignGLBFile, id=glb_file_id)
        design = glb_file.design
        
        # Check permissions: staff or design owner
        if not (request.user.is_staff or (hasattr(design, 'created_by') and design.created_by == request.user)):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Store file path and design info before deletion
        file_path = glb_file.file.name if glb_file.file else None
        file_name = glb_file.file_name or 'Unknown'
        file_type = glb_file.file_type or 'model'
        design_title = design.title
        
        # Delete the physical file if it exists
        if file_path:
            try:
                if default_storage.exists(file_path):
                    default_storage.delete(file_path)
                    logger.info(f'Deleted physical file: {file_path}')
                else:
                    logger.warning(f'Physical file not found: {file_path}')
            except Exception as e:
                logger.warning(f'Error deleting physical file {file_path}: {str(e)}')
        
        # Delete the database record (this deletes ONLY this specific file)
        glb_file.delete()
        
        logger.info(f'Deleted GLB file: ID={glb_file_id}, File={file_name}, Type={file_type}, Design={design_title}')
        
        return Response({
            'message': f'GLB {file_type} file "{file_name}" deleted successfully',
            'deleted_file_id': glb_file_id,
            'deleted_file_name': file_name,
            'deleted_file_type': file_type,
            'design': design_title,
            'success': True
        })
        
    except DesignGLBFile.DoesNotExist:
        return Response(
            {'error': 'GLB file not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f'Error in delete_glb_file: {str(e)}')
        return Response(
            {'error': f'Delete error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([permissions.AllowAny])  # Changed to AllowAny, we check auth manually
def delete_all_glb_files(request):
    """
    Delete all GLB files for a specific model type.
    Requires authentication and staff permissions or design ownership.
    """
    try:
        # Check if user is authenticated (works with both session and token auth)
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        model_type = request.query_params.get('type') or request.data.get('type')
        
        if not model_type:
            return Response(
                {'error': 'Model type parameter required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the design for this model type
        design = get_design_by_model_type(model_type)
        
        if not design:
            return Response(
                {'error': f'No design found for model type: {model_type}'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions: staff or design owner
        if not (request.user.is_staff or (hasattr(design, 'created_by') and design.created_by == request.user)):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all GLB files for this design
        glb_files = DesignGLBFile.objects.filter(design=design)
        total_files = glb_files.count()
        
        if total_files == 0:
            return Response({
                'message': f'No GLB files found for model type: {model_type}',
                'deleted_count': 0
            })
        
        deleted_files = []
        deleted_count = 0
        errors = []
        
        # Delete each GLB file
        for glb_file in glb_files:
            try:
                file_path = glb_file.file.name if glb_file.file else None
                file_name = glb_file.file_name or 'Unknown'
                
                # Delete physical file if it exists
                if file_path and default_storage.exists(file_path):
                    try:
                        default_storage.delete(file_path)
                        logger.info(f'Deleted physical file: {file_path}')
                    except Exception as e:
                        logger.warning(f'Error deleting physical file {file_path}: {str(e)}')
                        errors.append(f'Failed to delete file {file_name}: {str(e)}')
                
                # Delete database record
                glb_file.delete()
                deleted_files.append(file_name)
                deleted_count += 1
                
            except Exception as e:
                logger.error(f'Error deleting GLB file ID={glb_file.id}: {str(e)}')
                errors.append(f'Failed to delete file ID={glb_file.id}: {str(e)}')
        
        logger.info(f'Deleted {deleted_count}/{total_files} GLB files for model type: {model_type}')
        
        response_data = {
            'message': f'Deleted {deleted_count} GLB file(s) for model type: {model_type}',
            'model_type': model_type,
            'design': design.title,
            'deleted_count': deleted_count,
            'total_files': total_files,
            'deleted_files': deleted_files
        }
        
        if errors:
            response_data['errors'] = errors
            response_data['warning'] = f'Some files could not be deleted: {len(errors)} error(s)'
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f'Error in delete_all_glb_files: {str(e)}')
        return Response(
            {'error': f'Delete error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

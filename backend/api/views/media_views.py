"""
Custom view to serve media files with correct Content-Type headers
This ensures GLB files are served as binary, not text
"""
from django.http import FileResponse, Http404, JsonResponse
from django.conf import settings
import os
import mimetypes
import glob
import logging

logger = logging.getLogger(__name__)

def serve_media_file(request, path):
    """
    Serve media files with correct Content-Type headers
    Especially important for GLB files which are binary
    """
    file_path = os.path.join(settings.MEDIA_ROOT, path)
    
    # If file doesn't exist, try to find similar files (for GLB files with unique IDs)
    if not os.path.exists(file_path):
        # Extract base filename and extension
        base_name = os.path.basename(path)
        dir_name = os.path.dirname(path)
        name_without_ext, file_ext = os.path.splitext(base_name)
        
        # For GLB files, try to find files with similar names
        if file_ext.lower() == '.glb':
            # Strategy 1: Search for files starting with the base name (handles unique ID suffixes)
            # Example: WMSS_Single_Skin.glb -> WMSS_Single_Skin*.glb
            # Example: GA___Drawing_DS2__Date_201023041758_9UK1f2B.glb -> GA___Drawing_DS2__Date_201023041758*.glb
            
            # Try to extract base pattern (remove potential unique ID or version number)
            parts = name_without_ext.split('_')
            base_pattern = name_without_ext
            
            # Strategy: Find the longest common prefix that matches other files
            # For WMSS_Single_Skin_5Secs_2 -> try WMSS_Single_Skin_5Secs
            # For WMSS_Single_Skin_5Secs_1_sVZ4uVd -> try WMSS_Single_Skin_5Secs
            
            if len(parts) > 1:
                # Check if last part looks like a unique ID (short, alphanumeric) or version number
                last_part = parts[-1]
                # Remove last part if it's a short alphanumeric (likely unique ID) or a single digit (version)
                if len(last_part) <= 10 and (last_part.isalnum() or last_part.isdigit()):
                    base_pattern = '_'.join(parts[:-1])
                # Also try removing last 2 parts if second-to-last is a number (like "5Secs_2")
                elif len(parts) > 2:
                    second_last = parts[-2]
                    if second_last.isdigit() or 'secs' in second_last.lower() or 'sec' in second_last.lower():
                        base_pattern = '_'.join(parts[:-2])
            
            # Search locations in order of preference
            search_locations = []
            
            # 1. Same directory
            if dir_name:
                search_locations.append(os.path.join(settings.MEDIA_ROOT, dir_name))
            
            # 2. models/original/ directory (common location)
            if 'models' in dir_name or dir_name == 'models':
                search_locations.append(os.path.join(settings.MEDIA_ROOT, 'models', 'original'))
                search_locations.append(os.path.join(settings.MEDIA_ROOT, 'models'))
            elif dir_name == 'models/original':
                search_locations.append(os.path.join(settings.MEDIA_ROOT, 'models'))
                search_locations.append(os.path.join(settings.MEDIA_ROOT, 'models', 'original'))
            
            # 3. Root media directory
            search_locations.append(settings.MEDIA_ROOT)
            
            # 4. Recursively search all subdirectories
            models_dir = os.path.join(settings.MEDIA_ROOT, 'models')
            if os.path.exists(models_dir):
                for root, dirs, files in os.walk(models_dir):
                    search_locations.append(root)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_locations = []
            for loc in search_locations:
                if loc not in seen and os.path.exists(loc):
                    seen.add(loc)
                    unique_locations.append(loc)
            
            # Search in all locations with multiple strategies
            found_file = False
            for search_dir in unique_locations:
                # Strategy 1: Try exact base pattern match (e.g., WMSS_Single_Skin_5Secs*.glb)
                pattern = os.path.join(search_dir, f"{base_pattern}*{file_ext}")
                matching_files = glob.glob(pattern)
                
                if matching_files:
                    # Use the first matching file
                    file_path = matching_files[0]
                    logger.info(f"Found alternative file: {file_path} (requested: {path})")
                    found_file = True
                    break
                
                # Strategy 2: Try progressively shorter patterns
                # For WMSS_Single_Skin_5Secs_2, try:
                # - WMSS_Single_Skin_5Secs* (already tried above)
                # - WMSS_Single_Skin* (if 5Secs is version-specific)
                # - WMSS* (last resort)
                
                # Try removing numeric/version parts
                pattern_parts = base_pattern.split('_')
                for i in range(len(pattern_parts) - 1, 0, -1):
                    shorter_pattern = '_'.join(pattern_parts[:i])
                    pattern = os.path.join(search_dir, f"{shorter_pattern}*{file_ext}")
                    matching_files = glob.glob(pattern)
                    if matching_files:
                        # Prefer files that contain more of the original name
                        best_match = None
                        best_score = 0
                        for match_file in matching_files:
                            match_name = os.path.basename(match_file)
                            # Score: count matching parts + length similarity
                            score = sum(1 for part in pattern_parts if part in match_name)
                            # Bonus for files with similar length
                            length_diff = abs(len(match_name) - len(name_without_ext))
                            score += max(0, 10 - length_diff)
                            if score > best_score:
                                best_score = score
                                best_match = match_file
                        if best_match:
                            file_path = best_match
                            logger.info(f"Found alternative file with shorter pattern ({shorter_pattern}): {file_path} (requested: {path})")
                            found_file = True
                            break
                
                if found_file:
                    break
                
                # Strategy 3: Try matching just the first part (for files like WMSS_Single_Skin)
                if len(parts) > 0:
                    first_part_pattern = parts[0]
                    pattern = os.path.join(search_dir, f"{first_part_pattern}*{file_ext}")
                    matching_files = glob.glob(pattern)
                    if matching_files:
                        # Prefer files that contain more of the original name
                        best_match = None
                        best_score = 0
                        for match_file in matching_files:
                            match_name = os.path.basename(match_file)
                            # Score based on how many parts of original name are in match
                            score = sum(1 for part in parts if part in match_name)
                            if score > best_score:
                                best_score = score
                                best_match = match_file
                        if best_match and best_score >= 2:  # Require at least 2 matching parts
                            file_path = best_match
                            logger.info(f"Found alternative file with first-part pattern: {file_path} (requested: {path})")
                            found_file = True
                            break
                
                if found_file:
                    break
        
        # If still not found, raise 404 with helpful message
        if not os.path.exists(file_path):
            logger.warning(f"File not found: {path} (searched in: {settings.MEDIA_ROOT})")
            # Try to list available files in the directory for debugging
            search_dir = os.path.join(settings.MEDIA_ROOT, dir_name) if dir_name else settings.MEDIA_ROOT
            if os.path.exists(search_dir):
                available_files = [f for f in os.listdir(search_dir) if f.endswith(file_ext)]
                if available_files:
                    logger.info(f"Available {file_ext} files in {dir_name}: {available_files[:5]}")  # Show first 5
            
            # Also check models/original/ if different
            if dir_name != 'models/original':
                original_dir = os.path.join(settings.MEDIA_ROOT, 'models', 'original')
                if os.path.exists(original_dir):
                    available_files = [f for f in os.listdir(original_dir) if f.endswith(file_ext)]
                    if available_files:
                        logger.info(f"Available {file_ext} files in models/original/: {available_files[:5]}")
            
            # Check if this is an API request (from frontend) - return JSON instead of HTML 404
            if request.headers.get('Accept', '').find('application/json') != -1 or \
               request.path.startswith('/api/') or \
               'application/json' in request.META.get('HTTP_ACCEPT', ''):
                return JsonResponse({
                    'error': 'File not found',
                    'path': path,
                    'message': f'The requested file {path} does not exist on the server.'
                }, status=404)
            
            raise Http404(f"File not found: {path}")
    
    # Determine content type based on file extension
    ext = os.path.splitext(file_path)[1].lower()
    content_type_map = {
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.stp': 'application/octet-stream',
        '.step': 'application/octet-stream',
        '.stl': 'application/octet-stream',
        '.obj': 'application/octet-stream',
        '.fbx': 'application/octet-stream',
        '.3ds': 'application/octet-stream',
        '.dwg': 'application/acad',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
    }
    
    # Get content type from map or use mimetypes
    content_type = content_type_map.get(ext)
    if not content_type:
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = 'application/octet-stream'
    
    # Open file in binary mode
    file_handle = open(file_path, 'rb')
    
    # Create FileResponse with correct content type
    response = FileResponse(file_handle, content_type=content_type)
    
    # Set additional headers for binary files
    if ext in ['.glb', '.gltf', '.stp', '.step', '.stl', '.obj', '.fbx', '.3ds', '.dwg']:
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(file_path)}"'
        response['Accept-Ranges'] = 'bytes'
    
    # Add CORS headers to allow cross-origin requests for media files
    # This is essential for GLB files to be loaded from frontend
    origin = request.META.get('HTTP_ORIGIN')
    if settings.DEBUG:
        # In DEBUG mode, allow all origins
        # Note: Cannot use '*' with credentials, so use origin if available
        if origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
        else:
            response['Access-Control-Allow-Origin'] = '*'
            # Cannot set credentials to true when using '*'
            response['Access-Control-Allow-Credentials'] = 'false'
    elif origin and origin in settings.CORS_ALLOWED_ORIGINS:
        # In production, only allow specific origins
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true' if settings.CORS_ALLOW_CREDENTIALS else 'false'
    else:
        # No origin or origin not allowed
        response['Access-Control-Allow-Credentials'] = 'false'
    
    # Add other CORS headers
    response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Accept, Accept-Language, Content-Language, Content-Type, Origin, X-Requested-With'
    response['Access-Control-Expose-Headers'] = 'Content-Type, Content-Length, Accept-Ranges, Content-Disposition'
    
    # Handle OPTIONS preflight requests for media files
    if request.method == 'OPTIONS':
        return Response(status=204)
    
    return response


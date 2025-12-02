"""
Views to serve the frontend React application
"""
from django.shortcuts import render
from django.http import HttpResponse, FileResponse
from django.conf import settings
import os
from pathlib import Path


def serve_frontend(request):
    """
    Serve the frontend React application.
    This view handles all frontend routes and serves index.html for SPA routing.
    """
    # Safety check: reject admin paths early (shouldn't reach here if URL routing is correct)
    path = request.path.strip('/')
    if path.startswith('admin') or path == 'admin':
        from django.http import Http404
        raise Http404("Admin paths should be handled by Django admin, not frontend view")
    
    # Get the frontend build directory
    PROJECT_ROOT = settings.BASE_DIR.parent  # Root of the entire project
    frontend_dist = os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main', 'dist')
    frontend_source = os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main')
    root_index = os.path.join(PROJECT_ROOT, 'index.html')
    
    # Get the requested path from the URL
    request_path = request.path.strip('/')
    
    # Try to serve static files first (JS, CSS, images, etc.)
    if request_path and not request_path.startswith('api/') and not request_path.startswith('admin/'):
        # Check if it's a static file request (has an extension)
        if '.' in os.path.basename(request_path):
            static_file_paths = [
                os.path.join(frontend_dist, request_path),
                os.path.join(frontend_dist, 'assets', request_path),
                os.path.join(frontend_source, 'public', request_path),
            ]
            
            for static_path in static_file_paths:
                if os.path.isfile(static_path):
                    try:
                        # Determine content type
                        ext = os.path.splitext(static_path)[1].lower()
                        content_types = {
                            '.js': 'application/javascript',
                            '.css': 'text/css',
                            '.png': 'image/png',
                            '.jpg': 'image/jpeg',
                            '.jpeg': 'image/jpeg',
                            '.svg': 'image/svg+xml',
                            '.json': 'application/json',
                            '.woff': 'font/woff',
                            '.woff2': 'font/woff2',
                        }
                        content_type = content_types.get(ext, 'application/octet-stream')
                        return FileResponse(open(static_path, 'rb'), content_type=content_type)
                    except Exception:
                        pass
    
    # For all other routes, serve index.html (SPA routing)
    index_paths = [
        os.path.join(frontend_dist, 'index.html'),
        os.path.join(frontend_source, 'index.html'),
        root_index,
    ]
    
    for index_path in index_paths:
        if os.path.isfile(index_path):
            try:
                with open(index_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Fix asset paths if needed
                    if 'dist' in index_path:
                        # If serving from dist, assets should be relative
                        content = content.replace('/assets/', '/static/assets/')
                    return HttpResponse(content, content_type='text/html')
            except Exception as e:
                continue
    
    # Fallback: return a simple HTML response
    return HttpResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Chimney Craft 3D</title>
        <meta charset="utf-8">
    </head>
    <body>
        <h1>Frontend not found</h1>
        <p>Please build the frontend first:</p>
        <pre>cd chimney-craft-3d-main && npm run build</pre>
        <p>Or access the API at <a href="/api/">/api/</a></p>
    </body>
    </html>
    """, content_type='text/html')


"""
URL configuration for chimney_craft_backend project.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.generic import RedirectView
from api.views import frontend_views, media_views

urlpatterns = [
    # Standard Django admin with username/password login and password change
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

# Serve static files in development (includes admin static files)
# This uses Django's staticfiles app which automatically finds static files
# from all apps including django.contrib.admin
# IMPORTANT: Add static files BEFORE the catch-all frontend route
if settings.DEBUG:
    # Use staticfiles_urlpatterns to serve static files from all apps
    urlpatterns += staticfiles_urlpatterns()
    # Serve media files with custom view for correct Content-Type headers
    # This ensures GLB files are served as binary, not text
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', media_views.serve_media_file, name='serve_media'),
    ]

# Serve frontend - catch all routes except api/, admin/, static/, media/
# This regex matches any path that doesn't start with api/, admin/, static/, or media/
# IMPORTANT: This must be LAST so it doesn't interfere with static/media files
# Updated regex to exclude both 'admin' and 'admin/' (with and without trailing slash)
# The pattern (?!api/|admin|static/|media/) excludes paths starting with these prefixes
urlpatterns += [
    re_path(r'^(?!api/|admin|static/|media/).*', frontend_views.serve_frontend, name='frontend'),
]


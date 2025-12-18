"""
Custom Django Admin Configuration
Sets backend branding with server icon and Lovable symbol
"""
from django.contrib import admin

# Customize Django Admin Site Branding
admin.site.site_header = "Django Admin API Page"
admin.site.site_title = "Django Admin API"
admin.site.index_title = "Django Admin API Page"


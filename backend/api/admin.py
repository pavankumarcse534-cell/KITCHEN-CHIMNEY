from django.contrib import admin
from django import forms
from django.forms.models import BaseInlineFormSet
from django.utils.html import format_html
from django.db import models
import logging
from .models import Category, ChimneyDesign, UserProject, Order, ContactMessage, DesignGLBFile

logger = logging.getLogger(__name__)

# Import MODEL_TYPE_MAPPING for admin description
try:
    from .admin_helpers import MODEL_TYPE_MAPPING
except ImportError:
    MODEL_TYPE_MAPPING = {}


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name', 'description']


class MultipleFileInput(forms.FileInput):
    """Custom file input widget that supports multiple file selection"""
    allow_multiple_selected = True
    
    def __init__(self, attrs=None):
        super().__init__(attrs)
        if attrs is None:
            attrs = {}
        attrs['multiple'] = True
        # Only set default accept if not already specified
        if 'accept' not in attrs:
            attrs['accept'] = '.glb,.gltf'
        attrs['class'] = attrs.get('class', '') + ' multiple-file-input'
        self.attrs = attrs
    
    def value_from_datadict(self, data, files, name):
        """Handle multiple file uploads"""
        if hasattr(files, 'getlist'):
            file_list = files.getlist(name)
            return file_list if len(file_list) > 1 else (file_list[0] if file_list else None)
        return files.get(name)


class DesignGLBFileInlineForm(forms.ModelForm):
    """Custom form for GLB file inline with multiple file support"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ensure form has proper encoding for file uploads
        if hasattr(self, 'base_fields'):
            # Check if form has file fields
            has_file_fields = any(
                isinstance(field, (forms.FileField, forms.ImageField))
                for field in self.base_fields.values()
            )
            if has_file_fields:
                # Set encoding type for file uploads
                self.use_required_attribute = False
        
        # Hide file_type field in inline (it will be set automatically based on which inline is used)
        if 'file_type' in self.fields:
            self.fields['file_type'].widget = forms.HiddenInput()
        
        # Make file field not required (empty forms will be skipped)
        if 'file' in self.fields:
            self.fields['file'].required = False
    
    def clean_file(self):
        """Handle file field - convert list to single file if needed"""
        file_data = self.cleaned_data.get('file')
        
        # If file_data is a list (multiple files selected), take the first one for this form
        # Other files will be processed separately in save_formset
        if isinstance(file_data, list):
            if len(file_data) > 0:
                return file_data[0]  # Return first file for this form instance
            return None
        
        return file_data
    
    def clean(self):
        """Validate form - allow empty forms for new instances"""
        cleaned_data = super().clean()
        # Don't require file for new forms - they'll be skipped in formset.save()
        return cleaned_data
    
    class Meta:
        model = DesignGLBFile
        fields = '__all__'
        widgets = {
            'file': MultipleFileInput(attrs={
                'accept': '.stp,.step',
                'class': 'multiple-file-input'
            })
        }
        help_texts = {
            'file': '💡 Click "Choose Files" to select multiple STEP/STP files at once (Ctrl+Click or Shift+Click)'
        }


class ChimneyDesignAdminForm(forms.ModelForm):
    """Custom form for ChimneyDesign with multiple file support for legacy fields"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ensure form has proper encoding for file uploads
        if hasattr(self, 'base_fields'):
            # Check if form has file fields
            has_file_fields = any(
                isinstance(field, (forms.FileField, forms.ImageField))
                for field in self.base_fields.values()
            )
            if has_file_fields:
                # Set encoding type for file uploads
                self.use_required_attribute = False
    
    class Meta:
        model = ChimneyDesign
        fields = '__all__'
        widgets = {
            'original_file': MultipleFileInput(attrs={
                'accept': '.glb,.gltf,.step,.stp',
                'class': 'multiple-file-input'
            }),
            'model_file': MultipleFileInput(attrs={
                'accept': '.glb,.gltf',
                'class': 'multiple-file-input'
            })
        }
        help_texts = {
            'original_file': '💡 Click "Choose Files" to select multiple files (Legacy - use STEP/STP Files section instead)',
            'model_file': '💡 Click "Choose Files" to select multiple GLB files (Legacy - use STEP/STP Files section instead)'
        }


class DesignGLBFileFormSet(BaseInlineFormSet):
    """Custom formset to handle file_type automatically and empty forms"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Initialize attributes required by Django admin
        self.new_objects = []
        self.changed_objects = []
        self.deleted_objects = []
    
    def save(self, commit=True):
        """Override save to handle empty forms and populate required attributes"""
        # Initialize attributes
        self.new_objects = []
        self.changed_objects = []  # Django expects list of (object, [changed_fields]) tuples
        self.deleted_objects = []
        
        instances = []
        for form in self.forms:
            # Skip deleted forms
            if form in self.deleted_forms:
                if form.instance.pk:
                    self.deleted_objects.append(form.instance)
                continue
            
            # Skip empty forms (new forms without files)
            if not form.instance.pk:
                # Check if form has a file in cleaned_data
                if form.is_valid():
                    file_data = form.cleaned_data.get('file')
                    if not file_data:
                        continue  # Skip empty forms
                else:
                    # Form is invalid - check if it's because file is required
                    if 'file' in form.errors:
                        continue  # Skip forms with file errors (empty forms)
                    # For other errors, try to process if file exists
                    file_data = form.cleaned_data.get('file') if form.cleaned_data else None
                    if not file_data:
                        continue
            
            # Validate form if not already validated
            if not form.is_valid():
                # Skip invalid forms (but log errors)
                if form.errors:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f'Form validation errors: {form.errors}')
                # Skip if no file data
                if not form.cleaned_data.get('file'):
                    continue
            
            # Save the form instance
            try:
                instance = form.save(commit=False)
                
                # Get changed fields for changed objects
                if instance.pk:
                    # For changed objects, Django expects (object, [changed_fields]) tuple
                    changed_fields = []
                    try:
                        if hasattr(form, 'changed_data'):
                            changed_fields = form.changed_data or []
                    except:
                        changed_fields = []
                    # Always append as tuple (object, [changed_fields])
                    self.changed_objects.append((instance, changed_fields))
                else:
                    self.new_objects.append(instance)
                
                instances.append(instance)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f'Error saving form instance: {str(e)}')
                continue
        
        if commit:
            for instance in instances:
                instance.save()
            self.save_m2m()
        
        return instances


class DesignGLBFileInlineBase(admin.TabularInline):
    """Base inline admin for GLB files with common functionality"""
    model = DesignGLBFile
    form = DesignGLBFileInlineForm
    formset = DesignGLBFileFormSet
    extra = 1  # Show 1 empty form by default (can add more with "Add another" button)
    # Note: Django automatically adds a DELETE checkbox column for inline formsets
    # We include it in fields to control the order, but it's automatically handled
    fields = ('file', 'file_name', 'is_primary', 'order', 'file_preview_link', 'edit_button', 'quick_delete_button')
    readonly_fields = ('file_preview_link', 'edit_button', 'quick_delete_button')
    can_delete = False  # Disable built-in DELETE checkbox - using Quick Delete button instead
    
    def quick_delete_button(self, obj):
        """Display quick delete button for GLB file - deletes only this specific file"""
        if not obj or not obj.pk:
            return format_html('<small style="color: gray;">-</small>')
        
        file_name = obj.file_name or (obj.file.name.split('/')[-1] if hasattr(obj.file, 'name') and obj.file.name else 'Unknown')
        file_type = getattr(obj, 'file_type', 'model')
        
        # Create delete button with AJAX call - deletes only this specific GLB file
        # Using onclick as fallback in case event delegation doesn't work
        return format_html(
            '<button type="button" class="delete-glb-file-btn" id="delete-btn-{}" '
            'data-file-id="{}" data-file-name="{}" data-file-type="{}" '
            'onclick="if(typeof window.deleteGLBFile === \'function\'){{window.deleteGLBFile({});}}else{{alert(\'Delete function not loaded. Please refresh the page.\');}}return false;" '
            'style="background-color: #dc3545; color: white; border: none; padding: 5px 10px; '
            'border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap; '
            'margin-left: 5px;" title="Delete only this GLB {} file: {}">'
            '🗑️ Delete</button>',
            obj.pk,
            obj.pk,
            file_name,
            file_type,
            obj.pk,
            file_type,
            file_name
        )
    quick_delete_button.short_description = 'Delete'
    
    def edit_button(self, obj):
        """Display edit/update button for GLB file"""
        if not obj or not obj.pk:
            return format_html('<small style="color: gray;">-</small>')
        
        return format_html(
            '<a href="/admin/api/designglbfile/{}/change/" target="_blank" '
            'style="background-color: #007bff; color: white; border: none; padding: 5px 10px; '
            'border-radius: 3px; cursor: pointer; font-size: 12px; text-decoration: none; display: inline-block;">'
            '✏️ Edit</a>',
            obj.pk
        )
    edit_button.short_description = 'Edit'
    
    class Media:
        js = ('admin/js/delete_glb_file.js',)
    
    def file_preview_link(self, obj):
        """Show file preview with download link and file information"""
        if not obj:
            return format_html('<small style="color: gray;">No file chosen</small>')
        
        # Handle case when file is uploaded but not saved yet
        if obj.file and not obj.pk:
            file_name = getattr(obj.file, 'name', 'Unknown')
            if hasattr(file_name, 'split'):
                file_name = file_name.split('/')[-1] if '/' in file_name else file_name
            return format_html(
                '<div style="padding: 5px; background: #f0f8ff; border: 1px solid #0066cc; border-radius: 3px;">'
                '<small style="color: blue;">💾 File ready: <strong>{}</strong><br/>'
                'Click "Save" to upload and preview</small>'
                '</div>',
                file_name
            )
        
        # Handle saved files
        if obj.pk:
            try:
                from django.core.files.storage import default_storage
                from django.conf import settings
                import os
                
                # Get file information
                file_name = obj.file_name or 'Unknown'
                file_path = None
                file_url = None
                file_size = None
                
                # Try to get file path and URL
                if hasattr(obj.file, 'name') and obj.file.name:
                    file_path = obj.file.name
                    try:
                        # Try to get URL from storage
                        file_url = default_storage.url(file_path)
                        # Use relative URL - browser will resolve it correctly
                        if not file_url.startswith('/'):
                            file_url = f"/{file_url}"
                        # Ensure it starts with /media/ for proper resolution
                        if not file_url.startswith('/media/'):
                            file_url = f"{settings.MEDIA_URL.rstrip('/')}/{file_path.lstrip('/')}"
                    except Exception as e:
                        logger.warning(f'Error getting storage URL: {str(e)}')
                        # Fallback: construct URL manually using MEDIA_URL
                        file_url = f"{settings.MEDIA_URL.rstrip('/')}/{file_path}"
                        if not file_url.startswith('/'):
                            file_url = f"/{file_url}"
                    
                    # Try to get file size
                    file_size_str = "Size unknown"
                    try:
                        if default_storage.exists(file_path):
                            file_size = default_storage.size(file_path)
                            if file_size:
                                # Format file size
                                if file_size < 1024:
                                    file_size_str = f"{file_size} B"
                                elif file_size < 1024 * 1024:
                                    file_size_str = f"{file_size / 1024:.1f} KB"
                                else:
                                    file_size_str = f"{file_size / (1024 * 1024):.1f} MB"
                            else:
                                file_size_str = "Unknown size"
                        else:
                            file_size_str = "File not found"
                    except Exception as e:
                        logger.warning(f'Error getting file size: {str(e)}')
                        file_size_str = "Size unknown"
                
                # Determine file type icon
                file_ext = os.path.splitext(file_name)[1].lower() if file_name else ''
                if file_ext in ['.glb', '.gltf']:
                    file_icon = '📦'
                    file_type_label = 'GLB/GLTF'
                else:
                    file_icon = '📄'
                    file_type_label = 'File'
                
                # Build preview HTML
                preview_html = format_html(
                    '<div style="padding: 8px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; min-width: 200px;">'
                            '<div style="margin-bottom: 5px;">'
                    '<span style="font-size: 16px; margin-right: 5px;">{}</span>'
                    '<strong style="color: #333;">{}</strong>'
                    '</div>'
                    '<div style="margin-bottom: 8px; font-size: 11px; color: #666;">'
                    'Type: {} | Size: {}'
                    '</div>'
                    '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">'
                    '<a href="{}" target="_blank" '
                    'style="display: inline-block; padding: 4px 8px; background: #0066cc; color: white; '
                    'text-decoration: none; border-radius: 3px; font-size: 11px; margin-right: 5px;">'
                    '📥 Download</a>'
                    '<a href="/admin/api/designglbfile/{}/change/" target="_blank" '
                    'style="display: inline-block; padding: 4px 8px; background: #28a745; color: white; '
                    'text-decoration: none; border-radius: 3px; font-size: 11px;">'
                    '👁️ Details</a>'
                    '</div>'
                            '</div>',
                    file_icon,
                    file_name[:30] + ('...' if len(file_name) > 30 else ''),
                    file_type_label,
                    file_size_str,
                    file_url if file_url else '#',
                    obj.pk
                )
                
                return preview_html
                
            except Exception as e:
                logger.warning(f'Error getting file preview: {str(e)}')
                import traceback
                logger.error(traceback.format_exc())
                return format_html(
                    '<div style="padding: 5px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 3px;">'
                    '<small style="color: #856404;">⚠️ Preview Error: {}</small>'
                    '</div>',
                    str(e)[:50]
                )
        
        return format_html('<small style="color: gray;">No file chosen</small>')
    file_preview_link.short_description = 'Preview'
    
    def get_queryset(self, request):
        """Filter queryset by file_type"""
        qs = super().get_queryset(request)
        if hasattr(self, 'file_type_filter'):
            qs = qs.filter(file_type=self.file_type_filter)
        return qs
    
    def get_formset(self, request, obj=None, **kwargs):
        """Customize formset to handle multiple files and set default file_type"""
        formset = super().get_formset(request, obj, **kwargs)
        
        # Set file_type on the formset so it can be used during save and in formset initialization
        if hasattr(self, 'file_type_filter'):
            formset.file_type = self.file_type_filter
        
        # Store request in formset for use in save() method
        formset.request = request
        
        # Store request for use in preview
        self._request = request
        
        return formset


class GLBModelFileInline(DesignGLBFileInlineBase):
    """Inline admin for GLB Model files only"""
    file_type_filter = 'model'
    verbose_name = 'STEP/STP Model File'
    verbose_name_plural = 'STEP/STP Model Files (💡 Click "Choose Files" to upload multiple STEP/STP model files at once. Use Quick Delete button to delete individual files.)'


class GLBOriginalFileInline(DesignGLBFileInlineBase):
    """Inline admin for GLB Original files only"""
    file_type_filter = 'original'
    verbose_name = 'GLB Original File'
    verbose_name_plural = 'GLB Original Files (💡 Click "Choose Files" to upload multiple GLB original files at once. Use Quick Delete button to delete individual files.)'


# Keep the old inline for backward compatibility (shows all files)
class DesignGLBFileInline(DesignGLBFileInlineBase):
    """Inline admin for all GLB files (backward compatibility)"""
    verbose_name = 'GLB File'
    verbose_name_plural = 'GLB Files (All Types - Click "Choose Files" to upload multiple GLB files at once)'


@admin.register(ChimneyDesign)
class ChimneyDesignAdmin(admin.ModelAdmin):
    form = ChimneyDesignAdminForm
    list_display = ['title', 'category', 'has_model_file', 'has_thumbnail', 'glb_files_count', 'is_featured', 'is_active', 'created_at']
    list_filter = ['category', 'original_file_format', 'is_featured', 'is_active', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at', 'original_file_format', 'original_file_preview', 'model_file_preview', 'thumbnail_preview']
    actions = ['ensure_model_types', 'convert_step_files']
    inlines = [GLBModelFileInline, GLBOriginalFileInline]
    
    def get_object(self, request, object_id, from_field=None):
        """Override to handle deleted designs gracefully"""
        try:
            return super().get_object(request, object_id, from_field)
        except ChimneyDesign.DoesNotExist:
            from django.contrib import messages
            from django.http import Http404
            messages.error(request, f'Chimney design with ID "{object_id}" doesn\'t exist. It may have been deleted.')
            # Raise Http404 which Django admin will handle gracefully
            raise Http404(f'Chimney design with ID "{object_id}" doesn\'t exist. Perhaps it was deleted?')
    
    def get_form(self, request, obj=None, **kwargs):
        """Override to ensure form has proper encoding for file uploads"""
        form = super().get_form(request, obj, **kwargs)
        # Django admin automatically sets enctype="multipart/form-data" for forms with file fields
        # But we ensure it's properly configured
        return form
    
    def get_fieldsets(self, request, obj=None):
        """Generate fieldsets with dynamic model types description"""
        from .admin_helpers import MATERIAL_TYPE_MAPPING
        
        # Build model types list dynamically
        model_types_desc = 'IMPORTANT: Model types are automatically managed. Use the "Ensure all model types exist" action to create/update them.\n\n'
        model_types_desc += f'Valid Model Type Titles ({len(MODEL_TYPE_MAPPING)} types):\n'
        
        for idx, (model_type, title) in enumerate(MODEL_TYPE_MAPPING.items(), 1):
            material_type = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
            model_types_desc += f'{idx}. {title} - Material: {material_type}\n'
        
        model_types_desc += '\nNote: Model types are defined in MODEL_TYPE_MAPPING and will be created automatically when needed.'
        model_types_desc += '\nMaterial Types: Both Stainless Steel 202 (Sheet 202) and Stainless Steel 304 (Sheet 304) are used.'
        model_types_desc += '\nMain assemblies use Sheet 304 (premium), smaller parts use Sheet 202.'
        model_types_desc += '\nMaterial types can be changed in Design Specifications section.'
        
        return (
            ('Basic Information', {
                'fields': ('title', 'description', 'category', 'created_by'),
                'description': model_types_desc,
            }),
            ('3D Model Files (Legacy - DEPRECATED)', {
                'fields': ('original_file', 'original_file_preview', 'model_file', 'model_file_preview', 'original_file_format'),
                'description': '⚠️ DEPRECATED: These fields are kept for backward compatibility only.\n'
                             '💡 USE INSTEAD: The "STEP/STP Files" section below to upload multiple STEP/STP files.\n'
                             'These legacy fields will be removed in future versions.\n'
                             'Upload STEP (.step, .stp) files only.\n'
                             'STEP files will be automatically converted to GLB.',
                'classes': ('collapse',)  # Collapse by default
            }),
            ('Design Specifications', {
                'fields': ('width', 'height', 'depth', 'material_type', 'color')
            }),
            ('Pricing & Display', {
                'fields': ('price', 'thumbnail', 'thumbnail_preview', 'is_featured', 'is_active')
            }),
            ('Metadata', {
                'fields': ('model_data', 'created_at', 'updated_at'),
                'classes': ('collapse',)
            }),
        )
    
    def has_model_file(self, obj):
        """Display if model file exists"""
        if obj.model_file:
            return format_html('<span style="color: green;">✓ STEP</span>')
        return format_html('<span style="color: red;">✗ No file</span>')
    has_model_file.short_description = 'Model File'
    
    def has_thumbnail(self, obj):
        """Display if thumbnail exists"""
        if obj.thumbnail:
            return format_html('<span style="color: green;">✓ Image</span>')
        return format_html('<span style="color: gray;">-</span>')
    has_thumbnail.short_description = 'Thumbnail'
    
    def glb_files_count(self, obj):
        """Display count of GLB files"""
        if obj and obj.pk:
            try:
                count = DesignGLBFile.objects.filter(design=obj).count()
                if count > 0:
                    primary_count = DesignGLBFile.objects.filter(design=obj, is_primary=True).count()
                    return format_html(
                        '<span style="color: green;">✓ {} file(s)</span>{}',
                        count,
                        f' ({primary_count} primary)' if primary_count > 0 else ''
                    )
            except Exception as e:
                logger.warning(f'Error counting GLB files for design {obj.pk}: {str(e)}')
                return format_html('<span style="color: orange;">Error</span>')
        return format_html('<span style="color: gray;">0 files</span>')
    glb_files_count.short_description = 'STP Files'
    
    def original_file_preview(self, obj):
        """Show original file preview (supports GLB and STEP only) - shows all GLB files"""
        preview_html = []
        
        # Show legacy original_file if exists
        if obj.original_file:
            file_name = obj.original_file.name.lower()
            try:
                file_url = obj.original_file.url if hasattr(obj.original_file, 'url') else '#'
            except:
                from django.core.files.storage import default_storage
                file_url = default_storage.url(obj.original_file.name) if hasattr(obj.original_file, 'name') else '#'
            
            if file_name.endswith(('.glb', '.gltf', '.stp', '.step')):
                preview_html.append(format_html(
                    '<div style="margin-bottom: 10px;">'
                    '<a href="{}" target="_blank">📥 Download Original File</a><br/>'
                    '<small>File: {}</small>'
                    '</div>',
                    file_url,
                    obj.original_file.name
                ))
        
        # Show all GLB files from DesignGLBFile (original type)
        if obj and obj.pk:
            try:
                glb_files = DesignGLBFile.objects.filter(design=obj, file_type='original').order_by('order')
                if glb_files.exists():
                    preview_html.append(format_html('<strong>STEP/STP Files (Original):</strong><br/>'))
                    for glb_file in glb_files:
                        try:
                            from django.core.files.storage import default_storage
                            file_url = default_storage.url(glb_file.file.name) if hasattr(glb_file.file, 'name') else '#'
                            file_name = glb_file.file_name or (glb_file.file.name.split('/')[-1] if hasattr(glb_file.file, 'name') else 'unknown')
                            preview_html.append(format_html(
                                '<div style="margin-bottom: 5px;">'
                                '<a href="{}" target="_blank">📥 {}</a>'
                                '{}'
                                '</div>',
                                file_url,
                                file_name,
                                ' <span style="color: green;">(Primary)</span>' if glb_file.is_primary else ''
                            ))
                        except Exception as e:
                            logger.warning(f'Error getting GLB file URL: {str(e)}')
            except Exception as e:
                logger.warning(f'Error loading GLB files for design {obj.pk}: {str(e)}')
                preview_html.append(format_html('<small style="color: orange;">Error loading files</small>'))
        
        return format_html(''.join(preview_html)) if preview_html else "No original file uploaded"
    original_file_preview.short_description = 'Original File Preview'
    
    def model_file_preview(self, obj):
        """Show model file preview (supports GLB and STP/STEP only) - shows all GLB files"""
        preview_html = []
        
        # Show legacy model_file if exists
        if obj.model_file:
            file_name = obj.model_file.name.lower() if hasattr(obj.model_file, 'name') else str(obj.model_file).lower()
            
            # Get file URL - handle both FileField and string paths
            try:
                if hasattr(obj.model_file, 'url'):
                    file_url = obj.model_file.url
                elif hasattr(obj.model_file, 'name'):
                    from django.core.files.storage import default_storage
                    try:
                        file_url = default_storage.url(obj.model_file.name)
                    except:
                        file_url = f'/media/{obj.model_file.name}'
                else:
                    file_url = f'/media/{obj.model_file}'
            except Exception as e:
                logger.warning(f'Error getting file URL: {str(e)}')
                file_url = '#'
            
            if file_name.endswith(('.glb', '.gltf', '.stp', '.step')):
                preview_html.append(format_html(
                    '<div style="margin-bottom: 10px;">'
                    '<a href="{}" target="_blank">📥 Download Model File</a><br/>'
                    '<small>File: {}</small>'
                    '</div>',
                    file_url,
                    obj.model_file.name if hasattr(obj.model_file, 'name') else str(obj.model_file)
                ))
        
        # Show all GLB files from DesignGLBFile (model type)
        if obj and obj.pk:
            try:
                glb_files = DesignGLBFile.objects.filter(design=obj, file_type='model').order_by('order')
                if glb_files.exists():
                    preview_html.append(format_html('<strong>STEP/STP Files (Model):</strong><br/>'))
                    for glb_file in glb_files:
                        try:
                            from django.core.files.storage import default_storage
                            file_url = default_storage.url(glb_file.file.name) if hasattr(glb_file.file, 'name') else '#'
                            file_name = glb_file.file_name or (glb_file.file.name.split('/')[-1] if hasattr(glb_file.file, 'name') else 'unknown')
                            preview_html.append(format_html(
                                '<div style="margin-bottom: 5px;">'
                                '<a href="{}" target="_blank">📥 {}</a>'
                                '{}'
                                '</div>',
                                file_url,
                                file_name,
                                ' <span style="color: green;">(Primary)</span>' if glb_file.is_primary else ''
                            ))
                        except Exception as e:
                            logger.warning(f'Error getting GLB file URL: {str(e)}')
            except Exception as e:
                logger.warning(f'Error loading GLB files for design {obj.pk}: {str(e)}')
                preview_html.append(format_html('<small style="color: orange;">Error loading files</small>'))
        
        return format_html(''.join(preview_html)) if preview_html else "No model file uploaded"
    model_file_preview.short_description = 'Model File Preview'
    
    def thumbnail_preview(self, obj):
        """Show thumbnail preview"""
        if obj.thumbnail:
            return format_html(
                '<img src="{}" style="max-width: 200px; max-height: 200px; object-fit: contain; border: 1px solid #ddd; padding: 5px; background: white;" /><br/>'
                '<a href="{}" target="_blank">View Full Image</a><br/>'
                '<small>File: {}</small>',
                obj.thumbnail.url if hasattr(obj.thumbnail, 'url') else '#',
                obj.thumbnail.url if hasattr(obj.thumbnail, 'url') else '#',
                obj.thumbnail.name
            )
        return "No thumbnail uploaded"
    thumbnail_preview.short_description = 'Thumbnail Preview'
    
    def save_formset(self, request, form, formset, change):
        """Handle saving inline GLB files and multiple file uploads"""
        if formset.model == DesignGLBFile:
            design = form.instance
            saved_count = 0
            
            # Get file_type from the formset (set by get_formset)
            file_type = getattr(formset, 'file_type', 'model')
            
            # Initialize formset attributes required by Django admin's construct_change_message
            # These are normally populated by formset.save(commit=False), but we ensure they exist
            if not hasattr(formset, 'new_objects'):
                formset.new_objects = []
            if not hasattr(formset, 'changed_objects'):
                formset.changed_objects = []
            if not hasattr(formset, 'deleted_objects'):
                formset.deleted_objects = []
            
            # Call formset.save(commit=False) to populate new_objects, changed_objects, deleted_objects
            # This is required for Django admin's construct_change_message to work
            # Empty forms will be skipped automatically by Django's formset handling
            instances = []
            try:
                # Call save(commit=False) - this populates new_objects, changed_objects, deleted_objects
                # Django will skip empty forms automatically
                instances = formset.save(commit=False)
                # Ensure attributes are set (in case save() didn't set them)
                # Django expects changed_objects to be list of (object, [changed_fields]) tuples
                if not hasattr(formset, 'new_objects') or formset.new_objects is None:
                    formset.new_objects = [inst for inst in instances if not inst.pk]
                if not hasattr(formset, 'changed_objects') or formset.changed_objects is None:
                    # Convert to tuples if needed
                    changed_list = []
                    for inst in instances:
                        if inst.pk:
                            # Find the form for this instance to get changed_fields
                            changed_fields = []
                            for form_instance in formset.forms:
                                if form_instance.instance.pk == inst.pk:
                                    if hasattr(form_instance, 'changed_data'):
                                        changed_fields = form_instance.changed_data
                                    break
                            changed_list.append((inst, changed_fields))
                    formset.changed_objects = changed_list
            except Exception as e:
                # If save fails due to validation, ensure attributes still exist
                logger.warning(f'Error in formset.save(commit=False): {str(e)}')
                # Ensure attributes exist for Django admin compatibility
                if not hasattr(formset, 'new_objects') or formset.new_objects is None:
                    formset.new_objects = []
                if not hasattr(formset, 'changed_objects') or formset.changed_objects is None:
                    formset.changed_objects = []
                if not hasattr(formset, 'deleted_objects') or formset.deleted_objects is None:
                    formset.deleted_objects = []
            except Exception:
                instances = []
            
            # Process instances that were created/updated by formset.save(commit=False)
            for instance in instances:
                # Ensure design is set
                if not instance.design_id:
                    instance.design = design
                
                # Set file_type from formset (ensures correct type based on which inline is used)
                instance.file_type = file_type
                
                # Auto-set file_name from uploaded file if not provided
                if not instance.file_name and instance.file:
                    if hasattr(instance.file, 'name'):
                        # Extract original filename from uploaded file
                        original_name = instance.file.name.split('/')[-1]
                        # Remove UUID prefix if present
                        if '_' in original_name:
                            parts = original_name.split('_', 1)
                            if len(parts) > 1 and len(parts[0]) == 36:  # UUID length
                                instance.file_name = parts[1]
                            else:
                                instance.file_name = original_name
                        else:
                            instance.file_name = original_name
                    elif isinstance(instance.file, str):
                        instance.file_name = instance.file.split('/')[-1]
                
                # Auto-set order if not provided
                if instance.order == 0:
                    from django.db.models import Max
                    max_order = DesignGLBFile.objects.filter(design=instance.design).aggregate(
                        max_order=Max('order')
                    )['max_order'] or 0
                    instance.order = max_order + 1
                
                # Ensure primary file is set correctly (only for model files)
                if instance.file_type == 'model':
                    existing_primary = DesignGLBFile.objects.filter(
                        design=instance.design, 
                        is_primary=True, 
                        file_type='model'
                    ).exclude(pk=instance.pk if instance.pk else None).exists()
                    if not existing_primary:
                        instance.is_primary = True
                    elif instance.is_primary and existing_primary:
                        # If user explicitly set this as primary, unset others
                        DesignGLBFile.objects.filter(
                            design=instance.design,
                            is_primary=True,
                            file_type='model'
                        ).exclude(pk=instance.pk if instance.pk else None).update(is_primary=False)
                
                # Save the instance
                instance.save()
                saved_count += 1
                logger.info(f'Saved DesignGLBFile: ID={instance.id}, file={instance.file_name}, type={instance.file_type}')
            
            # Process forms manually to handle multiple files from single file input
            # This handles cases where multiple files are selected in one file input
            processed_instances = set(inst.pk for inst in instances if inst.pk)
            
            for form_instance in formset.forms:
                # Skip forms already processed
                if form_instance.instance.pk and form_instance.instance.pk in processed_instances:
                    continue
                
                # Skip deleted forms
                deleted_forms = getattr(formset, 'deleted_forms', [])
                if form_instance in deleted_forms:
                    continue
                
                # Check for files in request.FILES (handles multiple files from single input)
                form_prefix = form_instance.prefix
                file_key = f'{form_prefix}-file'
                
                # Get files from request.FILES (handles multiple files from single input)
                files_to_process = []
                if hasattr(request, 'FILES') and request.FILES:
                    if file_key in request.FILES:
                        file_obj = request.FILES[file_key]
                        # Handle both single file and list of files
                        if isinstance(file_obj, list):
                            files_to_process = [f for f in file_obj if f]  # Filter out None/empty
                        elif file_obj:  # Single file
                            files_to_process = [file_obj]
                
                # Process each file separately (creates one instance per file)
                for idx, file_obj in enumerate(files_to_process):
                    if not file_obj:
                        continue
                    
                    try:
                        # For multiple files, create a new instance for each file (except first one uses existing form instance)
                        if idx == 0 and not form_instance.instance.pk:
                            # First file uses the form's instance
                            instance = DesignGLBFile(design=design)
                        elif idx == 0 and form_instance.instance.pk:
                            # First file updates existing instance
                            instance = form_instance.instance
                        else:
                            # Additional files get new instances
                            instance = DesignGLBFile(design=design)
                        
                        # Set file
                        instance.file = file_obj
                        
                        # Set file_type
                        instance.file_type = file_type
                        
                        # Auto-set file_name from uploaded file
                        if instance.file:
                            if hasattr(instance.file, 'name'):
                                original_name = instance.file.name.split('/')[-1]
                                # Remove UUID prefix if present
                                if '_' in original_name:
                                    parts = original_name.split('_', 1)
                                    if len(parts) > 1 and len(parts[0]) == 36:  # UUID length
                                        instance.file_name = parts[1]
                                    else:
                                        instance.file_name = original_name
                                else:
                                    instance.file_name = original_name
                        
                        # Auto-set order if not provided
                        if instance.order == 0:
                            from django.db.models import Max
                            max_order = DesignGLBFile.objects.filter(design=instance.design).aggregate(
                                max_order=Max('order')
                            )['max_order'] or 0
                            instance.order = max_order + idx + 1
                        
                        # Ensure primary file is set correctly (only for model files)
                        if instance.file_type == 'model':
                            existing_primary = DesignGLBFile.objects.filter(
                                design=instance.design, 
                                is_primary=True, 
                                file_type='model'
                            ).exclude(pk=instance.pk if instance.pk else None).exists()
                            if not existing_primary and idx == 0:  # Only first file can be primary
                                instance.is_primary = True
                            else:
                                instance.is_primary = False
                        
                        # Save the instance
                        instance.save()
                        saved_count += 1
                        if instance.pk:
                            processed_instances.add(instance.pk)
                        
                        # Add to formset attributes for Django admin
                        # Django expects changed_objects to be list of (object, [changed_fields]) tuples
                        if instance.pk:
                            # Check if instance already in changed_objects
                            instance_ids = [obj[0].pk if isinstance(obj, tuple) else obj.pk for obj in formset.changed_objects]
                            if instance.pk not in instance_ids:
                                changed_fields = []
                                # Try to get changed fields from form if available
                                if hasattr(form_instance, 'changed_data'):
                                    changed_fields = form_instance.changed_data
                                formset.changed_objects.append((instance, changed_fields))
                        else:
                            if instance not in formset.new_objects:
                                formset.new_objects.append(instance)
                        
                        logger.info(f'Saved DesignGLBFile (file {idx+1}/{len(files_to_process)}): ID={instance.id}, file={instance.file_name}, type={instance.file_type}')
                    except Exception as e:
                        logger.warning(f'Error saving file {file_obj.name if hasattr(file_obj, "name") else "unknown"}: {str(e)}')
                        import traceback
                        logger.error(traceback.format_exc())
                        continue
            
            # Delete marked for deletion (files selected via DELETE checkbox)
            # Note: Since can_delete=False, we don't use DELETE checkbox, but handle deletions via Quick Delete button
            # However, Django might still mark some forms for deletion, so we check safely
            deleted_files = []
            try:
                # Try to get deleted_objects - it's only populated after formset.save(commit=False)
                # Since we're processing manually, we need to check forms marked for deletion
                deleted_forms = getattr(formset, 'deleted_forms', [])
                for form_instance in deleted_forms:
                    if form_instance.instance.pk:
                        obj = form_instance.instance
                        # Store file info before deletion
                        file_name = obj.file_name or (obj.file.name.split('/')[-1] if hasattr(obj.file, 'name') and obj.file.name else 'Unknown')
                        file_path = obj.file.name if obj.file else None
                        
                        # Delete the physical file from storage
                        if file_path:
                            try:
                                from django.core.files.storage import default_storage
                                if default_storage.exists(file_path):
                                    default_storage.delete(file_path)
                                    logger.info(f'Deleted physical file: {file_path}')
                            except Exception as e:
                                logger.warning(f'Error deleting physical file {file_path}: {str(e)}')
                        
                        # Delete the database record
                        obj.delete()
                        deleted_files.append(file_name)
                        logger.info(f'Deleted DesignGLBFile: ID={obj.id}, File: {file_name}')
            except AttributeError:
                # If deleted_forms doesn't exist, that's fine - no deletions to process
                pass
            
            if saved_count > 0 or deleted_files:
                from django.contrib import messages
                deleted_count = len(deleted_files)
                if saved_count > 0 and deleted_count > 0:
                    files_list = ', '.join(deleted_files[:3])  # Show first 3 files
                    if deleted_count > 3:
                        files_list += f' and {deleted_count - 3} more'
                    messages.success(request, f'Successfully saved {saved_count} GLB file(s) and deleted {deleted_count} file(s): {files_list}')
                elif saved_count > 0:
                    messages.success(request, f'Successfully saved {saved_count} GLB file(s)')
                elif deleted_count > 0:
                    files_list = ', '.join(deleted_files[:3])  # Show first 3 files
                    if deleted_count > 3:
                        files_list += f' and {deleted_count - 3} more'
                    messages.success(request, f'Successfully deleted {deleted_count} GLB file(s): {files_list}')
                
                # Refresh model types cache if this is a model type design
                try:
                    from .admin_helpers import MODEL_TYPE_MAPPING, get_model_type_from_title
                    model_type = get_model_type_from_title(design.title)
                    if model_type:
                        # Clear any caches that might exist
                        logger.info(f'GLB files uploaded for model type: {model_type}, design: {design.title}')
                except Exception as e:
                    logger.warning(f'Error refreshing model types: {str(e)}')
        else:
            super().save_formset(request, form, formset, change)
    
    def save_model(self, request, obj, form, change):
        """Handle file upload and conversion (STEP to GLB) when saving from admin"""
        from .utils import convert_step_to_glb
        from django.conf import settings
        from django.core.files.storage import default_storage
        from .admin_helpers import get_model_type_from_title, MODEL_TYPE_MAPPING
        from .models import DesignGLBFile  # Import at top level to avoid UnboundLocalError
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Set created_by if not set
        if not change and not obj.created_by:
            obj.created_by = request.user
        
        # Detect model type change (if title changed)
        old_model_type = None
        new_model_type = None
        if change and obj.pk and 'title' in form.changed_data:
            # Get old title from database (before saving)
            try:
                old_obj = ChimneyDesign.objects.get(pk=obj.pk)
                old_model_type = get_model_type_from_title(old_obj.title)
                new_model_type = get_model_type_from_title(obj.title)
            except ChimneyDesign.DoesNotExist:
                # Object doesn't exist yet, skip
                old_model_type = None
                new_model_type = None
            
            # If model type changed, remove old GLB files
            if old_model_type and new_model_type and old_model_type != new_model_type:
                logger.info(f'Model type changed from {old_model_type} to {new_model_type} for design {obj.pk}')
                # DesignGLBFile is already imported at the top of the method
                
                # Get all GLB files for this design
                old_glb_files = DesignGLBFile.objects.filter(design=obj)
                deleted_count = old_glb_files.count()
                
                # Delete the files from storage and database
                for glb_file in old_glb_files:
                    try:
                        # Delete file from storage
                        if glb_file.file:
                            if hasattr(glb_file.file, 'name'):
                                file_path = glb_file.file.name
                            elif isinstance(glb_file.file, str):
                                file_path = glb_file.file
                            else:
                                file_path = None
                            
                            if file_path:
                                try:
                                    default_storage.delete(file_path)
                                    logger.info(f'Deleted file from storage: {file_path}')
                                except Exception as e:
                                    logger.warning(f'Error deleting file {file_path}: {str(e)}')
                    except Exception as e:
                        logger.warning(f'Error processing file deletion: {str(e)}')
                
                # Delete all DesignGLBFile records
                old_glb_files.delete()
                
                # Clear legacy file fields
                obj.model_file = None
                obj.original_file = None
                obj.original_file_format = None
                
                # Update material type if needed (based on new model type)
                from .admin_helpers import MATERIAL_TYPE_MAPPING
                new_material = MATERIAL_TYPE_MAPPING.get(new_model_type)
                if new_material and obj.material_type != new_material:
                    old_material = obj.material_type or '(not set)'
                    obj.material_type = new_material
                    logger.info(f'Updated material_type from {old_material} to {new_material} for new model type {new_model_type}')
                
                from django.contrib import messages
                messages.warning(
                    request, 
                    f'Model type changed from "{MODEL_TYPE_MAPPING.get(old_model_type, old_model_type)}" to "{MODEL_TYPE_MAPPING.get(new_model_type, new_model_type)}". '
                    f'Removed {deleted_count} old GLB file(s). Please upload new files for the new model type.'
                )
                logger.info(f'Removed {deleted_count} GLB files due to model type change from {old_model_type} to {new_model_type}')
        
        # Store files to process after saving
        original_files_to_process = []
        model_files_to_process = []
        
        # Handle multiple original_file uploads (legacy field)
        if 'original_file' in form.changed_data:
            # Get multiple files from request
            uploaded_files = []
            if hasattr(request.FILES, 'getlist'):
                uploaded_files = request.FILES.getlist('original_file')
            elif obj.original_file:
                uploaded_files = [obj.original_file] if not isinstance(obj.original_file, list) else obj.original_file
            
            # Store files to process after saving
            original_files_to_process = uploaded_files
            
            # Set original_file_format if files are uploaded
            if uploaded_files:
                first_filename = uploaded_files[0].name.lower() if hasattr(uploaded_files[0], 'name') else ''
                if first_filename.endswith(('.stp', '.step')):
                    obj.original_file_format = 'STEP'
                elif first_filename.endswith(('.glb', '.gltf')):
                    obj.original_file_format = 'GLB'
        
        # Handle multiple model_file uploads (legacy field) - store for processing
        if 'model_file' in form.changed_data:
            # Get multiple files from request
            uploaded_files = []
            if hasattr(request.FILES, 'getlist'):
                uploaded_files = request.FILES.getlist('model_file')
            elif obj.model_file:
                uploaded_files = [obj.model_file] if not isinstance(obj.model_file, list) else obj.model_file
            
            # Store files to process after saving
            model_files_to_process = uploaded_files
        
        # Save the object first (so it has a PK)
        super().save_model(request, obj, form, change)
        
        # Now process original_file uploads and create DesignGLBFile records
        if original_files_to_process:
            from django.db.models import Max
            max_order = DesignGLBFile.objects.filter(design=obj).aggregate(
                max_order=Max('order')
            )['max_order'] or 0
            
            has_primary = DesignGLBFile.objects.filter(design=obj, is_primary=True).exists()
            
            for idx, file_obj in enumerate(original_files_to_process):
                if file_obj:
                    filename = file_obj.name.lower()
                    
                    # Detect file type and convert
                    if filename.endswith(('.stp', '.step')):
                        obj.original_file_format = 'STEP'
                        
                        # Convert STEP to GLB
                        try:
                            # Save original file first
                            original_path = default_storage.save(f'models/original/{file_obj.name}', file_obj)
                            
                            # Generate GLB filename
                            glb_filename = os.path.splitext(file_obj.name)[0] + '.glb'
                            glb_output_path = os.path.join(settings.MEDIA_ROOT, 'models', os.path.basename(glb_filename))
                            os.makedirs(os.path.dirname(glb_output_path), exist_ok=True)
                            
                            # Convert STEP to GLB
                            converted_path = convert_step_to_glb(default_storage.path(original_path), glb_output_path)
                            
                            if converted_path and os.path.exists(converted_path):
                                # Save converted GLB file
                                with open(converted_path, 'rb') as glb_file:
                                    glb_saved_path = default_storage.save(f'models/{os.path.basename(glb_filename)}', glb_file)
                                    
                                    # Create DesignGLBFile record
                                    DesignGLBFile.objects.create(
                                        design=obj,
                                        file=glb_saved_path,
                                        file_type='original',
                                        file_name=os.path.basename(glb_filename),
                                        is_primary=(idx == 0 and not has_primary),
                                        order=max_order + idx + 1
                                    )
                                    if idx == 0:
                                        has_primary = True
                                    
                                    # Set original_file for backward compatibility (only first file)
                                    if idx == 0 and not obj.original_file:
                                        obj.original_file = glb_saved_path
                                    
                                    logger.info(f'Converted STEP to GLB: {glb_saved_path}')
                        except Exception as e:
                            logger.error(f'Error converting STEP to GLB: {str(e)}')
                            import traceback
                            logger.error(traceback.format_exc())
                    
                    elif filename.endswith(('.glb', '.gltf')):
                        obj.original_file_format = 'GLB'
                        # Save GLB file and create DesignGLBFile record
                        try:
                            saved_path = default_storage.save(f'models/{file_obj.name}', file_obj)
                            
                            # Create DesignGLBFile record with file_type='original' for original_file field
                            if obj.pk:
                                DesignGLBFile.objects.create(
                                    design=obj,
                                    file=saved_path,
                                    file_type='original',  # Fixed: should be 'original' not 'model'
                                    file_name=file_obj.name,
                                    is_primary=(idx == 0 and not has_primary),
                                    order=max_order + idx + 1
                                )
                                if idx == 0:
                                    has_primary = True
                            
                            # Set original_file for backward compatibility (only first file)
                            if idx == 0 and not obj.original_file:
                                obj.original_file = saved_path
                            
                            logger.info(f'Uploaded GLB file (original): {saved_path}')
                        except Exception as e:
                            logger.error(f'Error uploading GLB file: {str(e)}')
                    
                    # Image formats are not supported
                    elif filename.endswith(('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp')):
                        logger.warning(f'Image format not supported: {filename}. Only GLB and STP/STEP formats are allowed.')
                        continue  # Skip this file
        
        # Now process model_file uploads and create DesignGLBFile records
        if model_files_to_process:
            from django.db.models import Max
            max_order = DesignGLBFile.objects.filter(design=obj).aggregate(
                max_order=Max('order')
            )['max_order'] or 0
            
            has_primary = DesignGLBFile.objects.filter(design=obj, is_primary=True).exists()
            
            for idx, file_obj in enumerate(model_files_to_process):
                if file_obj:
                    filename = file_obj.name.lower()
                    if filename.endswith(('.glb', '.gltf')):
                        if not obj.original_file_format:
                            obj.original_file_format = 'GLB'
                        
                        # Save GLB file and create DesignGLBFile record
                        try:
                            saved_path = default_storage.save(f'models/{file_obj.name}', file_obj)
                            
                            # Create DesignGLBFile record
                            DesignGLBFile.objects.create(
                                design=obj,
                                file=saved_path,
                                file_type='model',
                                file_name=file_obj.name,
                                is_primary=(idx == 0 and not has_primary),
                                order=max_order + idx + 1
                            )
                            if idx == 0:
                                has_primary = True
                            
                            # Set model_file for backward compatibility (only first file)
                            if idx == 0:
                                obj.model_file = saved_path
                                obj.save(update_fields=['model_file'])  # Save the model_file field
                            
                            logger.info(f'Uploaded GLB file via model_file: {saved_path}')
                        except Exception as e:
                            logger.error(f'Error uploading GLB file: {str(e)}')
                    elif filename.endswith(('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp')):
                        logger.warning(f'Image format not supported for model_file: {filename}. Only GLB and STEP formats are allowed.')
                        continue  # Skip this file
                    elif filename.endswith(('.stp', '.step')):
                        if not obj.original_file_format:
                            obj.original_file_format = 'STEP'
                            obj.save(update_fields=['original_file_format'])  # Save the format
    
    @admin.action(description='Ensure all model types exist')
    def ensure_model_types(self, request, queryset):
        """Admin action to create/ensure all model types exist"""
        from .admin_helpers import ensure_model_type_designs
        
        results = ensure_model_type_designs()
        created = sum(1 for r in results if r['action'] == 'created')
        reactivated = sum(1 for r in results if r['action'] == 'reactivated')
        exists = sum(1 for r in results if r['action'] == 'exists')
        
        self.message_user(
            request,
            f'Model types setup complete: {created} created, {reactivated} reactivated, {exists} already exist.'
        )
    
    @admin.action(description='Convert STEP files to GLB')
    def convert_step_files(self, request, queryset):
        """Admin action to convert STEP files to GLB"""
        from .utils import convert_step_to_glb
        from django.conf import settings
        from django.core.files.storage import default_storage
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        converted = 0
        failed = 0
        
        for design in queryset:
            if design.original_file and design.original_file.name.lower().endswith(('.stp', '.step')):
                try:
                    original_path = default_storage.path(design.original_file.name)
                    glb_filename = os.path.splitext(design.original_file.name)[0] + '.glb'
                    glb_output_path = os.path.join(settings.MEDIA_ROOT, 'models', os.path.basename(glb_filename))
                    os.makedirs(os.path.dirname(glb_output_path), exist_ok=True)
                    
                    converted_path = convert_step_to_glb(original_path, glb_output_path)
                    
                    if converted_path and os.path.exists(converted_path):
                        with open(converted_path, 'rb') as glb_file:
                            glb_saved_path = default_storage.save(f'models/{os.path.basename(glb_filename)}', glb_file)
                            design.model_file = glb_saved_path
                            design.save()
                            converted += 1
                    else:
                        failed += 1
                except Exception as e:
                    logger.error(f'Error converting {design.title}: {str(e)}')
                    failed += 1
        
        self.message_user(
            request,
            f'Conversion complete: {converted} converted, {failed} failed.'
        )


class UserProjectAdminForm(forms.ModelForm):
    """Custom form for UserProject with better JSON field help"""
    
    class Meta:
        model = UserProject
        fields = '__all__'
        widgets = {
            'design_data': forms.Textarea(attrs={
                'rows': 10,
                'cols': 80,
                'style': 'font-family: monospace; font-size: 12px;',
                'placeholder': '{\n  "width": 1.5,\n  "height": 2.0,\n  "depth": 0.8,\n  "material": "brick",\n  "color": "#FF5733",\n  "style": "modern",\n  "texture": "rough",\n  "finish": "matte"\n}'
            }),
            'model_data': forms.Textarea(attrs={
                'rows': 10,
                'cols': 80,
                'style': 'font-family: monospace; font-size: 12px;',
            }),
        }
        help_texts = {
            'design_data': 'Enter valid JSON. Example structure: {"width": 1.5, "height": 2.0, "depth": 0.8, "material": "brick", "color": "#FF5733", "style": "modern"}',
            'model_data': 'Enter valid JSON for 3D model geometry data (vertices, faces, normals, etc.)',
        }


@admin.register(UserProject)
class UserProjectAdmin(admin.ModelAdmin):
    form = UserProjectAdminForm
    list_display = ['thumbnail_preview', 'name', 'user', 'is_public', 'created_at', 'updated_at']
    list_filter = ['is_public', 'created_at']
    search_fields = ['name', 'user__username']
    readonly_fields = ['created_at', 'updated_at', 'thumbnail_preview']
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'name', 'description', 'base_design')
        }),
        ('3D Design Data', {
            'fields': ('design_data', 'model_data'),
            'description': 'design_data stores the 3D design configuration (dimensions, materials, colors, etc.). '
                          'Example: {"width": 1.5, "height": 2.0, "depth": 0.8, "material": "brick", "color": "#FF5733", "style": "modern"}. '
                          'model_data stores the 3D model geometry and mesh information. '
                          'Thumbnail will be automatically generated when design_data or model_data changes.'
        }),
        ('Thumbnail', {
            'fields': ('thumbnail', 'thumbnail_preview'),
            'description': 'Thumbnail is automatically generated from design_data. You can regenerate it by saving the project after modifying design_data.'
        }),
        ('Settings', {
            'fields': ('is_public',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def thumbnail_preview(self, obj):
        """Display thumbnail preview in admin"""
        if obj.thumbnail:
            return format_html('<img src="{}" style="max-width: 100px; max-height: 100px;" />', obj.thumbnail.url)
        return "No thumbnail"
    thumbnail_preview.short_description = 'Thumbnail'
    
    def save_model(self, request, obj, form, change):
        """Handle thumbnail regeneration if needed"""
        # The save() method in the model will handle thumbnail generation
        super().save_model(request, obj, form, change)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer_name', 'design', 'total_price', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['customer_name', 'customer_email']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'subject', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    search_fields = ['name', 'email', 'subject']
    readonly_fields = ['created_at']


@admin.register(DesignGLBFile)
class DesignGLBFileAdmin(admin.ModelAdmin):
    list_display = ['design', 'file_name', 'file_type', 'is_primary', 'order', 'created_at']
    list_filter = ['file_type', 'is_primary', 'created_at']
    search_fields = ['design__title', 'file_name']
    readonly_fields = ['created_at', 'updated_at', 'file_preview']
    ordering = ['design', 'order', '-created_at']
    
    fieldsets = (
        ('File Information', {
            'fields': ('design', 'file', 'file_name', 'file_type', 'file_preview')
        }),
        ('Settings', {
            'fields': ('is_primary', 'order')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def file_preview(self, obj):
        """Show file preview with download link"""
        if obj.file:
            try:
                from django.core.files.storage import default_storage
                file_url = default_storage.url(obj.file.name) if hasattr(obj.file, 'name') else '#'
                file_name = obj.file_name or (obj.file.name.split('/')[-1] if hasattr(obj.file, 'name') else str(obj.file))
                
                return format_html(
                    '<a href="{}" target="_blank">View/Download GLB File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    file_name
                )
            except Exception as e:
                logger.warning(f'Error getting file URL: {str(e)}')
                return format_html('<small>Error loading file</small>')
        return "No file uploaded"
    file_preview.short_description = 'File Preview'

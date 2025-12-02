from django.contrib import admin
from django import forms
from django.utils.html import format_html
import logging
from .models import Category, ChimneyDesign, UserProject, Order, ContactMessage

logger = logging.getLogger(__name__)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name', 'description']


@admin.register(ChimneyDesign)
class ChimneyDesignAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'has_model_file', 'has_thumbnail', 'is_featured', 'is_active', 'created_at']
    list_filter = ['category', 'original_file_format', 'is_featured', 'is_active', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at', 'original_file_format', 'original_file_preview', 'model_file_preview', 'thumbnail_preview']
    actions = ['ensure_model_types', 'convert_step_files']
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'category', 'created_by'),
            'description': 'IMPORTANT: Use exact titles for the 8 model types:\n'
                         '1. Wall Mounted Single Skin\n'
                         '2. Wall Mounted Single Plenum\n'
                         '3. Wall-Mounted Double Skin\n'
                         '4. Wall-Mounted Compensating\n'
                         '5. UV Compensating\n'
                         '6. Island Single Skin\n'
                         '7. Island Double Skin\n'
                         '8. Island Compensating'
        }),
        ('3D Model Files', {
            'fields': ('original_file', 'original_file_preview', 'model_file', 'model_file_preview', 'original_file_format'),
            'description': 'Upload GLB (.glb, .gltf) or STEP (.step, .stp) files only.\n'
                         'STEP files will be automatically converted to GLB.\n'
                         'The model_file field will be automatically set after conversion.'
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
            return format_html('<span style="color: green;">✓ GLB</span>')
        return format_html('<span style="color: red;">✗ No file</span>')
    has_model_file.short_description = 'Model File'
    
    def has_thumbnail(self, obj):
        """Display if thumbnail exists"""
        if obj.thumbnail:
            return format_html('<span style="color: green;">✓ Image</span>')
        return format_html('<span style="color: gray;">-</span>')
    has_thumbnail.short_description = 'Thumbnail'
    
    def original_file_preview(self, obj):
        """Show original file preview (supports GLB and STEP only)"""
        if obj.original_file:
            file_name = obj.original_file.name.lower()
            file_url = obj.original_file.url if hasattr(obj.original_file, 'url') else '#'
            
            # Check file type and show appropriate preview (only GLB and STEP supported)
            if file_name.endswith(('.glb', '.gltf')):
                # GLB/GLTF files - show download link
                return format_html(
                    '<a href="{}" target="_blank">View/Download Original GLB File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    obj.original_file.name
                )
            elif file_name.endswith(('.stp', '.step')):
                # STEP files - show download link
                return format_html(
                    '<a href="{}" target="_blank">View/Download Original STEP File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    obj.original_file.name
                )
            else:
                # Other files - generic preview
                return format_html(
                    '<a href="{}" target="_blank">View/Download Original File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    obj.original_file.name
                )
        return "No original file uploaded"
    original_file_preview.short_description = 'Original File Preview'
    
    def model_file_preview(self, obj):
        """Show model file preview (supports GLB and STP/STEP only)"""
        if obj.model_file:
            file_name = obj.model_file.name.lower()
            
            # Get file URL - handle both FileField and string paths
            try:
                if hasattr(obj.model_file, 'url'):
                    file_url = obj.model_file.url
                elif hasattr(obj.model_file, 'name'):
                    from django.conf import settings
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
            
            # Check file type and show appropriate preview (only GLB and STEP supported)
            if file_name.endswith(('.glb', '.gltf')):
                # GLB/GLTF files - show download link
                return format_html(
                    '<a href="{}" target="_blank">View/Download GLB File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    obj.model_file.name if hasattr(obj.model_file, 'name') else str(obj.model_file)
                )
            elif file_name.endswith(('.stp', '.step')):
                # STEP files - show download link
                return format_html(
                    '<a href="{}" target="_blank">View/Download STEP File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    obj.model_file.name if hasattr(obj.model_file, 'name') else str(obj.model_file)
                )
            else:
                # Other files - generic preview
                return format_html(
                    '<a href="{}" target="_blank">View/Download File</a><br/>'
                    '<small>File: {}</small>',
                    file_url,
                    obj.model_file.name if hasattr(obj.model_file, 'name') else str(obj.model_file)
                )
        return "No model file uploaded"
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
    
    def save_model(self, request, obj, form, change):
        """Handle file upload and conversion (STEP to GLB) when saving from admin"""
        from .utils import convert_step_to_glb
        from django.conf import settings
        from django.core.files.storage import default_storage
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Set created_by if not set
        if not change and not obj.created_by:
            obj.created_by = request.user
        
        # Handle original_file upload (STEP/STP files only - PNG/SVG not supported)
        if 'original_file' in form.changed_data and obj.original_file:
            filename = obj.original_file.name.lower()
            
            # Detect file type and convert
            if filename.endswith(('.stp', '.step')):
                obj.original_file_format = 'STEP'
                
                # Convert STEP to GLB
                try:
                    original_path = default_storage.path(obj.original_file.name)
                    
                    # Generate GLB filename
                    glb_filename = os.path.splitext(obj.original_file.name)[0] + '.glb'
                    glb_output_path = os.path.join(settings.MEDIA_ROOT, 'models', os.path.basename(glb_filename))
                    os.makedirs(os.path.dirname(glb_output_path), exist_ok=True)
                    
                    # Convert STEP to GLB
                    converted_path = convert_step_to_glb(original_path, glb_output_path)
                    
                    if converted_path and os.path.exists(converted_path):
                        # Save converted GLB file
                        with open(converted_path, 'rb') as glb_file:
                            glb_saved_path = default_storage.save(f'models/{os.path.basename(glb_filename)}', glb_file)
                            obj.model_file = glb_saved_path
                            logger.info(f'Converted STEP to GLB: {glb_saved_path}')
                    else:
                        logger.warning(f'STEP to GLB conversion failed for {obj.original_file.name}')
                except Exception as e:
                    logger.error(f'Error converting STEP to GLB: {str(e)}')
                    import traceback
                    logger.error(traceback.format_exc())
            
            # Image formats are not supported - only STP and GLB allowed
            elif filename.endswith(('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp')):
                # Reject image formats
                logger.warning(f'Image format not supported: {filename}. Only GLB and STP/STEP formats are allowed.')
                raise ValueError(f'Image formats are not supported. Please upload a GLB (.glb, .gltf) or STEP (.stp, .step) file.')
            
            elif filename.endswith(('.glb', '.gltf')):
                obj.original_file_format = 'GLB'
                # If GLB is uploaded as original_file, also set it as model_file
                obj.model_file = obj.original_file
        
        # Handle direct model_file upload (GLB and STEP files only - PNG/SVG not supported)
        if 'model_file' in form.changed_data and obj.model_file:
            filename = obj.model_file.name.lower()
            if filename.endswith(('.glb', '.gltf')):
                if not obj.original_file_format:
                    obj.original_file_format = 'GLB'
            elif filename.endswith(('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp')):
                # Reject image formats for model_file
                logger.warning(f'Image format not supported for model_file: {filename}. Only GLB and STEP formats are allowed.')
                raise ValueError(f'Image formats are not supported for model files. Please upload a GLB (.glb, .gltf) or STEP (.stp, .step) file.')
            elif filename.endswith(('.stp', '.step')):
                if not obj.original_file_format:
                    obj.original_file_format = 'STEP'
        
        # Ensure original_file_format is saved
        super().save_model(request, obj, form, change)
    
    @admin.action(description='Ensure all 8 model types exist')
    def ensure_model_types(self, request, queryset):
        """Admin action to create/ensure all 8 model types exist"""
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

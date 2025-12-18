from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Category(models.Model):
    """Category for chimney designs"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']
    
    def __str__(self):
        return self.name


class ChimneyDesign(models.Model):
    """3D Chimney Design Model"""
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    
    # 3D Model data
    model_file = models.FileField(upload_to='models/', blank=True, null=True, help_text="Model file (GLB or STEP format only)")
    original_file = models.FileField(upload_to='models/original/', blank=True, null=True, help_text="Original uploaded file (GLB or STEP format only)")
    original_file_format = models.CharField(max_length=10, blank=True, null=True, help_text="Format of original file (GLB or STEP only)")
    model_data = models.JSONField(default=dict, blank=True)  # For storing 3D model JSON data
    
    # Design specifications
    width = models.FloatField(default=0.0, help_text="Width in meters")
    height = models.FloatField(default=0.0, help_text="Height in meters")
    depth = models.FloatField(default=0.0, help_text="Depth in meters")
    
    # 3D Transformation data (for frontend preview)
    position_x = models.FloatField(default=0.0, help_text="X position")
    position_y = models.FloatField(default=0.0, help_text="Y position")
    position_z = models.FloatField(default=0.0, help_text="Z position")
    rotation_x = models.FloatField(default=0.0, help_text="X rotation in degrees")
    rotation_y = models.FloatField(default=0.0, help_text="Y rotation in degrees")
    rotation_z = models.FloatField(default=0.0, help_text="Z rotation in degrees")
    scale_x = models.FloatField(default=1.0, help_text="X scale")
    scale_y = models.FloatField(default=1.0, help_text="Y scale")
    scale_z = models.FloatField(default=1.0, help_text="Z scale")
    
    # Material properties
    material_type = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=50, blank=True)
    
    # Pricing
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Images
    thumbnail = models.ImageField(upload_to='thumbnails/', blank=True, null=True)
    
    # Metadata
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class UserProject(models.Model):
    """User's saved 3D chimney projects"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Project data
    design_data = models.JSONField(default=dict)  # Stores the 3D design configuration
    model_data = models.JSONField(default=dict)  # Stores 3D model data
    
    # Reference to base design (optional)
    base_design = models.ForeignKey(ChimneyDesign, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Images
    thumbnail = models.ImageField(upload_to='project_thumbnails/', blank=True, null=True)
    
    # Metadata
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.name}"
    
    def save(self, *args, **kwargs):
        """Override save to auto-generate thumbnail"""
        # Check if design_data or model_data has changed
        design_data_changed = False
        if self.pk:
            try:
                old_instance = UserProject.objects.get(pk=self.pk)
                design_data_changed = (
                    old_instance.design_data != self.design_data or
                    old_instance.model_data != self.model_data
                )
            except UserProject.DoesNotExist:
                # New object being saved for the first time
                design_data_changed = True
        else:
            # New object, no pk yet
            design_data_changed = True
        
        # Generate thumbnail if design data changed and we have data
        if design_data_changed and (self.design_data or self.model_data):
            from .utils import generate_project_thumbnail
            thumbnail_file = generate_project_thumbnail(self.design_data, self.model_data)
            if thumbnail_file:
                # Delete old thumbnail if exists
                if self.thumbnail:
                    self.thumbnail.delete(save=False)
                self.thumbnail = thumbnail_file
        
        super().save(*args, **kwargs)


class Order(models.Model):
    """Order model for purchasing chimney designs"""
    ORDER_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    design = models.ForeignKey(ChimneyDesign, on_delete=models.SET_NULL, null=True)
    project = models.ForeignKey(UserProject, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Order details
    quantity = models.IntegerField(default=1)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='pending')
    
    # Customer information
    customer_name = models.CharField(max_length=200)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20, blank=True)
    shipping_address = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Order #{self.id} - {self.customer_name}"


class ContactMessage(models.Model):
    """Contact form messages"""
    name = models.CharField(max_length=200)
    email = models.EmailField()
    subject = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.subject}"


class DesignGLBFile(models.Model):
    """Model to store multiple GLB files for a design"""
    FILE_TYPE_CHOICES = [
        ('model', 'Model File'),
        ('original', 'Original File'),
    ]
    
    design = models.ForeignKey(ChimneyDesign, on_delete=models.CASCADE, related_name='glb_files')
    file = models.FileField(upload_to='models/', help_text="GLB or GLTF file")
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default='model', help_text="Type of file (model or original)")
    file_name = models.CharField(max_length=255, blank=True, help_text="Original filename")
    is_primary = models.BooleanField(default=False, help_text="Primary file to use for 3D viewer")
    order = models.IntegerField(default=0, help_text="Display order")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', '-created_at']
        verbose_name = 'Design GLB File'
        verbose_name_plural = 'Design GLB Files'
    
    def __str__(self):
        return f"{self.design.title} - {self.file_name or self.file.name} ({self.file_type})"


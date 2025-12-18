"""
Custom forms for Django admin
"""
from django import forms
from .models import ChimneyDesign, DesignGLBFile


class MultipleFileInput(forms.FileInput):
    """Custom file input widget that supports multiple file selection"""
    allow_multiple_selected = True
    
    def __init__(self, attrs=None):
        super().__init__(attrs)
        if attrs is None:
            attrs = {}
        attrs['multiple'] = True
        attrs['accept'] = '.glb,.gltf'
        attrs['class'] = attrs.get('class', '') + ' multiple-file-input'
        self.attrs = attrs
    
    def value_from_datadict(self, data, files, name):
        """Handle multiple file uploads"""
        if hasattr(files, 'getlist'):
            file_list = files.getlist(name)
            return file_list if len(file_list) > 1 else (file_list[0] if file_list else None)
        return files.get(name)


class ChimneyDesignAdminForm(forms.ModelForm):
    """Custom form for ChimneyDesign with multiple file support"""
    
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
            'original_file': '💡 Click "Choose Files" to select multiple files (Legacy field - use GLB Files section instead)',
            'model_file': '💡 Click "Choose Files" to select multiple GLB files (Legacy field - use GLB Files section instead)'
        }


"""
Custom widgets for Django admin
"""
from django import forms
from django.utils.html import format_html


class MultipleFileInput(forms.ClearableFileInput):
    """Custom file input widget that supports multiple file selection"""
    allow_multiple_selected = True
    
    def __init__(self, attrs=None):
        super().__init__(attrs)
        if attrs is None:
            attrs = {}
        attrs['multiple'] = True
        self.attrs = attrs
    
    def value_from_datadict(self, data, files, name):
        """Handle multiple file uploads"""
        if hasattr(files, 'getlist'):
            return files.getlist(name)
        return files.get(name)


class MultipleGLBFileWidget(forms.FileInput):
    """Custom widget for multiple GLB file uploads"""
    allow_multiple_selected = True
    
    def __init__(self, attrs=None):
        super().__init__(attrs)
        if attrs is None:
            attrs = {}
        attrs['multiple'] = True
        attrs['accept'] = '.glb,.gltf'
        self.attrs = attrs
    
    def value_from_datadict(self, data, files, name):
        """Handle multiple file uploads"""
        if hasattr(files, 'getlist'):
            return files.getlist(name)
        return files.get(name)
    
    def render(self, name, value, attrs=None, renderer=None):
        """Render the file input with custom styling"""
        if attrs is None:
            attrs = {}
        attrs['multiple'] = True
        attrs['accept'] = '.glb,.gltf'
        attrs['class'] = attrs.get('class', '') + ' multiple-file-input'
        
        html = super().render(name, value, attrs, renderer)
        # Add custom message
        html += format_html(
            '<small style="display: block; margin-top: 5px; color: #666;">'
            '💡 You can select multiple GLB files at once (Ctrl+Click or Shift+Click)'
            '</small>'
        )
        return html


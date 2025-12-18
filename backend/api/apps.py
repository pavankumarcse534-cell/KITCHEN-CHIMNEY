from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    
    def ready(self):
        """Import admin configuration when app is ready"""
        # This ensures admin branding is set when Django starts
        import api.admin_config  # noqa


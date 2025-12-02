"""
Django management command to set up all 8 model types
Usage: python manage.py setup_model_types
"""
from django.core.management.base import BaseCommand
from api.admin_helpers import ensure_model_type_designs, MODEL_TYPE_MAPPING


class Command(BaseCommand):
    help = 'Set up all 8 model types in ChimneyDesign'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Setting up 8 model types...'))
        self.stdout.write('')
        
        results = ensure_model_type_designs()
        
        self.stdout.write(self.style.SUCCESS('Model Types Setup Complete:'))
        self.stdout.write('')
        
        for result in results:
            action = result['action']
            model_type = result['model_type']
            title = result['title']
            design_id = result['id']
            
            if action == 'created':
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created: {title} (ID: {design_id}) - model_type: {model_type}')
                )
            elif action == 'reactivated':
                self.stdout.write(
                    self.style.WARNING(f'↻ Reactivated: {title} (ID: {design_id}) - model_type: {model_type}')
                )
            else:
                self.stdout.write(
                    self.style.NOTICE(f'• Exists: {title} (ID: {design_id}) - model_type: {model_type}')
                )
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('All 8 model types are ready for file upload!'))
        self.stdout.write('')
        self.stdout.write('Next steps:')
        self.stdout.write('1. Go to Django Admin: http://localhost:8000/admin/api/chimneydesign/')
        self.stdout.write('2. Edit each model type and upload GLB or STEP files')
        self.stdout.write('3. Files will be automatically linked to model types')
        self.stdout.write('')
        self.stdout.write('Model Types:')
        for model_type, title in MODEL_TYPE_MAPPING.items():
            self.stdout.write(f'  - {title} ({model_type})')


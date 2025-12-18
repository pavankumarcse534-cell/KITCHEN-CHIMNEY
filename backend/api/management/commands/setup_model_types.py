"""
Django management command to set up all model types
Usage: python manage.py setup_model_types
"""
from django.core.management.base import BaseCommand
from api.admin_helpers import ensure_model_type_designs, MODEL_TYPE_MAPPING, MATERIAL_TYPE_MAPPING, get_design_by_model_type


class Command(BaseCommand):
    help = 'Set up all model types in ChimneyDesign and update material types'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-material-update',
            action='store_true',
            help='Skip updating material types',
        )

    def handle(self, *args, **options):
        total_types = len(MODEL_TYPE_MAPPING)
        skip_material = options.get('skip_material_update', False)
        
        self.stdout.write(self.style.SUCCESS(f'Setting up {total_types} model types...'))
        self.stdout.write('')
        
        # Step 1: Create/ensure all model types exist
        results = ensure_model_type_designs()
        
        self.stdout.write(self.style.SUCCESS('Model Types Setup Complete:'))
        self.stdout.write('')
        
        created_count = 0
        reactivated_count = 0
        exists_count = 0
        
        for result in results:
            action = result['action']
            model_type = result['model_type']
            title = result['title']
            design_id = result['id']
            
            if action == 'created':
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created: {title} (ID: {design_id}) - model_type: {model_type}')
                )
                created_count += 1
            elif action == 'reactivated':
                self.stdout.write(
                    self.style.WARNING(f'↻ Reactivated: {title} (ID: {design_id}) - model_type: {model_type}')
                )
                reactivated_count += 1
            else:
                self.stdout.write(
                    self.style.NOTICE(f'• Exists: {title} (ID: {design_id}) - model_type: {model_type}')
                )
                exists_count += 1
        
        self.stdout.write('')
        
        # Step 2: Update material types
        if not skip_material:
            self.stdout.write(self.style.SUCCESS('Updating material types...'))
            self.stdout.write('')
            
            updated_count = 0
            already_set_count = 0
            
            for model_type, title in MODEL_TYPE_MAPPING.items():
                material_type = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
                design = get_design_by_model_type(model_type)
                
                if design:
                    if not design.material_type or design.material_type != material_type:
                        old_material = design.material_type or '(not set)'
                        design.material_type = material_type
                        design.save()
                        self.stdout.write(
                            self.style.SUCCESS(f'✓ Material updated: {title} → {material_type}')
                        )
                        updated_count += 1
                    else:
                        already_set_count += 1
                else:
                    self.stdout.write(
                        self.style.WARNING(f'⚠ Could not update material for: {title} (design not found)')
                    )
            
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS(f'Material types updated: {updated_count}, Already set: {already_set_count}'))
            self.stdout.write('')
        
        # Summary
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS('Setup Summary:'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'Total Model Types: {total_types}')
        self.stdout.write(f'✓ Created: {created_count}')
        self.stdout.write(f'↻ Reactivated: {reactivated_count}')
        self.stdout.write(f'• Already Existed: {exists_count}')
        if not skip_material:
            self.stdout.write(f'✓ Material Types Updated: {updated_count}')
        self.stdout.write('=' * 60)
        self.stdout.write('')
        
        self.stdout.write(self.style.SUCCESS(f'All {total_types} model types are ready for file upload!'))
        self.stdout.write('')
        self.stdout.write('Next steps:')
        self.stdout.write('1. Go to Django Admin: http://localhost:8000/admin/api/chimneydesign/')
        self.stdout.write('2. Edit each model type and upload GLB or STEP files')
        self.stdout.write('3. Files will be automatically linked to model types')
        self.stdout.write('')
        self.stdout.write('Model Types with Material Types:')
        for model_type, title in MODEL_TYPE_MAPPING.items():
            material_type = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
            self.stdout.write(f'  - {title} ({model_type}) - Material: {material_type}')


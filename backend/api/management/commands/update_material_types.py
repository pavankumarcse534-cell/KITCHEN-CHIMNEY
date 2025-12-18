"""
Django management command to update material types for all 17 GLB model types
Usage: python manage.py update_material_types
"""
from django.core.management.base import BaseCommand
from api.admin_helpers import MODEL_TYPE_MAPPING, MATERIAL_TYPE_MAPPING, get_design_by_model_type
from api.models import ChimneyDesign


class Command(BaseCommand):
    help = 'Update material types for all 17 GLB model types'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update material types even if they are already set',
        )

    def handle(self, *args, **options):
        force_update = options['force']
        total_types = len(MODEL_TYPE_MAPPING)
        
        self.stdout.write(self.style.SUCCESS(f'Updating material types for {total_types} model types...'))
        self.stdout.write('')
        
        updated_count = 0
        skipped_count = 0
        not_found_count = 0
        
        for model_type, title in MODEL_TYPE_MAPPING.items():
            material_type = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
            
            design = get_design_by_model_type(model_type)
            
            # Special highlighting for WMSS SINGLE SKIN 1 SEC
            is_wmss_1_sec = model_type == 'wmss_single_skin_1_sec'
            
            if design:
                # Check if material type needs updating
                if force_update or not design.material_type or design.material_type != material_type:
                    old_material = design.material_type or '(not set)'
                    design.material_type = material_type
                    design.save()
                    
                    if is_wmss_1_sec:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✓✓✓ UPDATED: {title} (WMSS SINGLE SKIN 1 SEC)\n'
                                f'  Model Type: {model_type}\n'
                                f'  Material: {old_material} → {material_type} (Sheet 202)\n'
                                f'  Status: ✓ Active and configured'
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✓ Updated: {title}\n'
                                f'  Model Type: {model_type}\n'
                                f'  Material: {old_material} → {material_type}'
                            )
                        )
                    updated_count += 1
                else:
                    if is_wmss_1_sec:
                        self.stdout.write(
                            self.style.NOTICE(
                                f'•✓ WMSS SINGLE SKIN 1 SEC: {title} (already set to {material_type} - Sheet 202)'
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.NOTICE(
                                f'• Skipped: {title} (already set to {material_type})'
                            )
                        )
                    skipped_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠ Not Found: {title} (model_type: {model_type})\n'
                        f'  Run "python manage.py setup_model_types" first to create this design.'
                    )
                )
                not_found_count += 1
            
            self.stdout.write('')
        
        # Summary
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS('Material Type Update Summary:'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'Total Model Types: {total_types}')
        self.stdout.write(self.style.SUCCESS(f'✓ Updated: {updated_count}'))
        self.stdout.write(self.style.NOTICE(f'• Skipped: {skipped_count}'))
        self.stdout.write(self.style.WARNING(f'⚠ Not Found: {not_found_count}'))
        self.stdout.write('')
        
        if updated_count > 0:
            self.stdout.write(self.style.SUCCESS('Material types updated successfully!'))
        elif skipped_count == total_types:
            self.stdout.write(self.style.NOTICE('All material types are already set correctly.'))
            self.stdout.write('Use --force flag to update them anyway.')
        else:
            self.stdout.write(self.style.WARNING('Some model types were not found. Run setup_model_types first.'))
        
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('Material Type Mapping Summary:')
        self.stdout.write('=' * 60)
        self.stdout.write('')
        self.stdout.write('Stainless Steel 202 (Sheet 202) - Single Sections & Component Parts:')
        for model_type, title in MODEL_TYPE_MAPPING.items():
            material = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
            if material == 'Stainless Steel 202':
                marker = '✓✓✓' if model_type == 'wmss_single_skin_1_sec' else '  '
                self.stdout.write(f'  {marker} {title}')
        self.stdout.write('')
        self.stdout.write('Stainless Steel 304 (Sheet 304) - Main Assemblies (Premium):')
        for model_type, title in MODEL_TYPE_MAPPING.items():
            material = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
            if material == 'Stainless Steel 304':
                self.stdout.write(f'    {title}')
        self.stdout.write('')
        self.stdout.write('WMSS SINGLE SKIN 1 SEC Configuration:')
        self.stdout.write('  Model Type: wmss_single_skin_1_sec')
        self.stdout.write('  Display Title: WMSS SINGLE SKIN 1 SEC')
        self.stdout.write('  Material Type: Stainless Steel 202 (Sheet 202)')
        self.stdout.write('  Status: ✓ Configured and Active')


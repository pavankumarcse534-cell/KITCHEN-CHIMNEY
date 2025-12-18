"""
Helper functions for Django admin to manage 3D model types
"""
from .models import ChimneyDesign
from django.core.files.storage import default_storage
import logging

logger = logging.getLogger(__name__)

# Map of all model types to their display titles
MODEL_TYPE_MAPPING = {
    'wmss_single_skin_5_secs': 'WMSS SINGLE SKIN 5 SECS',
    'wmss_single_skin_2_secs': 'WMSS SINGLE SKIN 2 SECS',
    'wmss_single_skin_1_sec': 'WMSS SINGLE SKIN 1 SEC',
    'wmch_compensating_main_assembly_5_sec': 'WMCH COMPENSATING MAIN ASSEMBLY WITH 5 SEC',
    'wmch_compensating_main_assembly_2_sec': 'WMCH COMPENSATING MAIN ASSEMBLY WITH 2 SEC',
    'wmch_compensating_1_sec': 'WMCH COMPENSATING 1 SEC',
    'uv_compensating_single_section_1_sec': 'UV COMPENSATING SINGLE SECTION 1 SEC',
    'uv_compensating_main_assembly_5_sec': 'UV COMPENSATING MAIN ASSEMBLY 5 SEC',
    'uv_compensating_main_assembly_2_sec': 'UV COMPENSATING MAIN ASSEMBLY 2 SEC',
    'wmds_double_skin_main_2_sec': 'WMDS DOUBLE SKIN MAIN 2 SEC',
    'wmds_double_skin_main_5_sec': 'WMDS DOUBLE SKIN MAIN 5 SEC',
    'wmss_single_skin_1_sec_and_one_collar_hole_single_skin': 'WMSS SINGLE SKIN 1 SEC && ONE COLLAR HOLE SINGLE SKIN',
}

# Map of model types to their default material types
# Material types: Sheet 202 (Stainless Steel 202) or Sheet 304 (Stainless Steel 304)
# Distribution: Main assemblies and larger parts use 304 (premium), smaller parts and single sections use 202
# Updated: WMSS SINGLE SKIN 1 SEC configured with Stainless Steel 202 (Sheet 202)
MATERIAL_TYPE_MAPPING = {
    # Single sections - Sheet 202 (Stainless Steel 202)
    'wmss_single_skin_5_secs': 'Stainless Steel 202',
    'wmss_single_skin_2_secs': 'Stainless Steel 202',
    'wmss_single_skin_1_sec': 'Stainless Steel 202',  # Updated: WMSS SINGLE SKIN 1 SEC uses Sheet 202
    'wmch_compensating_1_sec': 'Stainless Steel 202',
    'uv_compensating_single_section_1_sec': 'Stainless Steel 202',
    
    # Main assemblies - Sheet 304 (Stainless Steel 304) - Premium quality for main structures
    'wmch_compensating_main_assembly_5_sec': 'Stainless Steel 304',
    'wmch_compensating_main_assembly_2_sec': 'Stainless Steel 304',
    'uv_compensating_main_assembly_5_sec': 'Stainless Steel 304',
    'uv_compensating_main_assembly_2_sec': 'Stainless Steel 304',
    'wmds_double_skin_main_2_sec': 'Stainless Steel 304',
    'wmds_double_skin_main_5_sec': 'Stainless Steel 304',
    
    # Component parts - Sheet 202 (Stainless Steel 202) - Smaller parts
    'wmss_single_skin_1_sec_and_one_collar_hole_single_skin': 'Stainless Steel 202',  # Combined type uses Sheet 202
}

def ensure_model_type_designs():
    """
    Ensure all model types have corresponding ChimneyDesign records
    Returns list of created/updated designs
    """
    created_or_updated = []
    
    for model_type, title in MODEL_TYPE_MAPPING.items():
        # Get default material type for this model type
        default_material = MATERIAL_TYPE_MAPPING.get(model_type, 'Stainless Steel 202')
        
        design, created = ChimneyDesign.objects.get_or_create(
            title=title,
            defaults={
                'description': f"3D model for {title} (model_type: {model_type})",
                'material_type': default_material,
                'is_active': True,
            }
        )
        
        # Update material type if it's not set or different (for existing designs)
        if not created:
            if not design.material_type or design.material_type != default_material:
                old_material = design.material_type or '(not set)'
                design.material_type = default_material
                design.save()
                logger.info(f'Updated material_type for {model_type} from {old_material} to {default_material}')
        
        if created:
            logger.info(f'Created design for model_type: {model_type} (ID: {design.id})')
            created_or_updated.append({'model_type': model_type, 'title': title, 'action': 'created', 'id': design.id})
        else:
            # Update existing to ensure it's active
            if not design.is_active:
                design.is_active = True
                design.save()
                logger.info(f'Reactivated design for model_type: {model_type} (ID: {design.id})')
                created_or_updated.append({'model_type': model_type, 'title': title, 'action': 'reactivated', 'id': design.id})
            else:
                logger.info(f'Design already exists for model_type: {model_type} (ID: {design.id})')
                created_or_updated.append({'model_type': model_type, 'title': title, 'action': 'exists', 'id': design.id})
    
    return created_or_updated

def get_model_type_from_title(title: str):
    """
    Get model_type from title (reverse lookup)
    Returns the model_type key if title matches, None otherwise
    """
    if not title:
        return None
    
    # Normalize title for comparison (case-insensitive, strip whitespace)
    title_normalized = title.strip()
    
    # Reverse lookup: find model_type by title
    for model_type, mapped_title in MODEL_TYPE_MAPPING.items():
        if mapped_title.strip().lower() == title_normalized.lower():
            return model_type
    
    return None

def get_design_by_model_type(model_type: str):
    """
    Get ChimneyDesign by model_type
    """
    title = MODEL_TYPE_MAPPING.get(model_type)
    if not title:
        return None
    
    return ChimneyDesign.objects.filter(
        title__iexact=title
    ).filter(is_active=True).first()

def link_file_to_model_type(model_type: str, file_path: str, is_glb: bool = True):
    """
    Link an uploaded file to a model type
    """
    design = get_design_by_model_type(model_type)
    if not design:
        # Create if doesn't exist
        title = MODEL_TYPE_MAPPING.get(model_type, model_type.replace('_', ' ').title())
        design = ChimneyDesign.objects.create(
            title=title,
            description=f"3D model for {title} (model_type: {model_type})",
            is_active=True
        )
    
    # Save the file reference
    if is_glb:
        design.model_file = file_path
    else:
        design.thumbnail = file_path
    
    design.save()
    logger.info(f'Linked file to model_type: {model_type} (Design ID: {design.id})')
    return design


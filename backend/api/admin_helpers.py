"""
Helper functions for Django admin to manage 3D model types
"""
from .models import ChimneyDesign
from django.core.files.storage import default_storage
import logging

logger = logging.getLogger(__name__)

# Map of all 8 model types to their display titles
MODEL_TYPE_MAPPING = {
    'wall_mounted_skin': 'Wall Mounted Single Skin',
    'wall_mounted_single_plenum': 'Wall Mounted Single Plenum',
    'wall_mounted_double_skin': 'Wall Mounted Double Skin',
    'wall_mounted_compensating': 'Wall Mounted Compensating',
    'uv_compensating': 'UV Compensating',
    'island_single_skin': 'Island Single Skin',
    'island_double_skin': 'Island Double Skin',
    'island_compensating': 'Island Compensating',
}

def ensure_model_type_designs():
    """
    Ensure all 8 model types have corresponding ChimneyDesign records
    Returns list of created/updated designs
    """
    created_or_updated = []
    
    for model_type, title in MODEL_TYPE_MAPPING.items():
        design, created = ChimneyDesign.objects.get_or_create(
            title=title,
            defaults={
                'description': f"3D model for {title} (model_type: {model_type})",
                'is_active': True,
            }
        )
        
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


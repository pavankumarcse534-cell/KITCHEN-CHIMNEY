"""
Utility functions for the API
"""
import os
import logging
import time
from io import BytesIO
from django.core.files import File
from django.conf import settings
from PIL import Image, ImageDraw
import colorsys

logger = logging.getLogger(__name__)

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def generate_project_thumbnail(design_data, model_data=None):
    """
    Generate a thumbnail image for a UserProject based on design_data
    
    Args:
        design_data: Dictionary containing design specifications (width, height, depth, color, etc.)
        model_data: Optional dictionary containing 3D model data
    
    Returns:
        Django File object containing PNG image, or None if generation failed
    """
    try:
        # Default dimensions if not provided
        width = float(design_data.get('width', 1.5))
        height = float(design_data.get('height', 2.0))
        depth = float(design_data.get('depth', 0.8))
        
        # Get color from design_data
        color_str = design_data.get('color', '#b0b8c1')
        if not color_str.startswith('#'):
            color_str = '#' + color_str
        color = hex_to_rgb(color_str)
        
        # Image dimensions
        img_width = 800
        img_height = 800
        padding = 50
        
        # Create image with white background
        img = Image.new('RGB', (img_width, img_height), color='white')
        draw = ImageDraw.Draw(img)
        
        # Calculate scale to fit the chimney in the image
        # Use isometric projection
        max_dim = max(width, height, depth)
        if max_dim == 0:
            max_dim = 1
        scale = (img_width - 2 * padding) / (max_dim * 2)
        
        # Center point
        center_x = img_width // 2
        center_y = img_height // 2
        
        # Isometric projection helper
        def iso_proj(x, y, z):
            # Isometric projection: rotate 45° around Y, then 30° around X
            iso_x = (x - z) * 0.866
            iso_y = (x + z) * 0.5 - y
            return iso_x, iso_y
        
        # Draw chimney base (box)
        w, h, d = width * scale, height * scale, depth * scale
        
        # Calculate 8 corners of the box
        corners_3d = [
            (-w/2, 0, -d/2),      # Bottom front left
            (w/2, 0, -d/2),       # Bottom front right
            (w/2, 0, d/2),        # Bottom back right
            (-w/2, 0, d/2),       # Bottom back left
            (-w/2, h, -d/2),      # Top front left
            (w/2, h, -d/2),       # Top front right
            (w/2, h, d/2),        # Top back right
            (-w/2, h, d/2),       # Top back left
        ]
        
        # Project to 2D
        corners_2d = []
        for x, y, z in corners_3d:
            px, py = iso_proj(x, y, z)
            corners_2d.append((center_x + px, center_y + py))
        
        # Draw faces of the box
        # Front face
        draw.polygon([corners_2d[0], corners_2d[1], corners_2d[5], corners_2d[4]], 
                    fill=color, outline=(0, 0, 0), width=2)
        # Right face
        draw.polygon([corners_2d[1], corners_2d[2], corners_2d[6], corners_2d[5]], 
                    fill=tuple(max(0, c - 30) for c in color), outline=(0, 0, 0), width=2)
        # Top face
        draw.polygon([corners_2d[4], corners_2d[5], corners_2d[6], corners_2d[7]], 
                    fill=tuple(min(255, c + 30) for c in color), outline=(0, 0, 0), width=2)
        
        # Draw chimney top (cylinder representation as ellipse)
        top_radius = min(width, depth) * scale * 0.4
        top_center_x = center_x
        top_center_y = center_y - h * 0.5 - top_radius * 0.3
        
        # Draw top ellipse (isometric view of cylinder)
        bbox = (
            top_center_x - top_radius,
            top_center_y - top_radius * 0.5,
            top_center_x + top_radius,
            top_center_y + top_radius * 0.5
        )
        darker_color = tuple(max(0, c - 40) for c in color)
        draw.ellipse(bbox, fill=darker_color, outline=(0, 0, 0), width=2)
        
        # Draw top cylinder side (connecting ellipse)
        side_bbox = (
            top_center_x - top_radius * 0.8,
            top_center_y - top_radius * 0.3,
            top_center_x + top_radius * 0.8,
            top_center_y + top_radius * 0.3
        )
        draw.ellipse(side_bbox, fill=tuple(max(0, c - 20) for c in color), outline=(0, 0, 0), width=1)
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, format='PNG', quality=95)
        img_io.seek(0)
        
        # Create Django File object
        filename = f"project_thumbnail_{int(time.time() * 1000)}.png"
        thumbnail_file = File(img_io, name=filename)
        
        logger.info(f"Successfully generated thumbnail for project")
        return thumbnail_file
        
    except Exception as e:
        logger.error(f"Error generating project thumbnail: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None


def generate_glb_preview_image(glb_file_path, output_size=(800, 800)):
    """
    Generate a preview image from a GLB file
    
    Args:
        glb_file_path: Path to the GLB file
        output_size: Tuple of (width, height) for output image
    
    Returns:
        PIL Image object or None if generation failed
    """
    try:
        import trimesh
        import numpy as np
        
        # Load GLB file
        logger.info(f"Loading GLB file: {glb_file_path}")
        scene = trimesh.load(glb_file_path)
        
        # If scene is a Scene object, get the first mesh
        if hasattr(scene, 'geometry'):
            # It's a Scene, get the first geometry
            if len(scene.geometry) > 0:
                mesh = list(scene.geometry.values())[0]
            else:
                logger.warning("No geometry found in GLB file")
                return None
        elif hasattr(scene, 'vertices'):
            # It's already a mesh
            mesh = scene
        else:
            logger.warning("Unknown scene type")
            return None
        
        # Get bounding box
        bounds = mesh.bounds
        center = mesh.centroid
        size = bounds[1] - bounds[0]
        max_size = max(size)
        
        if max_size == 0:
            logger.warning("Mesh has zero size")
            return None
        
        # Create a simple orthographic view
        # Calculate camera position for isometric view
        distance = max_size * 2.5
        camera_pos = np.array([
            center[0] + distance * 0.7,
            center[1] + distance * 0.7,
            center[2] + distance * 0.7
        ])
        
        # Create image
        img = Image.new('RGB', output_size, color='white')
        draw = ImageDraw.Draw(img)
        
        # Project vertices to 2D (simple orthographic projection)
        vertices = mesh.vertices
        faces = mesh.faces
        
        # Normalize to image coordinates
        scale = min(output_size) * 0.8 / max_size
        offset_x = output_size[0] / 2
        offset_y = output_size[1] / 2
        
        # Project vertices
        projected_vertices = []
        for vertex in vertices:
            # Simple isometric projection
            x = (vertex[0] - center[0]) * scale + offset_x
            y = (vertex[1] - center[1]) * scale + offset_y
            projected_vertices.append((x, y))
        
        # Draw faces (simple wireframe)
        for face in faces:
            if len(face) >= 3:
                points = [projected_vertices[i] for i in face[:3]]
                # Draw filled triangle with light gray
                draw.polygon(points, fill=(240, 240, 240), outline=(100, 100, 100), width=1)
        
        logger.info(f"Successfully generated preview image from GLB: {glb_file_path}")
        return img
        
    except ImportError:
        logger.warning("trimesh not available, using fallback method")
        # Fallback: Create a placeholder image
        return generate_glb_placeholder_image(output_size)
    except Exception as e:
        logger.error(f"Error generating GLB preview: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        # Fallback: Create a placeholder image
        return generate_glb_placeholder_image(output_size)


def generate_glb_placeholder_image(output_size=(800, 800)):
    """
    Generate a placeholder image when GLB preview generation fails
    
    Args:
        output_size: Tuple of (width, height) for output image
    
    Returns:
        PIL Image object
    """
    img = Image.new('RGB', output_size, color='#f0f0f0')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple 3D box representation
    center_x, center_y = output_size[0] // 2, output_size[1] // 2
    box_size = min(output_size) // 3
    
    # Front face
    front_points = [
        (center_x - box_size, center_y - box_size),
        (center_x + box_size, center_y - box_size),
        (center_x + box_size, center_y + box_size),
        (center_x - box_size, center_y + box_size),
    ]
    draw.polygon(front_points, fill=(200, 200, 200), outline=(100, 100, 100), width=2)
    
    # Top face (isometric)
    top_points = [
        (center_x - box_size, center_y - box_size),
        (center_x, center_y - box_size - box_size // 2),
        (center_x + box_size, center_y - box_size - box_size // 2),
        (center_x + box_size, center_y - box_size),
    ]
    draw.polygon(top_points, fill=(220, 220, 220), outline=(100, 100, 100), width=2)
    
    # Right face (isometric)
    right_points = [
        (center_x + box_size, center_y - box_size),
        (center_x + box_size, center_y + box_size),
        (center_x + box_size + box_size // 2, center_y + box_size - box_size // 2),
        (center_x + box_size + box_size // 2, center_y - box_size - box_size // 2),
    ]
    draw.polygon(right_points, fill=(180, 180, 180), outline=(100, 100, 100), width=2)
    
    # Add text
    try:
        from PIL import ImageFont
        # Try to use default font
        font = ImageFont.load_default()
        text = "3D Model Preview"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = (output_size[0] - text_width) // 2
        text_y = output_size[1] - text_height - 20
        draw.text((text_x, text_y), text, fill=(150, 150, 150), font=font)
    except:
        pass
    
    return img


def save_glb_preview_to_file(glb_file_path, output_path=None):
    """
    Generate and save a preview image from a GLB file
    
    Args:
        glb_file_path: Path to the GLB file
        output_path: Optional output path for the image. If None, saves next to GLB file with .png extension
    
    Returns:
        Path to saved image file or None if failed
    """
    try:
        # Generate preview image
        preview_img = generate_glb_preview_image(glb_file_path)
        
        if preview_img is None:
            logger.error(f"Failed to generate preview image from {glb_file_path}")
            return None
        
        # Determine output path
        if output_path is None:
            base_path = os.path.splitext(glb_file_path)[0]
            output_path = f"{base_path}_preview.png"
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Save image
        preview_img.save(output_path, format='PNG', quality=95)
        logger.info(f"Saved preview image: {output_path}")
        
        return output_path
        
    except Exception as e:
        logger.error(f"Error saving GLB preview: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None


def convert_step_to_glb(step_path, glb_output_path):
    """
    Stub function for converting STEP files to GLB format.
    
    Args:
        step_path: Path to the input STEP file
        glb_output_path: Path where the output GLB file should be saved
    
    Returns:
        None (stub implementation - conversion not implemented)
    
    Note:
        This is a stub implementation. Actual conversion functionality
        would require additional dependencies (e.g., FreeCAD, OpenCASCADE, etc.)
    """
    logger.warning(
        f"convert_step_to_glb called but not implemented. "
        f"STEP file: {step_path}, Output path: {glb_output_path}"
    )
    return None


def convert_dwg_to_glb(dwg_path, glb_output_path):
    """
    Stub function for converting DWG files to GLB format.
    
    Args:
        dwg_path: Path to the input DWG file
        glb_output_path: Path where the output GLB file should be saved
    
    Returns:
        None (stub implementation - conversion not implemented)
    
    Note:
        This is a stub implementation. Actual conversion functionality
        would require additional dependencies (e.g., ezdxf, FreeCAD, etc.)
    """
    logger.warning(
        f"convert_dwg_to_glb called but not implemented. "
        f"DWG file: {dwg_path}, Output path: {glb_output_path}"
    )
    return None


def convert_image_to_glb(image_path, glb_output_path, image_format='PNG'):
    """
    Convert PNG or SVG image to GLB format (creates a plane with image texture).
    
    Args:
        image_path: Path to the input image file (PNG or SVG)
        glb_output_path: Path where the output GLB file should be saved
        image_format: Format of the image ('PNG' or 'SVG')
    
    Returns:
        Path to the created GLB file if successful, None otherwise
    
    Note:
        Creates a simple plane mesh (2 triangles) with the image applied as a texture.
        The plane is 1x1 unit in size, centered at origin.
    """
    try:
        import trimesh
        import numpy as np
        from PIL import Image
        
        logger.info(f"Converting {image_format} image to GLB: {image_path}")
        
        # Load the image
        temp_png = None
        if image_format.upper() == 'SVG':
            # For SVG, convert to PNG first using PIL
            try:
                img = Image.open(image_path)
                # Convert RGBA if needed
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                # Save as temporary PNG for trimesh
                temp_png = os.path.splitext(image_path)[0] + '_temp.png'
                img.save(temp_png, 'PNG')
                image_path = temp_png
            except Exception as e:
                logger.error(f"Error processing SVG: {str(e)}")
                return None
        
        # Load image to get dimensions
        img = Image.open(image_path)
        img_width, img_height = img.size
        
        # Create a plane mesh (2 triangles forming a rectangle)
        # Vertices for a 1x1 plane centered at origin
        vertices = np.array([
            [-0.5, 0, -0.5],  # Bottom left
            [0.5, 0, -0.5],   # Bottom right
            [0.5, 0, 0.5],    # Top right
            [-0.5, 0, 0.5],   # Top left
        ], dtype=np.float32)
        
        # Faces (2 triangles)
        faces = np.array([
            [0, 1, 2],  # First triangle
            [0, 2, 3],  # Second triangle
        ], dtype=np.uint32)
        
        # UV coordinates for texture mapping
        uv_coords = np.array([
            [0, 0],  # Bottom left
            [1, 0],  # Bottom right
            [1, 1],  # Top right
            [0, 1],  # Top left
        ], dtype=np.float32)
        
        # Create mesh
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        
        # Apply texture using trimesh visual
        try:
            # Create texture visuals with UV coordinates and image
            # Map UV coordinates to vertices (each vertex needs UV)
            # Since we have 4 vertices and 4 UV coordinates, map them directly
            vertex_uv = np.array([
                [0, 0],  # Vertex 0
                [1, 0],  # Vertex 1
                [1, 1],  # Vertex 2
                [0, 1],  # Vertex 3
            ], dtype=np.float32)
            
            # Create texture visuals
            visual = trimesh.visual.TextureVisuals(
                uv=vertex_uv,
                image=img
            )
            mesh.visual = visual
        except Exception as texture_error:
            logger.warning(f"Could not apply texture, creating mesh without texture: {str(texture_error)}")
            # Create mesh without texture if texture application fails
            pass
        
        # Export as GLB
        mesh.export(glb_output_path, file_type='glb')
        
        logger.info(f"Successfully converted image to GLB: {glb_output_path}")
        
        # Clean up temporary PNG if created from SVG
        if temp_png and os.path.exists(temp_png):
            try:
                os.remove(temp_png)
                logger.debug(f"Cleaned up temporary PNG: {temp_png}")
            except Exception as cleanup_error:
                logger.warning(f"Could not remove temporary PNG: {cleanup_error}")
        
        return glb_output_path if os.path.exists(glb_output_path) else None
        
    except ImportError:
        logger.warning(
            f"trimesh not available for image to GLB conversion. "
            f"Image: {image_path}, Output: {glb_output_path}"
        )
        # Fallback: Create a simple GLB without texture (just geometry)
        try:
            # Create minimal GLB structure manually
            return _create_simple_plane_glb(image_path, glb_output_path)
        except Exception as e:
            logger.error(f"Error creating simple GLB: {str(e)}")
            return None
    except Exception as e:
        logger.error(f"Error converting image to GLB: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None


def _create_simple_plane_glb(image_path, glb_output_path):
    """
    Create a simple GLB file with a plane mesh (fallback when trimesh is not available).
    This creates a basic GLB without texture.
    """
    try:
        # This is a minimal implementation - creates a basic plane GLB
        # For full texture support, trimesh is recommended
        logger.warning("Creating simple GLB without texture (trimesh not available)")
        
        # For now, just copy the image and log a warning
        # In production, you'd want to implement a proper GLB creation
        logger.warning(f"Cannot create GLB from image without trimesh. Image: {image_path}")
        return None
    except Exception as e:
        logger.error(f"Error in fallback GLB creation: {str(e)}")
        return None

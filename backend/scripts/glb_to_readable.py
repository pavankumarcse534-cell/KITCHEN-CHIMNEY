"""
Utility script to convert GLB files to readable glTF JSON format
This allows viewing GLB file contents in text editors since GLB is binary.
"""
import os
import sys
import json
import argparse
from pathlib import Path

# Add parent directory to path to import from backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from pygltflib import GLTF2
except ImportError:
    print("Error: pygltflib is not installed. Please install it using: pip install pygltflib")
    sys.exit(1)


def resolve_path(file_path: str) -> str:
    """
    Resolve a file path to an absolute path.
    Handles both absolute and relative paths.
    """
    if os.path.isabs(file_path):
        return file_path
    # Resolve relative to current working directory
    return os.path.abspath(file_path)


def find_similar_files(file_path: str, search_dir: str = None) -> list:
    """
    Find similar GLB files in the directory to suggest alternatives.
    """
    if search_dir is None:
        search_dir = os.path.dirname(file_path) if os.path.dirname(file_path) else '.'
    
    if not os.path.isdir(search_dir):
        return []
    
    filename = os.path.basename(file_path)
    similar_files = []
    
    try:
        for item in os.listdir(search_dir):
            if item.lower().endswith('.glb'):
                similar_files.append(os.path.join(search_dir, item))
    except (OSError, PermissionError):
        pass
    
    return similar_files


def glb_to_gltf_json(glb_path: str, output_path: str = None) -> str:
    """
    Convert a GLB file to glTF JSON format (readable text format).
    
    Args:
        glb_path: Path to the input GLB file
        output_path: Optional path for output glTF JSON file. 
                     If None, creates a .gltf file next to the GLB file.
    
    Returns:
        Path to the created glTF JSON file
    """
    # Resolve path to absolute
    glb_path = resolve_path(glb_path)
    
    if not os.path.exists(glb_path):
        error_msg = f"GLB file not found: {glb_path}\n"
        error_msg += f"  (Resolved absolute path: {os.path.abspath(glb_path)})\n"
        
        # Try to find similar files
        search_dir = os.path.dirname(glb_path) if os.path.dirname(glb_path) else '.'
        similar_files = find_similar_files(glb_path, search_dir)
        
        if similar_files:
            error_msg += f"\n  Found {len(similar_files)} GLB file(s) in the same directory:\n"
            for similar_file in similar_files[:5]:  # Show up to 5 files
                error_msg += f"    - {os.path.basename(similar_file)}\n"
        else:
            # Search in common locations
            common_dirs = ['media/uploads/glb', 'media', '.']
            for common_dir in common_dirs:
                if os.path.isdir(common_dir):
                    similar_files = find_similar_files(glb_path, common_dir)
                    if similar_files:
                        error_msg += f"\n  Found {len(similar_files)} GLB file(s) in '{common_dir}':\n"
                        for similar_file in similar_files[:5]:
                            error_msg += f"    - {similar_file}\n"
                        break
        
        raise FileNotFoundError(error_msg)
    
    # Load GLB file
    gltf = GLTF2.load(glb_path)
    
    # Generate output path if not provided
    if output_path is None:
        glb_file = Path(glb_path)
        output_path = str(glb_file.with_suffix('.gltf'))
    
    # Save as glTF JSON (text-based format)
    gltf.save(output_path)
    
    return output_path


def extract_glb_info(glb_path: str) -> dict:
    """
    Extract readable information from a GLB file.
    
    Args:
        glb_path: Path to the GLB file
    
    Returns:
        Dictionary containing file information
    """
    # Resolve path to absolute
    glb_path = resolve_path(glb_path)
    
    if not os.path.exists(glb_path):
        error_msg = f"GLB file not found: {glb_path}\n"
        error_msg += f"  (Resolved absolute path: {os.path.abspath(glb_path)})"
        raise FileNotFoundError(error_msg)
    
    gltf = GLTF2.load(glb_path)
    
    info = {
        'file_path': glb_path,
        'file_size': os.path.getsize(glb_path),
        'version': gltf.asset.version if hasattr(gltf.asset, 'version') else None,
        'generator': gltf.asset.generator if hasattr(gltf.asset, 'generator') else None,
        'copyright': gltf.asset.copyright if hasattr(gltf.asset, 'copyright') else None,
        'scenes': len(gltf.scenes) if gltf.scenes else 0,
        'nodes': len(gltf.nodes) if gltf.nodes else 0,
        'meshes': len(gltf.meshes) if gltf.meshes else 0,
        'materials': len(gltf.materials) if gltf.materials else 0,
        'textures': len(gltf.textures) if gltf.textures else 0,
        'images': len(gltf.images) if gltf.images else 0,
        'animations': len(gltf.animations) if gltf.animations else 0,
        'buffers': len(gltf.buffers) if gltf.buffers else 0,
        'buffer_views': len(gltf.bufferViews) if gltf.bufferViews else 0,
        'accessors': len(gltf.accessors) if gltf.accessors else 0,
    }
    
    return info


def print_glb_info(glb_path: str):
    """Print readable information about a GLB file."""
    try:
        info = extract_glb_info(glb_path)
        print("\n" + "="*60)
        print(f"GLB File Information: {os.path.basename(glb_path)}")
        print("="*60)
        print(f"File Path: {info['file_path']}")
        print(f"File Size: {info['file_size']:,} bytes ({info['file_size'] / 1024:.2f} KB)")
        print(f"Version: {info['version']}")
        print(f"Generator: {info['generator']}")
        if info['copyright']:
            print(f"Copyright: {info['copyright']}")
        print(f"\nStructure:")
        print(f"  Scenes: {info['scenes']}")
        print(f"  Nodes: {info['nodes']}")
        print(f"  Meshes: {info['meshes']}")
        print(f"  Materials: {info['materials']}")
        print(f"  Textures: {info['textures']}")
        print(f"  Images: {info['images']}")
        print(f"  Animations: {info['animations']}")
        print(f"  Buffers: {info['buffers']}")
        print(f"  Buffer Views: {info['buffer_views']}")
        print(f"  Accessors: {info['accessors']}")
        print("="*60 + "\n")
    except Exception as e:
        print(f"Error reading GLB file: {str(e)}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Convert GLB files to readable glTF JSON format or extract information'
    )
    parser.add_argument('glb_file', help='Path to the GLB file')
    parser.add_argument(
        '-o', '--output',
        help='Output path for glTF JSON file (default: same name with .gltf extension)'
    )
    parser.add_argument(
        '-i', '--info',
        action='store_true',
        help='Only print file information, do not convert'
    )
    parser.add_argument(
        '-j', '--json-info',
        action='store_true',
        help='Print file information as JSON'
    )
    
    args = parser.parse_args()
    
    if args.info or args.json_info:
        # Just print information
        if args.json_info:
            info = extract_glb_info(args.glb_file)
            print(json.dumps(info, indent=2))
        else:
            print_glb_info(args.glb_file)
    else:
        # Convert to glTF JSON
        try:
            output_path = glb_to_gltf_json(args.glb_file, args.output)
            print(f"Successfully converted GLB to glTF JSON:")
            print(f"  Input:  {args.glb_file}")
            print(f"  Output: {output_path}")
            print(f"\nYou can now open {output_path} in any text editor!")
        except Exception as e:
            print(f"Error converting GLB file: {str(e)}", file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()


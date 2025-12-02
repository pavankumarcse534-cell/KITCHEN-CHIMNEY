# GLB to Readable Format Converter

This utility solves the issue where GLB files cannot be displayed in text editors because they are binary files.

## Problem
GLB (GL Transmission Format Binary) files are binary files that cannot be opened in standard text editors. When you try to open a GLB file in a text editor, you'll see an error like:
- "File is binary or uses an unsupported text encoding"
- "Cannot display binary file"

## Solution
This utility converts GLB files to glTF JSON format, which is a text-based format that can be opened and viewed in any text editor.

## Usage

### Convert GLB to Readable glTF JSON

```bash
python backend/scripts/glb_to_readable.py <path_to_glb_file>
```

**Example:**
```bash
python backend/scripts/glb_to_readable.py "media/uploads/glb/GA _ Drawing DS4  Date 201023042629.glb"
```

This will create a `.gltf` file (JSON format) next to the original GLB file that you can open in any text editor.

### Specify Output Path

```bash
python backend/scripts/glb_to_readable.py <path_to_glb_file> -o <output_path>
```

**Example:**
```bash
python backend/scripts/glb_to_readable.py "media/uploads/glb/file.glb" -o "output/file.gltf"
```

### View File Information Only

To see information about a GLB file without converting it:

```bash
python backend/scripts/glb_to_readable.py <path_to_glb_file> -i
```

**Example:**
```bash
python backend/scripts/glb_to_readable.py "media/uploads/glb/file.glb" -i
```

This will display:
- File size
- Version
- Generator
- Number of scenes, nodes, meshes, materials, textures, etc.

### Get Information as JSON

```bash
python backend/scripts/glb_to_readable.py <path_to_glb_file> -j
```

## Using in Python Code

You can also use the utility function directly in your Python code:

```python
from api.utils import glb_to_readable_json

# Convert GLB to readable glTF JSON
gltf_path = glb_to_readable_json("path/to/file.glb")
if gltf_path:
    print(f"Converted to: {gltf_path}")
    # Now you can open gltf_path in a text editor
```

## What Gets Created

When you convert a GLB file:
1. A `.gltf` file (JSON format) - This is the readable text file
2. A `.bin` file - This contains the binary data (geometry, textures, etc.)

Both files are needed to fully represent the 3D model, but the `.gltf` file contains all the structure and metadata in readable JSON format.

## Notes

- The `.gltf` file is a standard JSON file that can be opened in any text editor
- The binary data is extracted to a separate `.bin` file
- The original GLB file is not modified
- You can still use the original GLB file for 3D rendering/viewing


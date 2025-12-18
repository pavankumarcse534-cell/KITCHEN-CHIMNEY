/// <reference path="../types/three-extensions.d.ts" />
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, X, RotateCcw, Grid3x3, Download, Maximize, Minimize, Lightbulb, Eye, EyeOff, ArrowRight, Trash2, Paperclip, Move, MousePointer2, Search, ArrowLeft, ArrowUp, ArrowDown, Circle, CheckSquare, Square, Box, Boxes, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import * as THREE from "three";
// Use extensionless paths to align with type declarations
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

// Helpers to construct loaders/exporters when TS thinks the types are not newable
const createGLTFLoader = () => new (GLTFLoader as unknown as { new(): GLTFLoader })();
const createGLTFExporter = () => new (GLTFExporter as unknown as { new(): GLTFExporter })();

interface GLBViewerProps {
  glbUrl?: string;
  glbUrls?: string[]; // Multiple GLB URLs
  glbFileNames?: string[]; // File names corresponding to glbUrls
  imageUrl?: string;
  modelType?: string; // Current model type for upload
  onGlbExported?: (glbBlob: Blob, filename: string) => void; // Callback when GLB is exported
  length?: number; // Target length in mm
  width?: number; // Target width in mm
  height?: number; // Target height in mm
  modelTypes?: Array<{
    model_type: string;
    title: string;
    preview_url?: string;
    glb_url?: string;
    has_model?: boolean;
    has_preview?: boolean;
  }>; // All model types with preview images
  onModelTypeSelect?: (modelType: string) => void; // Callback when a model type is selected
}

export interface GLBViewerRef {
  exportToGLB: () => void;
}

export const GLBViewer = forwardRef<GLBViewerRef, GLBViewerProps>(({ glbUrl, glbUrls, glbFileNames, imageUrl, modelType, onGlbExported, length, width, height, modelTypes = [], onModelTypeSelect }, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const modelsRef = useRef<any[]>([]); // Store multiple models
  const imagePlaneRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const threeLoadedRef = useRef<boolean>(false);
  const gltfLoaderRef = useRef<any>(null);
  const gltfExporterRef = useRef<any>(null);
  const gridHelperRef = useRef<any>(null);
  const axesHelperRef = useRef<any>(null);
  const initialCameraPositionRef = useRef<any>(null);
  const originalModelSizeRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFileType, setCurrentFileType] = useState<'glb' | 'image' | '3d-object' | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#f6f6f6');
  const [isDragMode, setIsDragMode] = useState(false);
  const [isFullPageScroll, setIsFullPageScroll] = useState(false);
  const [isFullPageMode, setIsFullPageMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedPart, setSelectedPart] = useState<any>(null);
  const [selectedParts, setSelectedParts] = useState<Set<any>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [modelParts, setModelParts] = useState<Array<{ name: string; object: any; category?: string }>>([]);
  const [partsSearchFilter, setPartsSearchFilter] = useState<string>('');
  const [selectedPartName, setSelectedPartName] = useState<string>('');
  const raycasterRef = useRef<any>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Model transformation controls
  const [modelPosition, setModelPosition] = useState({ x: 0, y: 0, z: 0 });
  const [modelRotation, setModelRotation] = useState({ x: 0, y: 0, z: 0 });
  const [modelScale, setModelScale] = useState({ x: 1, y: 1, z: 1 });
  const [rotationStepDeg, setRotationStepDeg] = useState<number>(1); // default 1° steps
  const [nudgeStep, setNudgeStep] = useState<number>(0.01); // default 1cm nudges
  const TARGET_PART_TYPES: Array<{ type: string; label: string }> = [
    { type: 'single_skin_top_part', label: 'Only Top.glb' },
    { type: 'single_skin_right_side_part', label: 'Single Skin Right Side.glb' },
    { type: 'single_skin_left_side_part', label: 'Single Skin Left Side.glb' },
    { type: 'single_skin_front_part', label: 'Single Skin Front Part.glb' },
    { type: 'one_collar_single_skin', label: 'One Collar Hole Single Skin.glb' },
  ];

  // Load Three.js and dependencies from CDN
  useEffect(() => {
    if (threeLoadedRef.current) return;

    // Attach THREE once and create loader/exporter instances
    if (!(window as any).THREE) {
      (window as any).THREE = THREE;
    }
    threeLoadedRef.current = true;
    if (!gltfLoaderRef.current) {
      gltfLoaderRef.current = createGLTFLoader();
    }
    if (!gltfExporterRef.current) {
      gltfExporterRef.current = createGLTFExporter();
    }
  }, []);

  // Load GLTFExporter for exporting scenes to GLB
  const loadGLTFExporter = async (): Promise<GLTFExporter> => {
    if (gltfExporterRef.current) return gltfExporterRef.current;
    gltfExporterRef.current = createGLTFExporter();
    return gltfExporterRef.current;
  };

  // Expose exportToGLB function via ref
  useImperativeHandle(ref, () => ({
    exportToGLB: () => {
      exportToGLBInternal();
    }
  }));

  // Export Three.js scene to GLB
  const exportToGLBInternal = async () => {
    if (!sceneRef.current) {
      toast.error('Scene not initialized');
      return;
    }

    try {
      const THREE = (window as any).THREE;
      if (!THREE) {
        toast.error('Three.js not loaded');
        return;
      }

      setIsLoading(true);
      toast.info('Loading GLTFExporter...');

      // Load GLTFExporter
      const GLTFExporter = await loadGLTFExporter();

      toast.info('Exporting scene to GLB...');

      // Create exporter instance
      const exporter = createGLTFExporter();

      // Export options
      const exportOptions = {
        binary: true, // Export as GLB (binary) instead of GLTF (JSON)
        onlyVisible: false, // Include all objects, not just visible ones
        truncateDrawRange: true,
        embedImages: true, // Embed textures in the GLB file
      };

      // Export the scene
      exporter.parse(
        sceneRef.current,
        async (result: any) => {
          try {
            if (result instanceof ArrayBuffer) {
              // Create blob
              const blob = new Blob([result], { type: 'model/gltf-binary' });
              const timestamp = Date.now();
              const filename = modelType
                ? `${modelType.replace(/_/g, '-')}-${timestamp}.glb`
                : `scene-${timestamp}.glb`;

              // Download file
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);

              // Upload to backend if modelType is provided and callback exists
              if (modelType && onGlbExported) {
                try {
                  toast.info('Uploading exported GLB to backend...');
                  await onGlbExported(blob, filename);
                } catch (uploadError) {
                  console.error('Error uploading GLB:', uploadError);
                  toast.error('GLB exported but failed to upload to backend');
                }
              }

              setIsLoading(false);
              toast.success('Scene exported to GLB successfully!');
            } else {
              // JSON format (shouldn't happen with binary: true, but handle it)
              const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
              const timestamp = Date.now();
              const filename = `scene-${timestamp}.gltf`;
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);

              setIsLoading(false);
              toast.success('Scene exported to GLTF successfully!');
            }
          } catch (downloadError) {
            console.error('Error downloading file:', downloadError);
            setIsLoading(false);
            toast.error('Failed to download exported file');
          }
        },
        (error: any) => {
          console.error('Error exporting scene:', error);
          setIsLoading(false);
          const message = (error && (error.message || error.toString())) || 'Unknown error';
          toast.error(`Export failed: ${message}`);
        },
        exportOptions
      );
    } catch (error) {
      console.error('Error in exportToGLB:', error);
      setIsLoading(false);
      toast.error(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    let cleanup: (() => void) | undefined;
    let checkInterval: NodeJS.Timeout | null = null;

    const initScene = () => {
      // Wait for Three.js to be available on window
      checkInterval = setInterval(() => {
        if ((window as any).THREE) {
          if (checkInterval) clearInterval(checkInterval);
          const THREE = (window as any).THREE;

          const scene = new THREE.Scene();
          scene.background = new THREE.Color(0xf6f6f6);

          const camera = new THREE.PerspectiveCamera(
            45,
            canvasRef.current!.clientWidth / canvasRef.current!.clientHeight,
            0.1,
            1000
          );
          // Initial camera position: Front/Upward view (looking down from above and front)
          camera.position.set(0, 4, 3); // X=0 (centered), Y=4 (elevated above), Z=3 (in front)
          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
          });
          renderer.setSize(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setClearColor(0xf6f6f6, 1);
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;

          // Ensure renderer canvas is visible
          renderer.domElement.style.display = 'block';
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = '100%';

          canvasRef.current!.appendChild(renderer.domElement);

          console.log('Renderer initialized and added to canvas');
          console.log('Canvas size:', canvasRef.current!.clientWidth, 'x', canvasRef.current!.clientHeight);

          // Create smooth orbit controls manually with easing
          let isDragging = false;
          let previousMousePosition = { x: 0, y: 0 };
          let targetSpherical = new THREE.Spherical();
          targetSpherical.setFromVector3(camera.position);
          let currentSpherical = targetSpherical.clone();
          const canvas = renderer.domElement;
          const dampingFactor = 0.15; // Smooth interpolation factor

          const onMouseDown = (e: MouseEvent) => {
            if (e.button === 0) { // Left mouse button only
              isDragging = true;
              previousMousePosition = { x: e.clientX, y: e.clientY };
              canvas.style.cursor = 'grabbing';
            }
          };

          const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            // Improved sensitivity for better control
            const rotationSpeed = 0.008; // Balanced sensitivity
            targetSpherical.theta -= deltaX * rotationSpeed;
            targetSpherical.phi += deltaY * rotationSpeed;
            // Prevent gimbal lock
            targetSpherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, targetSpherical.phi));

            previousMousePosition = { x: e.clientX, y: e.clientY };
          };

          const onMouseUp = () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
          };

          const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // Improved zoom with better sensitivity and smoothness
            const zoomSpeed = 0.15; // Increased for better responsiveness
            const delta = e.deltaY;
            // Use exponential scaling for more natural zoom feel
            const scale = delta > 0 ? 1 + zoomSpeed : 1 / (1 + zoomSpeed);
            targetSpherical.radius *= scale;
            // Better zoom limits
            targetSpherical.radius = Math.max(0.5, Math.min(200, targetSpherical.radius));
          };

          // Smooth camera update in animation loop with improved interpolation
          const updateCamera = () => {
            // Use adaptive damping for smoother movement
            const rotationDamping = 0.2; // Faster rotation response
            const zoomDamping = 0.25; // Faster zoom response

            // Interpolate current spherical towards target for smooth movement
            currentSpherical.theta += (targetSpherical.theta - currentSpherical.theta) * rotationDamping;
            currentSpherical.phi += (targetSpherical.phi - currentSpherical.phi) * rotationDamping;
            currentSpherical.radius += (targetSpherical.radius - currentSpherical.radius) * zoomDamping;

            camera.position.setFromSpherical(currentSpherical);
            camera.lookAt(0, 0, 0);
          };

          canvas.addEventListener('mousedown', onMouseDown);
          canvas.addEventListener('mousemove', onMouseMove);
          canvas.addEventListener('mouseup', onMouseUp);
          canvas.addEventListener('mouseleave', onMouseUp); // Reset on mouse leave
          canvas.addEventListener('wheel', onWheel);
          canvas.style.cursor = 'grab';

          // Add lights
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
          scene.add(ambientLight);
          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
          directionalLight.position.set(5, 10, 5);
          scene.add(directionalLight);

          // Store initial camera position and create controls object
          const initialPos = camera.position.clone();
          const initialTarget = new THREE.Vector3(0, 0, 0);

          initialCameraPositionRef.current = {
            position: initialPos,
            target: initialTarget
          };

          // Create a simple controls object for compatibility with smooth camera update
          const controlsObj = {
            target: initialTarget,
            update: () => {
              camera.lookAt(initialTarget);
            },
            updateCamera: updateCamera // Store smooth camera update function
          };
          controlsRef.current = controlsObj;

          // Add grid helper (respect initial showGrid state)
          const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
          gridHelperRef.current = gridHelper;
          // Add to scene only if showGrid is true
          if (showGrid) {
            scene.add(gridHelper);
          }

          // Add axes helper (respect initial showAxes state)
          const axesHelper = new THREE.AxesHelper(5);
          axesHelperRef.current = axesHelper;
          // Add to scene only if showAxes is true
          if (showAxes) {
            scene.add(axesHelper);
          }

          // Initialize raycaster for part selection
          const raycaster = new THREE.Raycaster();
          raycasterRef.current = raycaster;

          sceneRef.current = scene;
          rendererRef.current = renderer;
          cameraRef.current = camera;

          // Animation loop - continuously render the scene
          let frameCount = 0;
          const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
              // Update smooth camera controls
              if (controlsRef.current && (controlsRef.current as any).updateCamera) {
                (controlsRef.current as any).updateCamera();
              } else if (controlsRef.current && controlsRef.current.update) {
                controlsRef.current.update();
              }
              rendererRef.current.render(sceneRef.current, cameraRef.current);
              frameCount++;
              // Log every 60 frames (roughly once per second at 60fps) for debugging
              if (frameCount % 60 === 0 && sceneRef.current.children.length > 3) {
                console.log('Animation loop running, scene children:', sceneRef.current.children.length);
              }
            }
          };
          animate();
          console.log('Animation loop started');

          // Handle resize
          const handleResize = () => {
            if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
          };
          window.addEventListener('resize', handleResize);

          cleanup = () => {
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('wheel', onWheel);
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            if (rendererRef.current && canvasRef.current) {
              try {
                canvasRef.current.removeChild(rendererRef.current.domElement);
              } catch (e) {
                // Already removed
              }
            }
            rendererRef.current?.dispose();
          };
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        if (!sceneRef.current) {
          toast.error('Failed to initialize 3D viewer');
        }
      }, 10000);
    };

    initScene();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (cleanup) cleanup();
    };
  }, []);

  // Rotation mapping to ensure all models show front side at 0,0,0
  // Models that show back side need 180° rotation on Y axis
  const getModelRotationFix = (modelType: string | undefined): { x?: number; y?: number; z?: number } | null => {
    if (!modelType) return null;

    const MODEL_ROTATION_FIXES: Record<string, { x?: number; y?: number; z?: number }> = {
      // All 17 model types - apply 180° Y rotation to show front side
      'wmss_single_skin_1_sec': { y: Math.PI },
      'wmss_single_skin_2_secs': { y: Math.PI },
      'wmss_single_skin_5_secs': { y: Math.PI },
      'wmch_compensating_1_sec': { y: Math.PI },
      'wmch_compensating_main_assembly_2_sec': { y: Math.PI },
      'wmch_compensating_main_assembly_5_sec': { y: Math.PI },
      'uv_compensating_single_section_1_sec': { y: Math.PI },
      'uv_compensating_main_assembly_2_sec': { y: Math.PI },
      'uv_compensating_main_assembly_5_sec': { y: Math.PI },
      'wmds_double_skin_main_2_sec': { y: Math.PI },
      'wmds_double_skin_main_5_sec': { y: Math.PI },
      'single_skin_top_part': { y: Math.PI },
      'single_skin_top_2_holes': { y: Math.PI },
      'single_skin_right_side_part': { y: Math.PI },
      'single_skin_left_side_part': { y: Math.PI },
      'single_skin_front_part': { y: Math.PI },
      'one_collar_single_skin': { y: Math.PI },
    };

    return MODEL_ROTATION_FIXES[modelType] || null;
  };

  // Apply rotation fix to a model
  const applyRotationFix = (model: any, modelType: string | undefined) => {
    const rotation = getModelRotationFix(modelType);
    if (rotation) {
      if (rotation.x !== undefined) model.rotation.x = rotation.x;
      if (rotation.y !== undefined) model.rotation.y = rotation.y;
      if (rotation.z !== undefined) model.rotation.z = rotation.z;
      model.updateMatrixWorld(true);
      return true;
    }
    return false;
  };

  // Part positioning configuration for WMSS Single Skin 1 Sec and One Collar Single Skin assembly
  // All positions are relative to center axis (0, 0, 0)
  // Positions in meters, rotations in degrees, scale in units
  interface PartPositionConfig {
    position: { x: number; y: number; z: number }; // Position in meters
    rotation: { x: number; y: number; z: number }; // Rotation in degrees
    scale: { x: number; y: number; z: number }; // Scale dimensions
    description: string;
  }

  const PART_POSITION_CONFIG: Record<string, PartPositionConfig> = {
    // Main base parts (centered)
    'wmss_single_skin_1_sec': {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Main base - center axis'
    },
    'one_collar_single_skin': {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Collar hole - center axis'
    },
    // Top part - positioned above main
    'single_skin_top_part': {
      position: { x: 0, y: 1.0, z: 0 }, // 1 meter above center
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Top part - above main (Y: +1.0m)'
    },
    'single_skin_top_2_holes': {
      position: { x: 0, y: 1.0, z: 0 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Top part 2 holes - above main (Y: +1.0m)'
    },
    // Right side part
    'single_skin_right_side_part': {
      position: { x: 0.5, y: 0, z: 0 }, // 0.5 meters to the right
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Right side - right of main (X: +0.5m)'
    },
    // Left side part
    'single_skin_left_side_part': {
      position: { x: -0.5, y: 0, z: 0 }, // 0.5 meters to the left
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Left side - left of main (X: -0.5m)'
    },
    // Front part
    'single_skin_front_part': {
      position: { x: 0, y: 0, z: 0.5 }, // 0.5 meters in front
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      description: 'Front part - front of main (Z: +0.5m)'
    },
  };

  // Helper function to get display name for a part
  const getPartDisplayName = (model: any): string => {
    if (!model) return 'Unknown Part';

    const partType = identifyPartType(model);
    const originalName = model.userData?.originalName || model.userData?.filename || model.name || '';

    // Map part types to display names
    const displayNames: Record<string, string> = {
      'wmss_single_skin_1_sec': 'WMSS SINGLE SKIN 1 SEC',
      'one_collar_single_skin': 'ONE COLLAR HOLE SINGLE SKIN',
      'single_skin_right_side_part': 'Single Skin Right Side',
      'single_skin_left_side_part': 'Single Skin Left Side',
      'single_skin_front_part': 'Single Skin Front Part',
      'single_skin_top_part': 'Single Skin Top Part',
      'single_skin_top_2_holes': 'Single Skin Top 2 Holes',
    };

    if (partType && displayNames[partType]) {
      return displayNames[partType];
    }

    // Fallback to formatted original name
    return originalName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase())
      .substring(0, 30);
  };

  // Helper function to identify part type from filename or model name
  const identifyPartType = (model: any): string | null => {
    if (!model) return null;

    const originalName = model.userData?.originalName || model.userData?.filename || model.name || '';
    const name = originalName.toLowerCase();
    const modelType = model.userData?.modelType || '';

    // Check by model type first
    if (modelType && PART_POSITION_CONFIG[modelType]) {
      return modelType;
    }

    // Check by exact filename patterns first (case-insensitive but preserve structure)
    // Only Top.glb - check early for exact filename match (handles "Only Top", "Only_Top", "only_top", etc.)
    if (name.includes('only top') || name.includes('only_top') ||
      (name.includes('only') && name.includes('top') && !name.includes('2') && !name.includes('hole'))) {
      return 'single_skin_top_part';
    }

    // Single_Skin_Top_part_FSBX, Single_Skin_Top_part_FSBXWUZ, etc.
    if (name.includes('single_skin_top_part') ||
      (name.includes('top') && name.includes('part') && (name.includes('fsbx') || name.includes('single_skin')))) {
      return 'single_skin_top_part';
    }

    // Single_Skin_Right_side_part
    if (name.includes('single_skin_right_side') ||
      (name.includes('right') && name.includes('side') && name.includes('part'))) {
      return 'single_skin_right_side_part';
    }

    // Single_Skin_left_side_part (note: lowercase 'left')
    if (name.includes('single_skin_left_side') ||
      (name.includes('left') && name.includes('side') && name.includes('part'))) {
      return 'single_skin_left_side_part';
    }

    // Single_Skin_Front_Part_7M
    if (name.includes('single_skin_front_part') ||
      (name.includes('front') && name.includes('part') && (name.includes('7m') || name.includes('7_m')))) {
      return 'single_skin_front_part';
    }

    // 1_collar_hole_Single_Skin
    if (name.includes('1_collar_hole') ||
      name.includes('one_collar_hole') ||
      (name.includes('collar') && name.includes('hole') && (name.includes('1') || name.includes('one')))) {
      return 'one_collar_single_skin';
    }

    // Check by filename patterns (handle various naming conventions)
    // Top part patterns: single_skin_top_part, Only Top.glb, Only_Top.glb, etc.
    if ((name.includes('top') && name.includes('part')) || name.includes('top_part') ||
      (name.includes('only') && name.includes('top') && !name.includes('2') && !name.includes('hole'))) {
      if (name.includes('2') || name.includes('two') || name.includes('2_holes')) {
        return 'single_skin_top_2_holes';
      }
      return 'single_skin_top_part';
    }

    // Right side patterns: single_skin_right_side_part, etc.
    if ((name.includes('right') && (name.includes('side') || name.includes('part'))) ||
      name.includes('right_side') || name.includes('rightside')) {
      return 'single_skin_right_side_part';
    }

    // Left side patterns: single_skin_left_side_part, etc.
    if ((name.includes('left') && (name.includes('side') || name.includes('part'))) ||
      name.includes('left_side') || name.includes('leftside')) {
      return 'single_skin_left_side_part';
    }

    // Front part patterns: single_skin_front_part, etc.
    if ((name.includes('front') && name.includes('part')) ||
      name.includes('front_part') || (name.includes('front') && name.includes('7m'))) {
      return 'single_skin_front_part';
    }

    // Collar hole patterns: one_collar_hole_single_skin, etc.
    if ((name.includes('collar') && name.includes('hole')) ||
      name.includes('1_collar') || name.includes('one_collar')) {
      return 'one_collar_single_skin';
    }

    // WMSS single skin 1 sec patterns - more flexible matching
    if ((name.includes('wmss') && name.includes('1') && name.includes('sec')) ||
      name.includes('wmss_single_skin_1_sec') ||
      (name.includes('wmss') && name.includes('single') && name.includes('skin') && name.includes('1'))) {
      return 'wmss_single_skin_1_sec';
    }

    // One collar hole single skin - more flexible matching
    if (name.includes('one_collar') ||
      (name.includes('collar') && name.includes('hole') && (name.includes('single') || name.includes('skin'))) ||
      (name.includes('1_collar') && (name.includes('single') || name.includes('skin')))) {
      return 'one_collar_single_skin';
    }

    return null;
  };

  // Auto-position all parts based on configuration
  const autoPositionAllParts = () => {
    if (!modelsRef.current || modelsRef.current.length === 0) {
      toast.error('No models loaded');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) {
      toast.error('Three.js not loaded');
      return;
    }

    let positionedCount = 0;

    // Find the main base model (wmss_single_skin_1_sec or one_collar_single_skin)
    let mainBaseModel = modelsRef.current.find(m => {
      const partType = identifyPartType(m);
      return partType === 'wmss_single_skin_1_sec' || partType === 'one_collar_single_skin';
    });

    // If no main base found, use first model
    if (!mainBaseModel) {
      mainBaseModel = modelsRef.current[0];
    }

    // Get main base bounding box for reference (use origin as center axis)
    const mainBox = new THREE.Box3().setFromObject(mainBaseModel);
    const mainCenter = new THREE.Vector3();
    mainBox.getCenter(mainCenter);

    // Use origin (0, 0, 0) as the center axis for positioning
    const centerAxis = new THREE.Vector3(0, 0, 0);

    // Position each model based on its type
    modelsRef.current.forEach((model, index) => {
      const partType = identifyPartType(model);

      if (partType && PART_POSITION_CONFIG[partType]) {
        const config = PART_POSITION_CONFIG[partType];

        // Get model's bounding box
        const modelBox = new THREE.Box3().setFromObject(model);
        const modelCenter = new THREE.Vector3();
        modelBox.getCenter(modelCenter);

        // Convert rotation from degrees to radians
        const rotX = (config.rotation.x * Math.PI) / 180;
        const rotY = (config.rotation.y * Math.PI) / 180;
        const rotZ = (config.rotation.z * Math.PI) / 180;

        // Apply rotation first (before scale and position calculations)
        model.rotation.set(rotX, rotY, rotZ);

        // Apply scale
        model.scale.set(config.scale.x, config.scale.y, config.scale.z);

        // Update matrix world to apply rotation and scale
        model.updateMatrixWorld(true);

        // Recalculate bounding box after rotation and scale are applied
        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = new THREE.Vector3();
        const scaledSize = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        scaledBox.getSize(scaledSize);

        // Calculate position: config position is relative to center (0,0,0)
        // We need to position the part so its center aligns with the config position
        // Then adjust for the part's own bounding box center
        const targetPosition = new THREE.Vector3(
          centerAxis.x + config.position.x,
          centerAxis.y + config.position.y,
          centerAxis.z + config.position.z
        );

        // Position the part so its bounding box center aligns with target position
        model.position.set(
          targetPosition.x - scaledCenter.x,
          targetPosition.y - scaledCenter.y,
          targetPosition.z - scaledCenter.z
        );

        // Final update to ensure everything is applied
        model.updateMatrixWorld(true);

        // Update state for this model
        if (modelsRef.current.includes(model)) {
          setModelPosition({
            x: model.position.x,
            y: model.position.y,
            z: model.position.z
          });
          setModelRotation({
            x: (model.rotation.x * 180) / Math.PI,
            y: (model.rotation.y * 180) / Math.PI,
            z: (model.rotation.z * 180) / Math.PI
          });
          setModelScale({
            x: model.scale.x,
            y: model.scale.y,
            z: model.scale.z
          });
        }

        positionedCount++;
        console.log(`✅ Positioned ${partType}:`, {
          position: config.position,
          rotation: config.rotation,
          scale: config.scale,
          description: config.description,
          actualPosition: {
            x: model.position.x.toFixed(3),
            y: model.position.y.toFixed(3),
            z: model.position.z.toFixed(3)
          },
          actualScale: {
            x: model.scale.x.toFixed(3),
            y: model.scale.y.toFixed(3),
            z: model.scale.z.toFixed(3)
          }
        });
      }
    });

    // Adjust camera to fit all models and ensure all parts are visible
    if (modelsRef.current.length > 0 && cameraRef.current && controlsRef.current) {
      const combinedBox = new THREE.Box3();
      modelsRef.current.forEach(model => {
        combinedBox.expandByObject(model);
      });
      const combinedSize = new THREE.Vector3();
      const combinedCenter = new THREE.Vector3();
      combinedBox.getSize(combinedSize);
      combinedBox.getCenter(combinedCenter);

      // Calculate distance to fit all parts with padding
      const maxDim = Math.max(combinedSize.x, combinedSize.y, combinedSize.z);
      // Use larger multiplier and add padding based on actual bounds
      const padding = Math.max(combinedSize.x, combinedSize.y, combinedSize.z) * 0.5; // 50% padding
      const distance = maxDim > 0 ? (maxDim + padding) * 4.0 : 15; // Increased to 4.0x with padding

      // Account for parts that might be at different Y positions (e.g., top part at Y: 1.0)
      const maxY = combinedBox.max.y;
      const minY = combinedBox.min.y;
      const yRange = maxY - minY;

      // Set camera position to view from an angle that shows all parts
      cameraRef.current.position.set(
        combinedCenter.x + distance * 0.7,
        combinedCenter.y + Math.max(distance * 0.8, yRange * 1.5), // Ensure enough height to see top parts
        combinedCenter.z + distance * 0.7
      );

      // Center camera target on the combined center
      controlsRef.current.target.copy(combinedCenter);

      // Ensure camera limits allow viewing all parts
      if (controlsRef.current.minDistance !== undefined) {
        controlsRef.current.minDistance = maxDim * 0.3; // Allow closer zoom
      }
      if (controlsRef.current.maxDistance !== undefined) {
        controlsRef.current.maxDistance = maxDim * 15; // Allow further zoom out
      }

      controlsRef.current.update();
      cameraRef.current.updateProjectionMatrix();

      console.log('📷 Camera adjusted to fit all parts:', {
        boundingBox: {
          min: { x: combinedBox.min.x.toFixed(2), y: combinedBox.min.y.toFixed(2), z: combinedBox.min.z.toFixed(2) },
          max: { x: combinedBox.max.x.toFixed(2), y: combinedBox.max.y.toFixed(2), z: combinedBox.max.z.toFixed(2) },
          size: { x: combinedSize.x.toFixed(2), y: combinedSize.y.toFixed(2), z: combinedSize.z.toFixed(2) }
        },
        combinedCenter: { x: combinedCenter.x.toFixed(2), y: combinedCenter.y.toFixed(2), z: combinedCenter.z.toFixed(2) },
        cameraDistance: distance.toFixed(2),
        cameraPosition: {
          x: cameraRef.current.position.x.toFixed(2),
          y: cameraRef.current.position.y.toFixed(2),
          z: cameraRef.current.position.z.toFixed(2)
        }
      });
    }

    // Force render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    if (positionedCount > 0) {
      toast.success(`Auto-positioned ${positionedCount} part(s) based on configuration`);
    } else {
      toast.warning('No parts were auto-positioned. Check part names match configuration.');
    }
  };

  // Get part configuration for display
  const getPartConfigurations = (): Array<{ partType: string; config: PartPositionConfig }> => {
    return Object.entries(PART_POSITION_CONFIG).map(([partType, config]) => ({
      partType,
      config
    }));
  };

  // Load GLB model using GLTFLoader
  const loadGLB = async (url: string) => {
    console.log('=== loadGLB START ===');
    console.log('URL:', url);
    console.log('Scene exists:', !!sceneRef.current);
    console.log('Camera exists:', !!cameraRef.current);
    console.log('Renderer exists:', !!rendererRef.current);

    // Wait for scene to be initialized (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 100; // 100 attempts * 100ms = 10 seconds
    while ((!sceneRef.current || !cameraRef.current || !rendererRef.current) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`Waiting for scene initialization... (${attempts * 100}ms)`);
      }
    }

    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) {
      const error = 'Scene, camera, or renderer not initialized after 10 seconds. Please refresh the page.';
      console.error(error);
      console.error('Scene:', !!sceneRef.current, 'Camera:', !!cameraRef.current, 'Renderer:', !!rendererRef.current);
      throw new Error(error);
    }

    console.log('Scene initialized successfully!');

    // Don't set loading here - caller manages it
    try {
      const THREE = (window as any).THREE;
      if (!THREE) {
        throw new Error('Three.js not loaded. Please wait a moment and try again.');
      }

      console.log('Loading GLB from URL:', url);
      console.log('Scene initialized:', !!sceneRef.current, 'Camera initialized:', !!cameraRef.current);

      // Load GLTFLoader with retry logic
      let GLTFLoader;
      let retries = 3;
      let lastError: Error | null = null;

      while (retries > 0 && !GLTFLoader) {
        try {
          const THREE = (window as any).THREE;
          if (!THREE) {
            throw new Error('Three.js not loaded yet');
          }

          // Check if already cached
          if (gltfLoaderRef.current) {
            GLTFLoader = gltfLoaderRef.current;
            console.log('Using cached GLTFLoader');
            break;
          }

          // Method 1: Try ES module CDNs (esm.sh, skypack) - handles module resolution
          const cdnSources = [
            'https://esm.sh/three@0.159.0/examples/jsm/loaders/GLTFLoader.js',
            'https://cdn.skypack.dev/three@0.159.0/examples/jsm/loaders/GLTFLoader.js',
            'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/GLTFLoader.js',
            'https://unpkg.com/three@0.159.0/examples/jsm/loaders/GLTFLoader.js'
          ];

          // Check if already loaded
          if ((window as any).THREE && (window as any).THREE.GLTFLoader) {
            GLTFLoader = (window as any).THREE.GLTFLoader;
            gltfLoaderRef.current = GLTFLoader;
            console.log('✅ GLTFLoader already available from THREE');
            break;
          }

          if ((window as any).GLTFLoader) {
            GLTFLoader = (window as any).GLTFLoader;
            gltfLoaderRef.current = GLTFLoader;
            console.log('✅ GLTFLoader already available from window');
            break;
          }

          for (const cdnUrl of cdnSources) {
            try {
              console.log(`Loading GLTFLoader from: ${cdnUrl} (attempt ${4 - retries}/3)...`);

              // Try dynamic import first
              try {
                const module = await import(/* @vite-ignore */ cdnUrl) as any;
                let loader = null;
                if (module && module.GLTFLoader) {
                  loader = module.GLTFLoader;
                } else if (module && module.default) {
                  if (module.default.GLTFLoader) {
                    loader = module.default.GLTFLoader;
                  } else if (typeof module.default === 'function') {
                    loader = module.default;
                  }
                }

                if (loader) {
                  GLTFLoader = loader;
                  gltfLoaderRef.current = GLTFLoader;
                  console.log(`✅ GLTFLoader loaded successfully via dynamic import from ${cdnUrl}`);
                  break;
                }
              } catch (importError) {
                console.warn(`Dynamic import failed from ${cdnUrl}, trying script tag...`, importError);
              }

              // Fallback: script tag with ES module
              await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.type = 'module';
                script.textContent = `
                  import { GLTFLoader } from '${cdnUrl}';
                  window.GLTFLoader = GLTFLoader;
                  window.dispatchEvent(new CustomEvent('GLTFLoaderReady', { detail: GLTFLoader }));
                `;

                const timeout = setTimeout(() => {
                  window.removeEventListener('GLTFLoaderReady', handleReady);
                  reject(new Error(`Timeout loading from ${cdnUrl}`));
                }, 15000);

                const handleReady = (event: any) => {
                  clearTimeout(timeout);
                  window.removeEventListener('GLTFLoaderReady', handleReady);
                  if (event.detail) {
                    GLTFLoader = event.detail;
                    gltfLoaderRef.current = GLTFLoader;
                    console.log(`✅ GLTFLoader loaded successfully via script from ${cdnUrl}`);
                    resolve();
                  } else {
                    reject(new Error(`GLTFLoader not provided from ${cdnUrl}`));
                  }
                };

                window.addEventListener('GLTFLoaderReady', handleReady);

                script.onerror = () => {
                  clearTimeout(timeout);
                  window.removeEventListener('GLTFLoaderReady', handleReady);
                  reject(new Error(`Script load failed from ${cdnUrl}`));
                };

                document.head.appendChild(script);
              });

              if (GLTFLoader) {
                break;
              }
            } catch (cdnError) {
              console.warn(`Failed to load from ${cdnUrl}:`, cdnError);
              lastError = cdnError as Error;
              continue;
            }
          }

          if (GLTFLoader) {
            break;
          }

          // If all methods failed, wait and retry
          if (!GLTFLoader && retries > 1) {
            console.log(`Retrying GLTFLoader load in 500ms... (${retries - 1} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          lastError = error as Error;
          if (retries > 1) {
            console.log(`Error loading GLTFLoader, retrying... (${retries - 1} attempts remaining)`, error);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        retries--;
      }

      if (!GLTFLoader) {
        const errorMsg = lastError
          ? `Failed to load GLTFLoader after 3 attempts: ${lastError.message}. Please check your internet connection and refresh the page.`
          : 'Failed to load GLTFLoader after 3 attempts. Please check your internet connection and refresh the page.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const loader = createGLTFLoader();

      // Note: GLTFLoader doesn't have setErrorHandler method
      // Errors are handled via promise rejection or callback error parameter

      console.log('Fetching GLB file from:', url);
      console.log('GLTFLoader ready, attempting to load GLB...');

      // First, verify the URL is accessible (with CORS check)
      try {
        const urlCheck = await fetch(url, {
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-cache',
        });

        if (!urlCheck.ok) {
          if (urlCheck.status === 404) {
            throw new Error(`GLB file not found at URL: ${url}. Please check if the file was uploaded correctly.`);
          } else if (urlCheck.status >= 500) {
            throw new Error(`Server error (${urlCheck.status}) loading GLB file. Please check backend logs.`);
          } else {
            throw new Error(`HTTP error (${urlCheck.status}) loading GLB file.`);
          }
        }
        console.log('URL accessibility check passed:', urlCheck.status);
      } catch (urlCheckError: any) {
        console.error('URL accessibility check failed:', urlCheckError);
        if (urlCheckError.message?.includes('CORS') || urlCheckError.message?.includes('cross-origin')) {
          throw new Error(`CORS error: Backend server may not allow requests from ${window.location.origin}. Please check CORS settings.`);
        } else if (urlCheckError.message?.includes('Failed to fetch') || urlCheckError.message?.includes('NetworkError')) {
          throw new Error(`Network error: Cannot connect to backend at ${url.split('/').slice(0, 3).join('/')}. Please ensure backend server is running and accessible.`);
        } else if (urlCheckError.message) {
          throw urlCheckError;
        } else {
          throw new Error(`Failed to access GLB file: ${urlCheckError.message || 'Unknown error'}`);
        }
      }

      let gltf;
      try {
        // Use loadAsync with error handling
        gltf = await loader.loadAsync(url);
        console.log('GLB file loaded successfully, processing scene...');
      } catch (loadError: any) {
        console.error('Error loading GLB file from URL:', url);
        console.error('Load error details:', loadError);
        // Provide more helpful error messages
        if (loadError instanceof Error) {
          if (loadError.message.includes('CORS') || loadError.message.includes('cross-origin')) {
            throw new Error(`CORS error loading GLB file. Please ensure the backend server allows requests from ${window.location.origin}. Error: ${loadError.message}`);
          } else if (loadError.message.includes('404') || loadError.message.includes('Not Found')) {
            throw new Error(`GLB file not found at URL: ${url}. Please check if the file was uploaded correctly.`);
          } else if (loadError.message.includes('network') || loadError.message.includes('fetch') || loadError.message.includes('Failed to fetch')) {
            throw new Error(`Network error loading GLB file. Please check if the backend server is running and accessible at ${url.split('/').slice(0, 3).join('/')}`);
          }
        }
        throw new Error(`Failed to load GLB file: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
      }

      const model = gltf.scene;

      if (!model) {
        throw new Error('Failed to load model: model.scene is null or undefined');
      }

      console.log('GLB model loaded, children count:', model.children.length);

      // Remove existing model
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        modelRef.current = null;
      }

      // Remove existing image plane if present
      if (imagePlaneRef.current) {
        sceneRef.current.remove(imagePlaneRef.current);
        if (imagePlaneRef.current.material) {
          imagePlaneRef.current.material.dispose();
        }
        if (imagePlaneRef.current.geometry) {
          imagePlaneRef.current.geometry.dispose();
        }
        imagePlaneRef.current = null;
      }

      // Enable shadows and apply wireframe if needed
      model.traverse((node: any) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          // Apply wireframe mode immediately
          if (node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach((mat: any) => {
                if (mat && typeof mat.wireframe !== 'undefined') {
                  mat.wireframe = wireframe;
                  mat.needsUpdate = true;
                }
              });
            } else {
              if (node.material && typeof node.material.wireframe !== 'undefined') {
                node.material.wireframe = wireframe;
                node.material.needsUpdate = true;
              }
            }
          }
        }
      });

      // Center and scale model - ensure it's perfectly centered in the middle
      // Step 1: Get bounding box of the model BEFORE any transformations
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      console.log('Original model bounds:', {
        min: box.min,
        max: box.max,
        size: { x: size.x, y: size.y, z: size.z },
        center: { x: center.x, y: center.y, z: center.z }
      });

      // Step 2: Reset model position and scale first
      model.position.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.rotation.set(0, 0, 0);

      // Step 3: Center the model at origin (0, 0, 0) by translating it
      // Move the model so its center is exactly at (0, 0, 0)
      model.position.set(-center.x, -center.y, -center.z);

      console.log('Model positioned to center at origin:', {
        originalCenter: { x: center.x, y: center.y, z: center.z },
        modelPosition: { x: model.position.x, y: model.position.y, z: model.position.z },
        rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
        modelType: modelType
      });

      // Store original model size (in Three.js units) for dimension-based scaling
      if (!originalModelSizeRef.current) {
        originalModelSizeRef.current = {
          x: size.x,
          y: size.y,
          z: size.z
        };
        console.log('Stored original model size:', originalModelSizeRef.current);
      }

      // Step 4: Calculate scale based on custom dimensions or fit to view
      let scaleX = 1, scaleY = 1, scaleZ = 1;
      let scaleFactor = 1;

      if (length && width && height && originalModelSizeRef.current) {
        // User provided custom dimensions - scale model to match
        // Convert mm to meters (Three.js uses meters as base unit)
        // 1 mm = 0.001 meters
        const targetLengthM = (length as number) / 1000;
        const targetWidthM = (width as number) / 1000;
        const targetHeightM = (height as number) / 1000;

        // Calculate scale factors for each axis
        // Assuming model's X = length, Y = height, Z = width (common convention)
        // Adjust axis mapping based on your model orientation
        if (originalModelSizeRef.current.x > 0) {
          scaleX = targetLengthM / originalModelSizeRef.current.x;
        }
        if (originalModelSizeRef.current.y > 0) {
          scaleY = targetHeightM / originalModelSizeRef.current.y;
        }
        if (originalModelSizeRef.current.z > 0) {
          scaleZ = targetWidthM / originalModelSizeRef.current.z;
        }

        console.log('Custom dimensions applied:', {
          target: { length: targetLengthM, width: targetWidthM, height: targetHeightM },
          original: originalModelSizeRef.current,
          scale: { x: scaleX, y: scaleY, z: scaleZ }
        });

        // Apply non-uniform scaling
        model.scale.set(scaleX, scaleY, scaleZ);
        scaleFactor = Math.max(scaleX, scaleY, scaleZ); // For logging
      } else {
        // Default: Scale to fit model nicely in view (uniform scaling)
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const targetSize = 2.5; // Target size for the model (slightly larger for better visibility)
          scaleFactor = targetSize / maxDim;
          model.scale.setScalar(scaleFactor);
        }
      }

      console.log('Model centered and scaled:', {
        position: { x: model.position.x, y: model.position.y, z: model.position.z },
        scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
        scaleFactor: scaleFactor
      });

      // Step 5: Recalculate bounding box after centering and scaling
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledSize = new THREE.Vector3();
      const scaledCenter = new THREE.Vector3();
      scaledBox.getSize(scaledSize);
      scaledBox.getCenter(scaledCenter);

      // Ensure model center is exactly at (0, 0, 0) after scaling
      // Adjust position if scaling shifted the center
      if (Math.abs(scaledCenter.x) > 0.001 || Math.abs(scaledCenter.y) > 0.001 || Math.abs(scaledCenter.z) > 0.001) {
        model.position.x -= scaledCenter.x;
        model.position.y -= scaledCenter.y;
        model.position.z -= scaledCenter.z;

        // Recalculate to verify
        const verifyBox = new THREE.Box3().setFromObject(model);
        const verifyCenter = new THREE.Vector3();
        verifyBox.getCenter(verifyCenter);

        console.log('✅ Model re-centered after scaling:', {
          adjustedPosition: { x: model.position.x, y: model.position.y, z: model.position.z },
          verifiedCenter: { x: verifyCenter.x, y: verifyCenter.y, z: verifyCenter.z }
        });
      }

      const finalMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);

      console.log('Scaled model bounds:', {
        size: { x: scaledSize.x, y: scaledSize.y, z: scaledSize.z },
        center: { x: scaledCenter.x, y: scaledCenter.y, z: scaledCenter.z },
        maxDim: finalMaxDim
      });

      // Step 6: Position camera to view centered model from FRONT/UPWARD
      // Calculate distance to fit model nicely in view (with padding)
      const distance = finalMaxDim > 0 ? finalMaxDim * 2.5 : 5;

      // Position camera to show FRONT/UPWARD view (looking down from above and front)
      // Camera positioned above and in front of model, looking straight at origin
      const newPos = new THREE.Vector3(
        0,           // X: centered (no side offset)
        distance * 0.8, // Y: elevated above model (upward view)
        distance * 0.6  // Z: in front of model (front view)
      );

      // Look at the exact center (0, 0, 0) where the model is now centered
      const lookAtTarget = new THREE.Vector3(0, 0, 0);

      cameraRef.current.position.copy(newPos);
      cameraRef.current.lookAt(lookAtTarget);
      cameraRef.current.updateProjectionMatrix();

      // Update initial camera position for reset
      initialCameraPositionRef.current = {
        position: newPos.clone(),
        target: lookAtTarget.clone()
      };

      // Update controls target to center (0, 0, 0)
      if (controlsRef.current) {
        controlsRef.current.target.copy(lookAtTarget);
        controlsRef.current.update();
      }

      // Add model to scene AFTER camera is positioned
      sceneRef.current.add(model);
      modelRef.current = model;

      // Clear previous selection
      if (selectedPart && selectedPart.material) {
        const THREE = (window as any).THREE;
        if (Array.isArray(selectedPart.material)) {
          selectedPart.material.forEach((mat: any) => {
            if (mat.emissive) mat.emissive.setHex(0x000000);
          });
        } else {
          if (selectedPart.material.emissive) {
            selectedPart.material.emissive.setHex(0x000000);
          }
        }
      }
      setSelectedPart(null);

      // Extract and store model parts for selection with better naming
      const parts: Array<{ name: string; object: any; category?: string }> = [];
      model.traverse((child: any) => {
        if (child.isMesh || child.isGroup) {
          let partName = child.name || child.userData.name || `Part_${parts.length + 1}`;
          let category: string | undefined;

          // Try to identify and categorize parts based on naming patterns
          const nameLower = partName.toLowerCase();

          // Identify collars
          if (nameLower.includes('collar') || nameLower.includes('collar_hole') || nameLower.includes('one_collar')) {
            category = 'Collar';
            if (!nameLower.includes('collar')) {
              partName = `Collar - ${partName}`;
            }
          }
          // Identify lights
          else if (nameLower.includes('light') || nameLower.includes('bulb') || nameLower.includes('lamp')) {
            category = 'Light';
            if (!nameLower.includes('light') && !nameLower.includes('bulb') && !nameLower.includes('lamp')) {
              partName = `Light - ${partName}`;
            }
          }
          // Identify main body/frame
          else if (nameLower.includes('main') || nameLower.includes('body') || nameLower.includes('frame') || nameLower.includes('chassis')) {
            category = 'Main Body';
            if (!nameLower.includes('main') && !nameLower.includes('body') && !nameLower.includes('frame') && !nameLower.includes('chassis')) {
              partName = `Main - ${partName}`;
            }
          }
          // Identify sections
          else if (nameLower.includes('section') || nameLower.includes('sec')) {
            category = 'Section';
            if (!nameLower.includes('section') && !nameLower.includes('sec')) {
              partName = `Section - ${partName}`;
            }
          }
          // Identify top parts
          else if (nameLower.includes('top')) {
            category = 'Top';
            if (!nameLower.includes('top')) {
              partName = `Top - ${partName}`;
            }
          }
          // Identify side parts
          else if (nameLower.includes('side') || nameLower.includes('left') || nameLower.includes('right')) {
            category = 'Side';
            if (!nameLower.includes('side') && !nameLower.includes('left') && !nameLower.includes('right')) {
              partName = `Side - ${partName}`;
            }
          }
          // Identify front parts
          else if (nameLower.includes('front')) {
            category = 'Front';
            if (!nameLower.includes('front')) {
              partName = `Front - ${partName}`;
            }
          }
          // Identify skin parts
          else if (nameLower.includes('skin')) {
            category = 'Skin';
            if (!nameLower.includes('skin')) {
              partName = `Skin - ${partName}`;
            }
          }
          // Identify solid parts (Solid1, Solid1_1, Solid1_10, etc.)
          // Check for patterns like: solid1, solid1_1, solid1_10, etc.
          else if (nameLower.includes('solid') || /^solid\d+/.test(nameLower) || /solid\d+_/.test(nameLower)) {
            category = 'Solid';
            // Keep original name but ensure it's clear it's a solid part
            if (!nameLower.includes('solid')) {
              partName = `Solid - ${partName}`;
            }
          }
          // Also check for Part_1, Part_2 patterns that might be solid parts
          else if (/^part_\d+$/i.test(partName)) {
            category = 'Solid';
            partName = `Solid - ${partName}`;
          }
          // Default category for generic parts
          else {
            category = 'Component';
          }

          // Make parts selectable
          child.userData.isSelectable = true;
          child.userData.originalName = partName;
          child.userData.category = category;
          parts.push({ name: partName, object: child, category });
        }
      });

      // Sort parts by category and name
      parts.sort((a, b) => {
        const categoryOrder: Record<string, number> = {
          'Collar': 1,
          'Light': 2,
          'Main Body': 3,
          'Section': 4,
          'Top': 5,
          'Side': 6,
          'Front': 7,
          'Skin': 8,
          'Solid': 9,
          'Component': 10
        };
        const aOrder = categoryOrder[a.category || 'Component'] || 10;
        const bOrder = categoryOrder[b.category || 'Component'] || 10;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // For solid parts, sort numerically (Solid1_10 comes after Solid1_9)
        if (a.category === 'Solid' && b.category === 'Solid') {
          const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0');
          if (aNum !== bNum) return aNum - bNum;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      setModelParts(parts);
      console.log(`✅ Extracted ${parts.length} selectable parts from model`);

      // Apply model-specific rotation fixes AFTER model is added to scene
      // This ensures all models show front side at 0,0,0, aligned with X, Y, Z axes
      // Reset rotation first to ensure clean alignment
      model.rotation.set(0, 0, 0);

      if (applyRotationFix(model, modelType)) {
        const rotation = getModelRotationFix(modelType);
        console.log(`✅ Applied rotation fix for ${modelType}:`, rotation);
        console.log('   Final rotation:', { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z });

        // Force render after rotation
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      } else {
        // Ensure model is aligned with axes even if no rotation fix needed
        model.rotation.set(0, 0, 0);
        console.log(`✅ Model ${modelType} aligned with axes (no rotation fix needed)`);
      }

      // Sync transformation state with loaded model
      setModelPosition({
        x: model.position.x,
        y: model.position.y,
        z: model.position.z
      });
      setModelRotation({
        x: (model.rotation.x * 180) / Math.PI,
        y: (model.rotation.y * 180) / Math.PI,
        z: (model.rotation.z * 180) / Math.PI
      });
      setModelScale({
        x: model.scale.x,
        y: model.scale.y,
        z: model.scale.z
      });

      // Final verification: Ensure model center is exactly at (0, 0, 0)
      const finalBox = new THREE.Box3().setFromObject(model);
      const finalCenter = new THREE.Vector3();
      finalBox.getCenter(finalCenter);

      // Force center to (0, 0, 0) if it's not already there
      if (Math.abs(finalCenter.x) > 0.001 || Math.abs(finalCenter.y) > 0.001 || Math.abs(finalCenter.z) > 0.001) {
        console.log('⚠️ Final adjustment to ensure center at (0,0,0):', {
          before: { x: finalCenter.x.toFixed(4), y: finalCenter.y.toFixed(4), z: finalCenter.z.toFixed(4) }
        });
        model.position.x -= finalCenter.x;
        model.position.y -= finalCenter.y;
        model.position.z -= finalCenter.z;

        // Verify again
        const verifyBox = new THREE.Box3().setFromObject(model);
        const verifyCenter = new THREE.Vector3();
        verifyBox.getCenter(verifyCenter);

        console.log('✅ Model centered at origin (0,0,0):', {
          modelPosition: { x: model.position.x.toFixed(4), y: model.position.y.toFixed(4), z: model.position.z.toFixed(4) },
          verifiedCenter: { x: verifyCenter.x.toFixed(4), y: verifyCenter.y.toFixed(4), z: verifyCenter.z.toFixed(4) }
        });
      } else {
        console.log('✅ Model already centered at origin (0,0,0)');
      }

      console.log('✅ Model added to scene and centered at (0,0,0)');
      console.log('   Scene children count:', sceneRef.current.children.length);
      console.log('   Model position:', { x: model.position.x.toFixed(4), y: model.position.y.toFixed(4), z: model.position.z.toFixed(4) });
      console.log('   Model center:', { x: finalCenter.x.toFixed(4), y: finalCenter.y.toFixed(4), z: finalCenter.z.toFixed(4) });
      console.log('   Model scale:', { x: model.scale.x.toFixed(4), y: model.scale.y.toFixed(4), z: model.scale.z.toFixed(4) });
      console.log('   Camera position:', { x: newPos.x.toFixed(4), y: newPos.y.toFixed(4), z: newPos.z.toFixed(4) });
      console.log('   Camera looking at:', { x: lookAtTarget.x.toFixed(4), y: lookAtTarget.y.toFixed(4), z: lookAtTarget.z.toFixed(4) });
      console.log('   Final max dimension:', finalMaxDim.toFixed(4));
      console.log('   Camera distance:', distance.toFixed(4));

      // Force multiple renders to ensure model is visible immediately
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Render multiple times to ensure visibility
        for (let i = 0; i < 5; i++) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        console.log('Forced 5 renders after model load');

        // Also trigger renders in the next few frames
        requestAnimationFrame(() => {
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        });
        setTimeout(() => {
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            console.log('Additional render after 100ms delay');
          }
        }, 100);
        setTimeout(() => {
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            console.log('Additional render after 300ms delay');
          }
        }, 300);
      }

      setCurrentFile(url);
      setCurrentFileType('glb');
      // Don't set loading to false here - let the caller manage it
      // This prevents race conditions when called from upload handlers
      console.log('=== loadGLB SUCCESS ===');
      console.log('GLB model loaded and added to scene successfully');
    } catch (error) {
      console.error('Error loading GLB:', error);
      // Don't set loading to false here - let the caller manage it
      throw error; // Re-throw so caller can handle it
    }
  };

  // Load GLB from URL prop

  // Load and display image
  const loadImage = async (url: string) => {
    console.log('=== loadImage START ===');
    console.log('URL:', url);
    console.log('Scene exists:', !!sceneRef.current);
    console.log('Camera exists:', !!cameraRef.current);
    console.log('Renderer exists:', !!rendererRef.current);

    // Wait for scene to be initialized (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 100; // 100 attempts * 100ms = 10 seconds
    while ((!sceneRef.current || !cameraRef.current || !rendererRef.current) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`Waiting for scene initialization... (${attempts * 100}ms)`);
      }
    }

    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) {
      const error = 'Scene, camera, or renderer not initialized after 10 seconds. Please refresh the page.';
      console.error(error);
      console.error('Scene:', !!sceneRef.current, 'Camera:', !!cameraRef.current, 'Renderer:', !!rendererRef.current);
      throw new Error(error);
    }

    console.log('Scene initialized successfully!');

    // Don't set loading here - caller manages it
    try {
      const THREE = (window as any).THREE;
      if (!THREE) {
        throw new Error('Three.js not loaded. Please wait a moment and try again.');
      }

      console.log('Loading image from URL:', url);
      console.log('Scene initialized:', !!sceneRef.current, 'Camera initialized:', !!cameraRef.current);

      // Remove existing model or image
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        modelRef.current = null;
      }

      if (imagePlaneRef.current) {
        sceneRef.current.remove(imagePlaneRef.current);
        if (imagePlaneRef.current.material) {
          imagePlaneRef.current.material.dispose();
        }
        if (imagePlaneRef.current.geometry) {
          imagePlaneRef.current.geometry.dispose();
        }
        imagePlaneRef.current = null;
      }

      // First, verify the URL is accessible (with CORS check)
      try {
        const urlCheck = await fetch(url, {
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-cache',
        });

        if (!urlCheck.ok) {
          if (urlCheck.status === 404) {
            throw new Error(`Image file not found at URL: ${url}. Please check if the file was uploaded correctly.`);
          } else if (urlCheck.status >= 500) {
            throw new Error(`Server error (${urlCheck.status}) loading image. Please check backend logs.`);
          } else {
            throw new Error(`HTTP error (${urlCheck.status}) loading image.`);
          }
        }
        console.log('Image URL accessibility check passed:', urlCheck.status);
      } catch (urlCheckError: any) {
        console.error('Image URL accessibility check failed:', urlCheckError);
        if (urlCheckError.message?.includes('CORS') || urlCheckError.message?.includes('cross-origin')) {
          throw new Error(`CORS error: Backend server may not allow requests from ${window.location.origin}. Please check CORS settings.`);
        } else if (urlCheckError.message?.includes('Failed to fetch') || urlCheckError.message?.includes('NetworkError')) {
          throw new Error(`Network error: Cannot connect to backend at ${url.split('/').slice(0, 3).join('/')}. Please ensure backend server is running and accessible.`);
        } else if (urlCheckError.message) {
          throw urlCheckError;
        } else {
          throw new Error(`Failed to access image file: ${urlCheckError.message || 'Unknown error'}`);
        }
      }

      // Load texture
      const textureLoader = new THREE.TextureLoader();
      const texture = await new Promise((resolve, reject) => {
        textureLoader.load(
          url,
          (texture: any) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            resolve(texture);
          },
          undefined,
          (error: any) => {
            console.error('TextureLoader error:', error);
            if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
              reject(new Error(`CORS error loading image. Please ensure the backend server allows requests from ${window.location.origin}.`));
            } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
              reject(new Error(`Image file not found at URL: ${url}. Please check if the file was uploaded correctly.`));
            } else if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
              reject(new Error(`Network error loading image. Please check if the backend server is running and accessible at ${url.split('/').slice(0, 3).join('/')}`));
            } else {
              reject(error);
            }
          }
        );
      }) as any;

      // Create plane geometry for image
      const aspectRatio = texture.image.width / texture.image.height;
      const planeSize = 5; // Base size
      const width = aspectRatio > 1 ? planeSize * aspectRatio : planeSize;
      const height = aspectRatio > 1 ? planeSize : planeSize / aspectRatio;

      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(geometry, material);

      // Position plane in front of camera
      plane.position.set(0, 0, 0);
      plane.rotation.y = Math.PI; // Face the camera

      sceneRef.current.add(plane);
      imagePlaneRef.current = plane;

      // Update camera to view image
      const maxDim = Math.max(width, height);
      const distance = maxDim * 1.5;
      const newPos = new THREE.Vector3(0, 0, distance);
      cameraRef.current.position.copy(newPos);
      cameraRef.current.lookAt(0, 0, 0);

      // Update initial camera position for reset
      initialCameraPositionRef.current = {
        position: newPos.clone(),
        target: new THREE.Vector3(0, 0, 0)
      };

      // Update controls target
      if (controlsRef.current) {
        controlsRef.current.target = new THREE.Vector3(0, 0, 0);
      }

      // Force multiple renders to ensure image is visible immediately
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Render multiple times to ensure visibility
        for (let i = 0; i < 3; i++) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        console.log('Forced 3 renders after image load');

        // Also trigger a render in the next frame
        requestAnimationFrame(() => {
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        });
      }

      setCurrentFile(url);
      setCurrentFileType('image');
      // Don't set loading to false here - let the caller manage it
      // This prevents race conditions when called from upload handlers
      console.log('=== loadImage SUCCESS ===');
      console.log('Image loaded and displayed successfully');
    } catch (error) {
      console.error('Error loading image:', error);
      // Don't set loading to false here - let the caller manage it
      throw error; // Re-throw so caller can handle it
    }
  };


  // Load multiple GLB files
  useEffect(() => {
    console.log('🔄 GLBViewer - glbUrls useEffect triggered:', {
      glbUrls: glbUrls?.length || 0,
      urls: glbUrls,
      currentModels: modelsRef.current.length
    });

    if (!glbUrls || glbUrls.length === 0) {
      // Clear all models if URLs are removed
      if (modelsRef.current.length > 0 && sceneRef.current) {
        console.log('🔄 Clearing all models (glbUrls is empty)');
        modelsRef.current.forEach(model => {
          sceneRef.current.remove(model);
        });
        modelsRef.current = [];
      }
      return;
    }

    const loadMultipleModels = async () => {
      setIsLoading(true);

      try {
        // Wait for Three.js to be ready
        let attempts = 0;
        while ((!threeLoadedRef.current || !sceneRef.current) && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }

        if (!threeLoadedRef.current || !sceneRef.current) {
          setIsLoading(false);
          toast.error('3D viewer not ready. Please refresh the page.');
          return;
        }

        // Clear existing models
        modelsRef.current.forEach(model => {
          if (sceneRef.current) {
            sceneRef.current.remove(model);
          }
        });
        modelsRef.current = [];

        // Load all GLB files - use a modified version that doesn't remove existing models
        for (let i = 0; i < glbUrls.length; i++) {
          const url = glbUrls[i];
          if (!url) continue;

          try {
            console.log(`Loading model ${i + 1}/${glbUrls.length}: ${url}`);

            // Load GLB without removing existing models (only remove on first load)
            const THREE = (window as any).THREE;
            if (!THREE) {
              throw new Error('Three.js not loaded');
            }

            // Load GLTFLoader if needed (reuse existing logic)
            let GLTFLoader = gltfLoaderRef.current;
            if (!GLTFLoader) {
              // Use the same loading logic from loadGLB
              if ((window as any).THREE && (window as any).THREE.GLTFLoader) {
                GLTFLoader = (window as any).THREE.GLTFLoader;
              } else if ((window as any).GLTFLoader) {
                GLTFLoader = (window as any).GLTFLoader;
              } else {
                // Try loading from CDN
                const cdnUrl = 'https://esm.sh/three@0.159.0/examples/jsm/loaders/GLTFLoader.js';
                try {
                  const module = await import(/* @vite-ignore */ cdnUrl) as any;
                  GLTFLoader = module.GLTFLoader || module.default?.GLTFLoader || module.default;
                  gltfLoaderRef.current = GLTFLoader;
                } catch (e) {
                  console.warn('Failed to load GLTFLoader from CDN, trying alternative...', e);
                }
              }
              if (!GLTFLoader) {
                throw new Error('Failed to load GLTFLoader');
              }
            }

            const loader = createGLTFLoader();

            // Load the GLB file with progress tracking
            console.log(`🔄 Starting to load GLB: ${url}`);
            const gltf = await loader.loadAsync(
              url,
              (progress) => {
                if (progress.lengthComputable) {
                  const percent = (progress.loaded / progress.total) * 100;
                  console.log(`📥 Loading progress ${i + 1}/${glbUrls.length}: ${percent.toFixed(1)}%`);
                }
              }
            );
            const model = gltf.scene;

            if (!model) {
              throw new Error('Failed to load model: model.scene is null');
            }

            console.log(`✅ Successfully loaded GLB ${i + 1}/${glbUrls.length}: ${url}`);

            // Only remove existing models on the first load
            if (i === 0) {
              // Remove existing model and image
              if (modelRef.current) {
                sceneRef.current.remove(modelRef.current);
                modelRef.current.traverse((child: any) => {
                  if (child.geometry) child.geometry.dispose();
                  if (child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach((mat: any) => mat.dispose());
                    } else {
                      child.material.dispose();
                    }
                  }
                });
                modelRef.current = null;
              }
              if (imagePlaneRef.current) {
                sceneRef.current.remove(imagePlaneRef.current);
                if (imagePlaneRef.current.material) imagePlaneRef.current.material.dispose();
                if (imagePlaneRef.current.geometry) imagePlaneRef.current.geometry.dispose();
                imagePlaneRef.current = null;
              }
            }

            // Enable shadows
            model.traverse((node: any) => {
              if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                  if (Array.isArray(node.material)) {
                    node.material.forEach((mat: any) => {
                      if (mat && typeof mat.wireframe !== 'undefined') {
                        mat.wireframe = wireframe;
                        mat.needsUpdate = true;
                      }
                    });
                  } else {
                    if (node.material && typeof node.material.wireframe !== 'undefined') {
                      node.material.wireframe = wireframe;
                      node.material.needsUpdate = true;
                    }
                  }
                }
              }
            });

            // Try to identify part type and use config positioning
            const partType = identifyPartType(model);
            const config = partType ? PART_POSITION_CONFIG[partType] : null;

            if (config) {
              // Use configuration-based positioning
              const rotX = (config.rotation.x * Math.PI) / 180;
              const rotY = (config.rotation.y * Math.PI) / 180;
              const rotZ = (config.rotation.z * Math.PI) / 180;

              // Apply rotation first
              model.rotation.set(rotX, rotY, rotZ);

              // Apply scale from config
              model.scale.set(config.scale.x, config.scale.y, config.scale.z);

              // Update matrix world to apply transformations
              model.updateMatrixWorld(true);

              // Get bounding box after rotation and scale are applied
              const scaledBox = new THREE.Box3().setFromObject(model);
              const scaledCenter = new THREE.Vector3();
              const scaledSize = new THREE.Vector3();
              scaledBox.getCenter(scaledCenter);
              scaledBox.getSize(scaledSize);

              // Position relative to center (0,0,0)
              const centerAxis = new THREE.Vector3(0, 0, 0);
              const targetPosition = new THREE.Vector3(
                centerAxis.x + config.position.x,
                centerAxis.y + config.position.y,
                centerAxis.z + config.position.z
              );

              // Position the part so its bounding box center aligns with target position
              model.position.set(
                targetPosition.x - scaledCenter.x,
                targetPosition.y - scaledCenter.y,
                targetPosition.z - scaledCenter.z
              );

              // Final update to ensure all transformations are applied
              model.updateMatrixWorld(true);

              // Verify final bounding box to ensure part stays within bounds
              const finalBox = new THREE.Box3().setFromObject(model);
              const finalMin = finalBox.min;
              const finalMax = finalBox.max;

              console.log(`✅ Positioned ${partType} using config:`, {
                config: config.position,
                actualPosition: {
                  x: model.position.x.toFixed(3),
                  y: model.position.y.toFixed(3),
                  z: model.position.z.toFixed(3)
                },
                boundingBox: {
                  min: { x: finalMin.x.toFixed(3), y: finalMin.y.toFixed(3), z: finalMin.z.toFixed(3) },
                  max: { x: finalMax.x.toFixed(3), y: finalMax.y.toFixed(3), z: finalMax.z.toFixed(3) },
                  size: { x: scaledSize.x.toFixed(3), y: scaledSize.y.toFixed(3), z: scaledSize.z.toFixed(3) }
                }
              });
            } else {
              // Fallback to grid layout for unrecognized parts
              const modelsPerRow = Math.ceil(Math.sqrt(glbUrls.length));
              const totalRows = Math.ceil(glbUrls.length / modelsPerRow);
              const row = Math.floor(i / modelsPerRow);
              const col = i % modelsPerRow;

              // Get bounding box BEFORE any transformations
              const box = new THREE.Box3().setFromObject(model);
              const center = new THREE.Vector3();
              const size = new THREE.Vector3();
              box.getCenter(center);
              box.getSize(size);

              // Scale to fit nicely FIRST (before positioning)
              const maxDim = Math.max(size.x, size.y, size.z);
              let scaledSize = size.clone();
              if (maxDim > 0) {
                const targetSize = 2.0; // Target size for each model
                const scaleFactor = targetSize / maxDim;
                model.scale.setScalar(scaleFactor);

                // Recalculate size after scaling
                scaledSize.multiplyScalar(scaleFactor);
              }

              // Calculate spacing based on scaled model size (ensure no overlap)
              const scaledMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
              const spacing = scaledMaxDim > 0 ? scaledMaxDim * 2.5 : 5; // Space between model centers

              // Calculate grid offsets to center all models around origin
              const totalWidth = (modelsPerRow - 1) * spacing;
              const totalDepth = (totalRows - 1) * spacing;
              const offsetX = totalWidth / 2;
              const offsetZ = totalDepth / 2;

              // Calculate target position for this model's center
              const targetX = (col * spacing) - offsetX;
              const targetY = 0; // Keep all models at ground level (Y=0)
              const targetZ = (row * spacing) - offsetZ;

              // Get center AFTER scaling (scaling may have shifted it)
              const scaledBox = new THREE.Box3().setFromObject(model);
              const scaledCenter = new THREE.Vector3();
              scaledBox.getCenter(scaledCenter);

              // Position model so its center is at the target position
              model.position.set(
                targetX - scaledCenter.x,
                targetY - scaledCenter.y,
                targetZ - scaledCenter.z
              );
            }

            // Store filename in userData for identification
            const filename = url.split('/').pop() || `Model ${i + 1}`;
            model.userData.originalName = filename;
            model.userData.filename = filename;
            model.userData.modelIndex = i;
            model.userData.modelType = modelType || identifyPartType(model) || ''; // Store modelType if available
            model.name = filename;

            // Log positioning info
            const finalBox = new THREE.Box3().setFromObject(model);
            const finalCenter = new THREE.Vector3();
            const finalSize = new THREE.Vector3();
            finalBox.getCenter(finalCenter);
            finalBox.getSize(finalSize);

            console.log(`✅ Model ${i + 1} positioned:`, {
              partType: partType || 'unrecognized',
              finalPosition: { x: model.position.x.toFixed(3), y: model.position.y.toFixed(3), z: model.position.z.toFixed(3) },
              finalCenter: { x: finalCenter.x.toFixed(3), y: finalCenter.y.toFixed(3), z: finalCenter.z.toFixed(3) },
              finalSize: { x: finalSize.x.toFixed(3), y: finalSize.y.toFixed(3), z: finalSize.z.toFixed(3) },
              scale: { x: model.scale.x.toFixed(3), y: model.scale.y.toFixed(3), z: model.scale.z.toFixed(3) },
              rotation: { x: (model.rotation.x * 180 / Math.PI).toFixed(2), y: (model.rotation.y * 180 / Math.PI).toFixed(2), z: (model.rotation.z * 180 / Math.PI).toFixed(2) },
              filename
            });

            // Add model to scene
            sceneRef.current.add(model);
            modelsRef.current.push(model);

            console.log(`✅ Loaded model ${i + 1}/${glbUrls.length} at position:`, model.position);
          } catch (error: any) {
            console.error(`Error loading GLB file ${url}:`, error);
            toast.error(`Failed to load model ${i + 1}: ${url.split('/').pop()}`);
          }
        }

        // Set the first model as the primary modelRef for compatibility
        if (modelsRef.current.length > 0) {
          modelRef.current = modelsRef.current[0];
          setCurrentFile(glbUrls[0]);
          setCurrentFileType('glb');
          setCurrentFileIndex(0);

          // Adjust camera to view all models and ensure all parts are visible
          const THREE = (window as any).THREE;
          if (THREE && sceneRef.current && cameraRef.current) {
            // Calculate bounding box of all models
            const allModelsBox = new THREE.Box3();
            modelsRef.current.forEach(model => {
              // Ensure model matrix is updated before expanding box
              model.updateMatrixWorld(true);
              allModelsBox.expandByObject(model);
            });

            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            allModelsBox.getSize(size);
            allModelsBox.getCenter(center);

            // Calculate maximum dimension including padding to ensure all parts are visible
            const maxDim = Math.max(size.x, size.y, size.z);
            // Use larger multiplier and add padding based on actual bounds
            const padding = Math.max(size.x, size.y, size.z) * 0.5; // 50% padding
            const distance = maxDim > 0 ? (maxDim + padding) * 4.0 : 15; // Increased to 4.0x with padding

            // Position camera to view all models from an angle that shows all parts
            // Account for parts that might be at Y: 1.0 (top part)
            const maxY = allModelsBox.max.y;
            const minY = allModelsBox.min.y;
            const yRange = maxY - minY;

            const newPos = new THREE.Vector3(
              center.x + distance * 0.7,
              center.y + Math.max(distance * 0.8, yRange * 1.5), // Ensure enough height to see top parts
              center.z + distance * 0.7
            );

            cameraRef.current.position.copy(newPos);
            cameraRef.current.lookAt(center);
            cameraRef.current.updateProjectionMatrix();

            if (controlsRef.current) {
              controlsRef.current.target.copy(center);
              // Set camera limits to allow viewing all parts
              if (controlsRef.current.minDistance !== undefined) {
                controlsRef.current.minDistance = maxDim * 0.3; // Allow closer zoom
              }
              if (controlsRef.current.maxDistance !== undefined) {
                controlsRef.current.maxDistance = maxDim * 15; // Allow further zoom out
              }
              controlsRef.current.update();
            }

            initialCameraPositionRef.current = {
              position: newPos.clone(),
              target: center.clone()
            };

            console.log('📷 Camera adjusted to fit all parts:', {
              boundingBox: {
                min: { x: allModelsBox.min.x.toFixed(2), y: allModelsBox.min.y.toFixed(2), z: allModelsBox.min.z.toFixed(2) },
                max: { x: allModelsBox.max.x.toFixed(2), y: allModelsBox.max.y.toFixed(2), z: allModelsBox.max.z.toFixed(2) },
                size: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) }
              },
              center: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) },
              cameraDistance: distance.toFixed(2),
              cameraPosition: {
                x: newPos.x.toFixed(2),
                y: newPos.y.toFixed(2),
                z: newPos.z.toFixed(2)
              }
            });
          }
        }

        setIsLoading(false);
        if (modelsRef.current.length > 0) {
          toast.success(`✅ Loaded ${modelsRef.current.length} model(s) successfully`);
          console.log(`✅ All ${modelsRef.current.length} models loaded and positioned`);
          console.log(`✅ Models in scene:`, modelsRef.current.length);
          setCurrentFile(glbUrls[0]);
          setCurrentFileType('glb');
          setCurrentFileIndex(0);
        } else {
          toast.warning('⚠️ No models were loaded. Please check GLB file URLs.');
          console.warn('⚠️ No models loaded - check GLB URLs:', glbUrls);
        }
      } catch (error: any) {
        setIsLoading(false);
        console.error('❌ Error loading multiple models:', error);
        toast.error(`Error loading models: ${error.message}`);
      }
    };

    loadMultipleModels();
  }, [glbUrls]);

  // Load GLB from single URL prop (backward compatibility)
  useEffect(() => {
    // Skip if glbUrls is provided (use multiple files instead)
    if (glbUrls && glbUrls.length > 0) {
      return;
    }

    console.log('=== GLBViewer useEffect triggered ===');
    console.log('GLBViewer - glbUrl prop:', glbUrl);
    console.log('GLBViewer - currentFile state:', currentFile);
    console.log('GLBViewer - currentFileType:', currentFileType);
    console.log('GLBViewer - threeLoaded:', threeLoadedRef.current);
    console.log('GLBViewer - sceneRef exists:', !!sceneRef.current);
    console.log('GLBViewer - modelRef exists:', !!modelRef.current);

    if (!glbUrl) {
      // Clear GLB if URL is removed
      if (currentFile && currentFileType === 'glb' && modelRef.current && sceneRef.current) {
        console.log('GLBViewer - Clearing GLB model (URL is empty)');
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
        originalModelSizeRef.current = null; // Reset original size
        setCurrentFile(null);
        setCurrentFileType(null);
      }
      setIsLoading(false);
      return;
    }

    // Only skip if URL is the same AND we already have a loaded model
    // This allows reloading if the model was cleared
    if (glbUrl === currentFile && currentFile && modelRef.current) {
      console.log('GLBViewer - GLB URL unchanged and model already loaded, skipping reload');
      return;
    }

    // Reset original model size when loading a new model
    if (glbUrl !== currentFile) {
      originalModelSizeRef.current = null;
      console.log('GLBViewer - Resetting original model size for new model');
    }

    console.log('GLBViewer - Will load GLB (URL changed or model not loaded)');

    const loadModel = async () => {
      // Set loading state immediately
      setIsLoading(true);

      // Set a timeout to prevent infinite loading (5 minutes max)
      let loadingTimeout: NodeJS.Timeout | null = setTimeout(() => {
        console.error('GLBViewer - Loading timeout after 5 minutes');
        setIsLoading(false);
        toast.error('Loading timeout: The 3D model is taking too long to load. Please check the file or try again.');
      }, 5 * 60 * 1000);

      try {
        // Wait for Three.js to be ready (max 10 seconds)
        let attempts = 0;
        while ((!threeLoadedRef.current || !sceneRef.current) && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
          if (attempts % 4 === 0) {
            console.log(`Waiting for Three.js initialization... (${attempts * 500}ms)`);
          }
        }

        if (!threeLoadedRef.current || !sceneRef.current) {
          console.error('GLBViewer - Three.js not initialized after waiting');
          console.error('threeLoadedRef.current:', threeLoadedRef.current);
          console.error('sceneRef.current:', sceneRef.current);
          if (loadingTimeout) clearTimeout(loadingTimeout);
          setIsLoading(false);
          toast.error('3D viewer not ready. Please refresh the page.');
          return;
        }

        console.log('GLBViewer - Three.js is ready, proceeding with GLB load');

        // Load if URL is different or if we don't have a current file
        if (glbUrl && (glbUrl !== currentFile || !currentFile)) {
          console.log('GLBViewer - Loading GLB:', glbUrl);
          console.log('GLBViewer - Current file:', currentFile);

          // Validate URL before attempting to load
          try {
            new URL(glbUrl); // Validate URL format
          } catch (urlError) {
            throw new Error(`Invalid GLB URL: ${glbUrl}`);
          }

          // Try to verify URL is accessible (skip if CORS blocks it)
          // Note: CORS may block HEAD requests, so we'll try to load anyway
          try {
            const urlCheck = await fetch(glbUrl, {
              method: 'HEAD',
              mode: 'cors',
              cache: 'no-cache',
            });

            if (!urlCheck.ok && urlCheck.status !== 0) {
              if (urlCheck.status === 404) {
                console.error(`GLB file not found (404) at: ${glbUrl}`);
                throw new Error(`GLB file not found (404). Please upload a GLB file using the "Upload GLB" button.`);
              } else if (urlCheck.status >= 500) {
                console.error(`Server error (${urlCheck.status})`);
                throw new Error(`Server error (${urlCheck.status}). Please check backend logs.`);
              } else {
                console.warn(`URL check returned status ${urlCheck.status}, but will attempt to load anyway`);
              }
            } else {
              console.log('✅ GLB URL verified, file exists (status:', urlCheck.status, ')');
            }
          } catch (fetchError: any) {
            // CORS errors are OK - we'll still try to load the file directly
            if (fetchError.message?.includes('CORS') || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
              console.log('⚠️ CORS/Network check failed, but will attempt to load GLB directly (this is normal)');
              // Don't throw - continue to load the file
            } else if (fetchError.message?.includes('404') || fetchError.message?.includes('Not Found') || fetchError.message?.includes('GLB file not found')) {
              throw fetchError; // Re-throw 404 errors
            } else {
              console.warn('⚠️ URL check warning:', fetchError.message);
              // Don't throw - still try to load the file (might be a CORS issue)
            }
          }

          // Load the GLB file
          console.log('Attempting to load GLB file:', glbUrl);

          await loadGLB(glbUrl);
          if (loadingTimeout) clearTimeout(loadingTimeout);
          setCurrentFile(glbUrl);
          setCurrentFileType('glb');
          setIsLoading(false);
          console.log('✅ GLBViewer - GLB loaded successfully');
          console.log('✅ Current file set to:', glbUrl);

          // Force multiple renders to ensure visibility
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            // Immediate render
            rendererRef.current.render(sceneRef.current, cameraRef.current);

            // Render in next frame
            requestAnimationFrame(() => {
              if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
              }
            });

            // Additional renders after delays
            setTimeout(() => {
              if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
                console.log('✅ Additional render after 100ms');
              }
            }, 100);

            setTimeout(() => {
              if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
                console.log('✅ Additional render after 300ms');
              }
            }, 300);
          }
        } else {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          setIsLoading(false);
        }
      } catch (error: any) {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setIsLoading(false);
        let errorMsg = 'Failed to load 3D model.';

        if (error.message?.includes('CORS') || error.message?.includes('Cross-Origin')) {
          errorMsg = `CORS error: Backend may not allow requests from ${window.location.origin}. Please check CORS settings.`;
        } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
          errorMsg = `GLB file not found. Please upload a GLB file using the "Upload GLB" button.`;
        } else if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
          errorMsg = `Network error: Cannot access GLB file at ${glbUrl?.split('/').slice(0, 3).join('/') || 'server'}. Check if backend is running.`;
        } else if (error.message?.includes('Invalid GLB URL')) {
          errorMsg = error.message;
        } else if (error.message) {
          errorMsg = `Error loading 3D model: ${error.message}`;
        }

        toast.error(errorMsg);
        console.error('Error loading GLB from prop:', error);
        console.error('GLB URL that failed:', glbUrl);
        console.error('Error stack:', error.stack);
      }
    };

    // Only load if we have a valid URL
    if (glbUrl) {
      loadModel();
    }
  }, [glbUrl, glbUrls, currentFile, currentFileType]);

  // Update model scale when dimensions change or model type changes
  useEffect(() => {
    if (!modelRef.current || !originalModelSizeRef.current || currentFileType !== 'glb') {
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Apply scaling if at least length and width are provided (height is optional)
    if ((length || width) && originalModelSizeRef.current) {
      // Convert mm to meters (Three.js uses meters as base unit)
      const targetLengthM = length ? length / 1000 : null;
      const targetWidthM = width ? width / 1000 : null;
      const targetHeightM = height ? height / 1000 : null;

      // Calculate scale factors for each axis
      let scaleX = 1, scaleY = 1, scaleZ = 1;

      // Scale X (length) if provided
      if (targetLengthM !== null && originalModelSizeRef.current.x > 0) {
        scaleX = targetLengthM / originalModelSizeRef.current.x;
      }

      // Scale Y (height) if provided, otherwise maintain aspect ratio or use default
      if (targetHeightM !== null && originalModelSizeRef.current.y > 0) {
        scaleY = targetHeightM / originalModelSizeRef.current.y;
      } else if (length || width) {
        // If only length/width provided, maintain height proportion or use average scale
        const avgScale = targetLengthM && targetWidthM
          ? (scaleX + scaleZ) / 2
          : (targetLengthM ? scaleX : scaleZ);
        scaleY = avgScale || 1;
      }

      // Scale Z (width) if provided
      if (targetWidthM !== null && originalModelSizeRef.current.z > 0) {
        scaleZ = targetWidthM / originalModelSizeRef.current.z;
      }

      console.log('Updating model scale based on dimensions:', {
        target: { length: targetLengthM, width: targetWidthM, height: targetHeightM },
        original: originalModelSizeRef.current,
        scale: { x: scaleX, y: scaleY, z: scaleZ },
        modelType: modelType
      });

      // Reset scale first
      modelRef.current.scale.set(1, 1, 1);

      // Re-center the model at origin (0, 0, 0) before scaling
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center the model at origin
      modelRef.current.position.set(-center.x, -center.y, -center.z);

      // Apply new scale
      modelRef.current.scale.set(scaleX, scaleY, scaleZ);

      // Recalculate bounding box after scaling
      const scaledBox = new THREE.Box3().setFromObject(modelRef.current);
      const scaledSize = new THREE.Vector3();
      const scaledCenter = new THREE.Vector3();
      scaledBox.getSize(scaledSize);
      scaledBox.getCenter(scaledCenter);

      // Ensure model center remains at (0, 0, 0) after scaling
      if (Math.abs(scaledCenter.x) > 0.001 || Math.abs(scaledCenter.y) > 0.001 || Math.abs(scaledCenter.z) > 0.001) {
        modelRef.current.position.set(
          modelRef.current.position.x - scaledCenter.x,
          modelRef.current.position.y - scaledCenter.y,
          modelRef.current.position.z - scaledCenter.z
        );

        // Verify final center
        const verifyBox = new THREE.Box3().setFromObject(modelRef.current);
        const verifyCenter = new THREE.Vector3();
        verifyBox.getCenter(verifyCenter);

        console.log('✅ Model re-centered at (0,0,0) after dimension change:', {
          position: { x: modelRef.current.position.x.toFixed(4), y: modelRef.current.position.y.toFixed(4), z: modelRef.current.position.z.toFixed(4) },
          center: { x: verifyCenter.x.toFixed(4), y: verifyCenter.y.toFixed(4), z: verifyCenter.z.toFixed(4) }
        });
      }

      // Re-apply rotation fixes for all models after scaling
      if (modelRef.current && applyRotationFix(modelRef.current, modelType)) {
        console.log(`✅ Re-applied rotation fix for ${modelType} after dimension scaling`);
      }

      console.log('Model scale updated:', {
        newSize: { x: scaledSize.x, y: scaledSize.y, z: scaledSize.z },
        newCenter: { x: scaledCenter.x, y: scaledCenter.y, z: scaledCenter.z },
        position: { x: modelRef.current.position.x, y: modelRef.current.position.y, z: modelRef.current.position.z },
        rotation: { x: modelRef.current.rotation.x, y: modelRef.current.rotation.y, z: modelRef.current.rotation.z },
        modelType: modelType
      });

      // Update camera to fit new model size
      const finalMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
      const distance = finalMaxDim > 0 ? finalMaxDim * 2.5 : 5;
      const angle = Math.PI / 4;
      const newPos = new THREE.Vector3(
        distance * Math.cos(angle),
        distance * 0.7,
        distance * Math.sin(angle)
      );

      if (cameraRef.current) {
        cameraRef.current.position.copy(newPos);
        cameraRef.current.lookAt(0, 0, 0);
        cameraRef.current.updateProjectionMatrix();
      }

      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    } else if (!length && !width) {
      // Reset to default scaling if dimensions are cleared
      if (originalModelSizeRef.current && modelRef.current) {
        const THREE = (window as any).THREE;
        if (!THREE) return;

        const maxDim = Math.max(
          originalModelSizeRef.current.x,
          originalModelSizeRef.current.y,
          originalModelSizeRef.current.z
        );

        if (maxDim > 0) {
          const targetSize = 2.5;
          const scaleFactor = targetSize / maxDim;

          // Reset scale first
          modelRef.current.scale.set(1, 1, 1);

          // Center model at origin (0, 0, 0)
          const box = new THREE.Box3().setFromObject(modelRef.current);
          const center = new THREE.Vector3();
          box.getCenter(center);
          modelRef.current.position.set(-center.x, -center.y, -center.z);

          // Apply uniform scale
          modelRef.current.scale.setScalar(scaleFactor);

          // Verify center is at (0, 0, 0) after scaling
          const verifyBox = new THREE.Box3().setFromObject(modelRef.current);
          const verifyCenter = new THREE.Vector3();
          verifyBox.getCenter(verifyCenter);

          if (Math.abs(verifyCenter.x) > 0.001 || Math.abs(verifyCenter.y) > 0.001 || Math.abs(verifyCenter.z) > 0.001) {
            modelRef.current.position.set(
              modelRef.current.position.x - verifyCenter.x,
              modelRef.current.position.y - verifyCenter.y,
              modelRef.current.position.z - verifyCenter.z
            );
          }

          // Re-apply rotation fixes for all models after reset scaling
          if (modelRef.current && applyRotationFix(modelRef.current, modelType)) {
            console.log(`✅ Re-applied rotation fix for ${modelType} after reset scaling`);
          }

          console.log('✅ Reset model to default scaling, centered at (0,0,0):', {
            position: { x: modelRef.current.position.x.toFixed(4), y: modelRef.current.position.y.toFixed(4), z: modelRef.current.position.z.toFixed(4) },
            center: { x: verifyCenter.x.toFixed(4), y: verifyCenter.y.toFixed(4), z: verifyCenter.z.toFixed(4) },
            rotation: { x: modelRef.current.rotation.x.toFixed(4), y: modelRef.current.rotation.y.toFixed(4), z: modelRef.current.rotation.z.toFixed(4) }
          });

          // Force render
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        }
      }
    }
  }, [length, width, height, currentFileType, modelType]);

  // Load Image from URL prop
  useEffect(() => {
    console.log('GLBViewer - imageUrl changed:', imageUrl);
    console.log('GLBViewer - currentFile:', currentFile);
    console.log('GLBViewer - modelType:', modelType);

    // Check if this is a WMCH assembly model type
    const isWmchAssembly = modelType === 'wmch_compensating_main_assembly_5_sec' ||
      modelType === 'wmch_compensating_main_assembly_2_sec';

    if (!imageUrl) {
      // Clear image if URL is removed
      if (currentFile && currentFileType === 'image' && imagePlaneRef.current && sceneRef.current) {
        console.log('GLBViewer - Clearing image');
        sceneRef.current.remove(imagePlaneRef.current);
        imagePlaneRef.current = null;
        setCurrentFile(null);
        setCurrentFileType(null);
      }
      return;
    }

    if (imageUrl === currentFile) {
      console.log('GLBViewer - Image URL unchanged, skipping reload');
      return;
    }

    const loadImg = async (retryCount = 0) => {
      // Wait for Three.js to be ready (longer wait for WMCH assemblies)
      const maxWaitAttempts = isWmchAssembly ? 20 : 10; // 10 seconds for WMCH, 5 seconds for others
      let attempts = 0;
      while ((!threeLoadedRef.current || !sceneRef.current) && attempts < maxWaitAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        if (isWmchAssembly && attempts % 4 === 0) {
          console.log(`GLBViewer - Waiting for Three.js initialization (WMCH assembly)... ${attempts * 500}ms`);
        }
      }

      if (!threeLoadedRef.current || !sceneRef.current) {
        console.error('GLBViewer - Three.js not initialized after waiting');
        // Retry for WMCH assemblies
        if (isWmchAssembly && retryCount < 2) {
          console.log(`GLBViewer - Retrying image load for WMCH assembly (attempt ${retryCount + 1})`);
          setTimeout(() => loadImg(retryCount + 1), 1000);
          return;
        }
        toast.error('3D viewer not ready. Please refresh the page.');
        return;
      }

      if (imageUrl !== currentFile) {
        console.log(`GLBViewer - Loading image: ${imageUrl}${isWmchAssembly ? ' (WMCH Assembly)' : ''}`);
        setIsLoading(true);
        try {
          await loadImage(imageUrl);
          setIsLoading(false);
          setCurrentFile(imageUrl);
          setCurrentFileType('image');
          if (isWmchAssembly) {
            console.log('✅ WMCH Assembly image loaded successfully');
          } else {
            console.log('GLBViewer - Image loaded successfully');
          }
        } catch (error: any) {
          setIsLoading(false);

          // Retry logic for WMCH assemblies
          if (isWmchAssembly && retryCount < 2) {
            console.log(`GLBViewer - Retrying WMCH assembly image load (attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              loadImg(retryCount + 1);
            }, 2000 * (retryCount + 1)); // Exponential backoff: 2s, 4s
            return;
          }

          let errorMsg = 'Failed to load image.';

          if (error?.message?.includes('CORS')) {
            errorMsg = 'CORS error: Backend may not allow requests from this origin.';
          } else if (error?.message?.includes('404') || error?.message?.includes('Not Found')) {
            errorMsg = 'Image file not found. Please check if the file was uploaded correctly.';
          } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
            errorMsg = 'Network error: Cannot access image file. Check if backend is running.';
          } else if (error?.message) {
            errorMsg = `Error: ${error.message}`;
          }

          toast.error(errorMsg + (isWmchAssembly ? ' (WMCH Assembly)' : ''));
          console.error('Error loading image from prop:', error);
        }
      }
    };

    // Add initial delay for WMCH assemblies to ensure backend is ready
    if (isWmchAssembly) {
      console.log('GLBViewer - Adding delay for WMCH assembly image load');
      setTimeout(() => {
        loadImg();
      }, 300);
    } else {
      loadImg();
    }
  }, [imageUrl, modelType]);

  // Toggle grid helper
  useEffect(() => {
    if (gridHelperRef.current && sceneRef.current) {
      const isInScene = sceneRef.current.children.includes(gridHelperRef.current);
      if (showGrid && !isInScene) {
        sceneRef.current.add(gridHelperRef.current);
        console.log('Grid helper added to scene');
      } else if (!showGrid && isInScene) {
        sceneRef.current.remove(gridHelperRef.current);
        console.log('Grid helper removed from scene');
      }
      // Force render after toggle
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  }, [showGrid]);

  // Toggle axes helper
  useEffect(() => {
    if (axesHelperRef.current && sceneRef.current) {
      const isInScene = sceneRef.current.children.includes(axesHelperRef.current);
      if (showAxes && !isInScene) {
        sceneRef.current.add(axesHelperRef.current);
        console.log('Axes helper added to scene');
      } else if (!showAxes && isInScene) {
        sceneRef.current.remove(axesHelperRef.current);
        console.log('Axes helper removed from scene');
      }
      // Force render after toggle
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  }, [showAxes]);

  // Update background color
  useEffect(() => {
    if (sceneRef.current) {
      const THREE = (window as any).THREE;
      if (THREE) {
        const color = new THREE.Color(backgroundColor);
        sceneRef.current.background = color;
      }
    }
  }, [backgroundColor]);

  // Toggle wireframe mode
  useEffect(() => {
    if (modelRef.current && currentFileType === 'glb') {
      let updated = false;
      modelRef.current.traverse((node: any) => {
        if (node.isMesh && node.material) {
          try {
            if (Array.isArray(node.material)) {
              node.material.forEach((mat: any) => {
                if (mat) {
                  if (typeof mat.wireframe !== 'undefined') {
                    mat.wireframe = wireframe;
                    mat.needsUpdate = true;
                    updated = true;
                  }
                  // Also handle MeshStandardMaterial and other material types
                  if (mat.type && mat.type.includes('Material')) {
                    mat.wireframe = wireframe;
                    mat.needsUpdate = true;
                    updated = true;
                  }
                }
              });
            } else {
              if (node.material) {
                if (typeof node.material.wireframe !== 'undefined') {
                  node.material.wireframe = wireframe;
                  node.material.needsUpdate = true;
                  updated = true;
                }
                // Also handle MeshStandardMaterial and other material types
                if (node.material.type && node.material.type.includes('Material')) {
                  node.material.wireframe = wireframe;
                  node.material.needsUpdate = true;
                  updated = true;
                }
              }
            }
          } catch (error) {
            console.warn('Error updating wireframe:', error);
          }
        }
      });

      if (updated) {
        console.log(`Wireframe mode ${wireframe ? 'enabled' : 'disabled'}`);
        // Force render after wireframe change
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }
    }
  }, [wireframe, currentFileType]);

  // Reset camera view
  const resetCamera = () => {
    if (!cameraRef.current) {
      toast.error('Camera not initialized');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) {
      toast.error('Three.js not loaded');
      return;
    }

    try {
      // Always center on (0, 0, 0) where all models are positioned
      const centerTarget = new THREE.Vector3(0, 0, 0);

      // Calculate distance based on model size if available
      let distance = 5;
      if (modelRef.current) {
        const THREE = (window as any).THREE;
        const box = new THREE.Box3().setFromObject(modelRef.current);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        distance = maxDim > 0 ? maxDim * 2.5 : 5;
      }

      // Reset to FRONT/UPWARD view (looking down from above and front)
      // Camera positioned above and in front of model
      const resetPos = new THREE.Vector3(
        0,           // X: centered (no side offset) - straight front view
        distance * 0.8, // Y: elevated above model (upward view)
        distance * 0.6  // Z: in front of model (front view)
      );

      cameraRef.current.position.copy(resetPos);

      // Always look at center (0, 0, 0) where models are centered
      cameraRef.current.lookAt(centerTarget);

      // Update initial camera position for future resets
      initialCameraPositionRef.current = {
        position: resetPos.clone(),
        target: centerTarget.clone()
      };
      cameraRef.current.updateProjectionMatrix();

      // Update controls target to center
      if (controlsRef.current) {
        controlsRef.current.target = centerTarget.clone();
        if (controlsRef.current.update) {
          controlsRef.current.update();
        }
      }

      // Force render after camera reset
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      console.log('Camera reset to center view');
      toast.success('Camera reset to center view');
    } catch (error) {
      console.error('Error resetting camera:', error);
      toast.error('Failed to reset camera view');
    }
  };

  // Export screenshot
  const exportScreenshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
      toast.error('Renderer not initialized');
      return;
    }

    try {
      const THREE = (window as any).THREE;
      if (!THREE) {
        toast.error('Three.js not loaded');
        return;
      }

      const canvas = rendererRef.current.domElement;
      if (!canvas) {
        toast.error('Canvas not found');
        return;
      }

      // For WebGL canvas, we need to use a different approach
      // Render the scene first to ensure it's up to date
      rendererRef.current.render(sceneRef.current, cameraRef.current);

      // Try toDataURL first (works in some browsers)
      let dataURL: string | null = null;
      try {
        dataURL = canvas.toDataURL('image/png');
        // Check if we got a valid data URL
        if (!dataURL || dataURL === 'data:,') {
          dataURL = null;
        }
      } catch (e) {
        console.warn('toDataURL failed, trying alternative method:', e);
      }

      // Alternative: Use readPixels if toDataURL doesn't work
      if (!dataURL) {
        try {
          const width = canvas.width;
          const height = canvas.height;
          const imageData = new ImageData(width, height);

          // Create a temporary canvas to convert WebGL to image
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d');

          if (tempCtx) {
            // Copy the WebGL canvas to the 2D canvas
            tempCtx.drawImage(canvas, 0, 0);
            dataURL = tempCanvas.toDataURL('image/png');
          }
        } catch (e) {
          console.error('Alternative screenshot method failed:', e);
        }
      }

      if (!dataURL || dataURL === 'data:,') {
        toast.error('Failed to capture screenshot. Please try again.');
        return;
      }

      // Create download link
      const link = document.createElement('a');
      link.download = `3d-viewer-screenshot-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Screenshot downloaded');
    } catch (error) {
      console.error('Error exporting screenshot:', error);
      toast.error('Failed to export screenshot');
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      // Resize renderer when entering/exiting fullscreen
      if (rendererRef.current && cameraRef.current && canvasRef.current) {
        setTimeout(() => {
          if (rendererRef.current && cameraRef.current && canvasRef.current) {
            cameraRef.current.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
          }
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Toggle fullscreen - Use full page mode instead of browser fullscreen to keep controls visible
  const toggleFullscreen = () => {
    // Use full page mode instead of browser fullscreen so controls remain visible
    setIsFullPageMode(!isFullPageMode);
    if (!isFullPageMode) {
      toast.success('Full page mode enabled - All controls remain accessible');
    } else {
      toast.info('Exited full page mode');
    }
  };

  // Navigate to previous GLB file
  const goToPreviousFile = () => {
    if (!glbUrls || glbUrls.length <= 1) return;
    const newIndex = currentFileIndex > 0 ? currentFileIndex - 1 : glbUrls.length - 1;
    setCurrentFileIndex(newIndex);
    setCurrentFile(glbUrls[newIndex]);
    setCurrentFileType('glb');

    // Highlight the selected model
    if (modelsRef.current[newIndex]) {
      // Deselect previous model
      if (modelsRef.current[currentFileIndex]) {
        modelsRef.current[currentFileIndex].traverse((node: any) => {
          if (node.isMesh && node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach((mat: any) => {
                if (mat.emissive) mat.emissive.setHex(0x000000);
              });
            } else {
              if (node.material.emissive) node.material.emissive.setHex(0x000000);
            }
          }
        });
      }

      // Highlight new model
      modelsRef.current[newIndex].traverse((node: any) => {
        if (node.isMesh && node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((mat: any) => {
              if (mat.emissive) mat.emissive.setHex(0x444444);
            });
          } else {
            if (node.material.emissive) {
              node.material.emissive.setHex(0x444444);
            }
          }
        }
      });

      // Update modelRef to current model
      modelRef.current = modelsRef.current[newIndex];

      // Focus camera on selected model
      const THREE = (window as any).THREE;
      if (THREE && modelsRef.current[newIndex] && cameraRef.current) {
        const box = new THREE.Box3().setFromObject(modelsRef.current[newIndex]);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5;

        const newPos = new THREE.Vector3(
          center.x + distance * 0.7,
          center.y + distance * 0.7,
          center.z + distance * 0.7
        );

        cameraRef.current.position.copy(newPos);
        cameraRef.current.lookAt(center);

        if (controlsRef.current) {
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
    }

    const fileName = glbFileNames && glbFileNames[newIndex]
      ? glbFileNames[newIndex]
      : glbUrls[newIndex].split('/').pop() || `File ${newIndex + 1}`;
    toast.success(`Viewing: ${fileName}`);
  };

  // Navigate to next GLB file
  const goToNextFile = () => {
    if (!glbUrls || glbUrls.length <= 1) return;
    const newIndex = currentFileIndex < glbUrls.length - 1 ? currentFileIndex + 1 : 0;
    setCurrentFileIndex(newIndex);
    setCurrentFile(glbUrls[newIndex]);
    setCurrentFileType('glb');

    // Highlight the selected model
    if (modelsRef.current[newIndex]) {
      // Deselect previous model
      if (modelsRef.current[currentFileIndex]) {
        modelsRef.current[currentFileIndex].traverse((node: any) => {
          if (node.isMesh && node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach((mat: any) => {
                if (mat.emissive) mat.emissive.setHex(0x000000);
              });
            } else {
              if (node.material.emissive) node.material.emissive.setHex(0x000000);
            }
          }
        });
      }

      // Highlight new model
      modelsRef.current[newIndex].traverse((node: any) => {
        if (node.isMesh && node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((mat: any) => {
              if (mat.emissive) mat.emissive.setHex(0x444444);
            });
          } else {
            if (node.material.emissive) {
              node.material.emissive.setHex(0x444444);
            }
          }
        }
      });

      // Update modelRef to current model
      modelRef.current = modelsRef.current[newIndex];

      // Focus camera on selected model
      const THREE = (window as any).THREE;
      if (THREE && modelsRef.current[newIndex] && cameraRef.current) {
        const box = new THREE.Box3().setFromObject(modelsRef.current[newIndex]);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5;

        const newPos = new THREE.Vector3(
          center.x + distance * 0.7,
          center.y + distance * 0.7,
          center.z + distance * 0.7
        );

        cameraRef.current.position.copy(newPos);
        cameraRef.current.lookAt(center);

        if (controlsRef.current) {
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
    }

    const fileName = glbFileNames && glbFileNames[newIndex]
      ? glbFileNames[newIndex]
      : glbUrls[newIndex].split('/').pop() || `File ${newIndex + 1}`;
    toast.success(`Viewing: ${fileName}`);
  };

  // Handle delete model
  const handleDeleteModel = () => {
    if (!currentFile) {
      toast.error('No model to delete');
      return;
    }

    if (window.confirm('Are you sure you want to delete this 3D model?')) {
      // Remove model from scene
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        modelRef.current = null;
      }
      if (imagePlaneRef.current && sceneRef.current) {
        sceneRef.current.remove(imagePlaneRef.current);
        if (imagePlaneRef.current.material) {
          imagePlaneRef.current.material.dispose();
        }
        if (imagePlaneRef.current.geometry) {
          imagePlaneRef.current.geometry.dispose();
        }
        imagePlaneRef.current = null;
      }

      // Clear state
      setCurrentFile(null);
      setCurrentFileType(null);
      setCurrentFileIndex(0);
      originalModelSizeRef.current = null;
      setSelectedPart(null);
      setModelParts([]);

      toast.success('3D model deleted successfully');
    }
  };

  // Handle delete selected part
  const handleDeleteSelectedPart = () => {
    if (!selectedPart) {
      toast.error('No part selected. Click on a part to select it first.');
      return;
    }

    const partName = selectedPart.userData?.originalName || selectedPart.name || 'selected part';
    if (window.confirm(`Are you sure you want to delete "${partName}"?`)) {
      const THREE = (window as any).THREE;
      if (!THREE) return;

      // Remove part from its parent
      if (selectedPart.parent) {
        selectedPart.parent.remove(selectedPart);
      } else if (sceneRef.current) {
        sceneRef.current.remove(selectedPart);
      }

      // Dispose of resources
      selectedPart.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });

      // Update parts list
      setModelParts(prev => prev.filter(p => p.object !== selectedPart));
      setSelectedPart(null);
      setSelectedPartName('');

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      toast.success(`"${partName}" deleted successfully`);
    }
  };

  // Delete all parts of a specific category (e.g., all collars, all lights)
  const handleDeleteByCategory = (category: string) => {
    const partsToDelete = modelParts.filter(p => p.category === category);
    if (partsToDelete.length === 0) {
      toast.error(`No ${category} parts found to delete`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete all ${partsToDelete.length} ${category} part(s)?`)) {
      const THREE = (window as any).THREE;
      if (!THREE) return;

      partsToDelete.forEach(({ object }) => {
        // Remove part from its parent
        if (object.parent) {
          object.parent.remove(object);
        } else if (sceneRef.current) {
          sceneRef.current.remove(object);
        }

        // Dispose of resources
        object.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });

      // Update parts list
      setModelParts(prev => prev.filter(p => p.category !== category));

      // Clear selection if deleted part was selected
      if (selectedPart && partsToDelete.some(p => p.object === selectedPart)) {
        setSelectedPart(null);
      }

      // Clear multi-select
      setSelectedParts(new Set());

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      toast.success(`All ${partsToDelete.length} ${category} part(s) deleted successfully`);
    }
  };

  // Delete ALL parts regardless of category
  const handleDeleteAllParts = () => {
    if (modelParts.length === 0) {
      toast.error('No parts to delete');
      return;
    }

    const totalCount = modelParts.length;
    if (window.confirm(`Are you sure you want to delete ALL ${totalCount} parts? This action cannot be undone.`)) {
      const THREE = (window as any).THREE;
      if (!THREE) return;

      modelParts.forEach(({ object }) => {
        // Remove part from its parent
        if (object.parent) {
          object.parent.remove(object);
        } else if (sceneRef.current) {
          sceneRef.current.remove(object);
        }

        // Dispose of resources
        object.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });

      // Clear all parts
      setModelParts([]);
      setSelectedPart(null);
      setSelectedPartName('');
      setSelectedParts(new Set());

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      toast.success(`All ${totalCount} parts deleted successfully`);
    }
  };

  // Select all parts of a specific category
  const handleSelectAllByCategory = (category: string) => {
    const partsInCategory = modelParts.filter(p => p.category === category);
    if (partsInCategory.length === 0) {
      toast.error(`No ${category} parts found`);
      return;
    }

    setIsMultiSelectMode(true);
    const newSelected = new Set(partsInCategory.map(p => p.object));
    setSelectedParts(newSelected);

    // Highlight selected parts
    const THREE = (window as any).THREE;
    modelParts.forEach((p) => {
      if (p.object.material) {
        if (Array.isArray(p.object.material)) {
          p.object.material.forEach((mat: any) => {
            if (mat.emissive) {
              if (newSelected.has(p.object)) {
                mat.emissive.setHex(0x444444);
              } else {
                mat.emissive.setHex(0x000000);
              }
            }
          });
        } else {
          if (p.object.material.emissive) {
            if (newSelected.has(p.object)) {
              p.object.material.emissive.setHex(0x444444);
            } else {
              p.object.material.emissive.setHex(0x000000);
            }
          }
        }
      }
    });

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    toast.success(`Selected all ${partsInCategory.length} ${category} parts`);
  };

  // Delete multiple selected parts
  const handleDeleteSelectedParts = () => {
    if (selectedParts.size === 0) {
      toast.error('No parts selected. Select parts using multi-select mode.');
      return;
    }

    const count = selectedParts.size;
    if (window.confirm(`Are you sure you want to delete ${count} selected part(s)?`)) {
      const THREE = (window as any).THREE;
      if (!THREE) return;

      const partsToDelete = Array.from(selectedParts);

      partsToDelete.forEach((object) => {
        // Remove part from its parent
        if (object.parent) {
          object.parent.remove(object);
        } else if (sceneRef.current) {
          sceneRef.current.remove(object);
        }

        // Dispose of resources
        object.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });

      // Update parts list
      setModelParts(prev => prev.filter(p => !selectedParts.has(p.object)));

      // Clear selections
      if (selectedPart && selectedParts.has(selectedPart)) {
        setSelectedPart(null);
      }
      setSelectedParts(new Set());

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      toast.success(`${count} part(s) deleted successfully`);
    }
  };

  // Toggle part selection in multi-select mode
  const togglePartSelection = (partObject: any) => {
    if (!isMultiSelectMode) {
      // Single select mode - just select the part
      setSelectedPart(partObject);
      setSelectedParts(new Set([partObject]));
      const partName = getPartDisplayName(partObject);
      setSelectedPartName(partName);
      return;
    }

    // Multi-select mode - use functional update to ensure we have latest state
    setSelectedParts(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(partObject)) {
        newSelected.delete(partObject);
      } else {
        newSelected.add(partObject);
      }

      // Also update single selection for compatibility
      if (newSelected.size === 1) {
        const singlePart = Array.from(newSelected)[0];
        setSelectedPart(singlePart);
        const partName = getPartDisplayName(singlePart);
        setSelectedPartName(partName);
      } else {
        setSelectedPart(null);
        setSelectedPartName('');
      }

      return newSelected;
    });
  };

  // Move selected part in a specific direction
  const movePart = (direction: 'left' | 'right' | 'up' | 'down' | 'forward' | 'backward', distance: number = 0.1) => {
    // For combined models, allow selecting from modelsRef.current
    let targetObject = selectedPart;

    // If no part selected, use the first model from modelsRef or modelRef
    if (!targetObject) {
      if (modelsRef.current && modelsRef.current.length > 0) {
        targetObject = modelsRef.current[0];
      } else {
        targetObject = modelRef.current;
      }
    }

    if (!targetObject) {
      toast.error('No part or model selected to move');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) return;

    switch (direction) {
      case 'left':
        targetObject.position.x -= distance;
        break;
      case 'right':
        targetObject.position.x += distance;
        break;
      case 'up':
        targetObject.position.y += distance;
        break;
      case 'down':
        targetObject.position.y -= distance;
        break;
      case 'forward':
        targetObject.position.z -= distance;
        break;
      case 'backward':
        targetObject.position.z += distance;
        break;
    }

    // Update position state if it's a model from modelsRef or modelRef
    if (modelsRef.current && modelsRef.current.includes(targetObject)) {
      setModelPosition({
        x: targetObject.position.x,
        y: targetObject.position.y,
        z: targetObject.position.z
      });
    } else if (targetObject === modelRef.current) {
      setModelPosition({
        x: targetObject.position.x,
        y: targetObject.position.y,
        z: targetObject.position.z
      });
    }

    // Force render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    const partName = selectedPart
      ? (selectedPart.userData?.originalName || selectedPart.name || 'selected part')
      : (modelsRef.current && modelsRef.current.length > 1 ? `Model ${modelsRef.current.indexOf(targetObject) + 1}` : 'model');
    toast.info(`Moved ${partName} ${direction}`);
  };

  // Rotate a specific part/model around a specific axis with smooth animation
  // Can rotate any part by passing it as parameter, or uses selectedPart/default
  const rotatePart = (axis: 'x' | 'y' | 'z', degrees: number, animate: boolean = true, targetPart?: any) => {
    // Use provided targetPart, or selectedPart, or fallback to first model
    let targetObject = targetPart || selectedPart;

    // If no part provided and no part selected, use the first model from modelsRef or modelRef
    if (!targetObject) {
      if (modelsRef.current && modelsRef.current.length > 0) {
        targetObject = modelsRef.current[0];
      } else {
        targetObject = modelRef.current;
      }
    }

    if (!targetObject) {
      toast.error('No part or model available to rotate');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) return;

    const radians = (degrees * Math.PI) / 180;
    const targetRotation = {
      x: targetObject.rotation.x,
      y: targetObject.rotation.y,
      z: targetObject.rotation.z
    };

    switch (axis) {
      case 'x':
        targetRotation.x += radians;
        break;
      case 'y':
        targetRotation.y += radians;
        break;
      case 'z':
        targetRotation.z += radians;
        break;
    }

    if (animate) {
      // Smooth rotation animation
      const startRotation = {
        x: targetObject.rotation.x,
        y: targetObject.rotation.y,
        z: targetObject.rotation.z
      };
      const duration = 300; // milliseconds
      const startTime = Date.now();

      const animateRotation = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3); // Cubic ease-out

        targetObject.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
        targetObject.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
        targetObject.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;

        // Update rotation state for any model in modelsRef or modelRef
        if (modelsRef.current && modelsRef.current.includes(targetObject)) {
          setModelRotation({
            x: (targetObject.rotation.x * 180) / Math.PI,
            y: (targetObject.rotation.y * 180) / Math.PI,
            z: (targetObject.rotation.z * 180) / Math.PI
          });
        } else if (targetObject === modelRef.current) {
          setModelRotation({
            x: (targetObject.rotation.x * 180) / Math.PI,
            y: (targetObject.rotation.y * 180) / Math.PI,
            z: (targetObject.rotation.z * 180) / Math.PI
          });
        }

        // Force render
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }

        if (progress < 1) {
          requestAnimationFrame(animateRotation);
        }
      };

      animateRotation();
    } else {
      // Instant rotation (for slider updates)
      targetObject.rotation.x = targetRotation.x;
      targetObject.rotation.y = targetRotation.y;
      targetObject.rotation.z = targetRotation.z;

      // Update rotation state for any model in modelsRef or modelRef
      if (modelsRef.current && modelsRef.current.includes(targetObject)) {
        setModelRotation({
          x: (targetObject.rotation.x * 180) / Math.PI,
          y: (targetObject.rotation.y * 180) / Math.PI,
          z: (targetObject.rotation.z * 180) / Math.PI
        });
      } else if (targetObject === modelRef.current) {
        setModelRotation({
          x: (targetObject.rotation.x * 180) / Math.PI,
          y: (targetObject.rotation.y * 180) / Math.PI,
          z: (targetObject.rotation.z * 180) / Math.PI
        });
      }

      // Force render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }

    // Get actual GLB filename
    const partName = targetObject.userData?.filename || targetObject.userData?.originalName || targetObject.name || 'part';

    if (animate) {
      // Show message with actual filename and rotation info
      const rotationMessage = `"${partName}" rotated ${axis.toUpperCase()}-axis by ${degrees > 0 ? '+' : ''}${degrees}°`;
      toast.info(`🔄 ${rotationMessage}`);

      // Update selected part name to show rotation info if this is the selected part
      if (targetObject === selectedPart) {
        setSelectedPartName(`${partName} (${axis.toUpperCase()}: ${degrees > 0 ? '+' : ''}${degrees}°)`);
      }
    }
  };

  // Update position with increment/decrement
  const updatePosition = (axis: 'x' | 'y' | 'z', delta: number, targetPart?: any) => {
    // Use provided targetPart, or selectedPart, or fallback to first model
    let targetObject = targetPart || selectedPart;

    // If no part provided and no part selected, use the first model from modelsRef or modelRef
    if (!targetObject) {
      if (modelsRef.current && modelsRef.current.length > 0) {
        targetObject = modelsRef.current[0];
      } else {
        targetObject = modelRef.current;
      }
    }

    if (!targetObject) {
      toast.error('No part or model selected to move');
      return;
    }

    // Update position
    switch (axis) {
      case 'x':
        targetObject.position.x += delta;
        break;
      case 'y':
        targetObject.position.y += delta;
        break;
      case 'z':
        targetObject.position.z += delta;
        break;
    }

    // Update position state for any model in modelsRef or modelRef
    if (modelsRef.current && modelsRef.current.includes(targetObject)) {
      const newPos = {
        x: targetObject.position.x,
        y: targetObject.position.y,
        z: targetObject.position.z
      };
      setModelPosition(newPos);
    } else if (targetObject === modelRef.current) {
      const newPos = {
        x: targetObject.position.x,
        y: targetObject.position.y,
        z: targetObject.position.z
      };
      setModelPosition(newPos);
    }

    // Force render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    const partName = getPartDisplayName(targetObject);
    if (targetObject !== selectedPart) {
      // Only show toast for non-selected parts to avoid spam
      toast.info(`Moved ${partName} ${axis.toUpperCase()}-axis by ${delta > 0 ? '+' : ''}${delta.toFixed(3)}m`);
    }
  };

  // Helpers for UI controls
  const handleRotationAdjust = (axis: 'x' | 'y' | 'z', direction: 1 | -1 = 1) => {
    const step = Number.isFinite(rotationStepDeg) && rotationStepDeg !== 0 ? rotationStepDeg : 1;
    rotatePart(axis, step * direction, true);
  };

  const handleAxisNudge = (axis: 'x' | 'y' | 'z', direction: 1 | -1 = 1) => {
    const step = Number.isFinite(nudgeStep) && nudgeStep !== 0 ? nudgeStep : 0.01;
    updatePosition(axis, step * direction);
  };

  const resetSelectedRotation = () => {
    const target = selectedPart || (modelsRef.current && modelsRef.current[0]) || modelRef.current;
    if (!target) {
      toast.error('No part or model selected to reset rotation');
      return;
    }
    target.rotation.set(0, 0, 0);
    setModelRotation({ x: 0, y: 0, z: 0 });
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    const partName = getPartDisplayName(target);
    toast.info(`${partName} rotation reset`);
  };

  const highlightAndSelectPart = (model: any, skipToast: boolean = false) => {
    const THREE = (window as any).THREE;
    if (!model) return;

    // Clear current highlight
    if (selectedPart && selectedPart.material) {
      if (Array.isArray(selectedPart.material)) {
        selectedPart.material.forEach((mat: any) => {
          if (mat.emissive) mat.emissive.setHex(0x000000);
        });
      } else if (selectedPart.material.emissive) {
        selectedPart.material.emissive.setHex(0x000000);
      }
    }

    // Clear all model highlights
    if (modelsRef.current && modelsRef.current.length > 0) {
      modelsRef.current.forEach((m) => {
        m.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat.emissive) mat.emissive.setHex(0x000000);
              });
            } else if (child.material.emissive) {
              child.material.emissive.setHex(0x000000);
            }
          }
        });
      });
    }

    // Highlight new selection
    model.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat: any) => {
            if (mat.emissive) mat.emissive.setHex(0x444444);
          });
        } else if (child.material.emissive) {
          child.material.emissive.setHex(0x444444);
        }
      }
    });

    setSelectedPart(model);
    const partName = getPartDisplayName(model);
    setSelectedPartName(partName);

    // Sync transforms
    setModelRotation({
      x: (model.rotation.x * 180) / Math.PI,
      y: (model.rotation.y * 180) / Math.PI,
      z: (model.rotation.z * 180) / Math.PI
    });
    setModelPosition({
      x: model.position.x,
      y: model.position.y,
      z: model.position.z
    });
    setModelScale({
      x: model.scale.x,
      y: model.scale.y,
      z: model.scale.z
    });

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    if (!skipToast) {
      toast.success(`Selected: ${partName}`);
    }
  };

  const selectPartByType = (partType: string) => {
    if (!modelsRef.current || modelsRef.current.length === 0) {
      toast.error('No models loaded');
      return;
    }
    // Debug: log all available parts and their identified types
    console.log('Available parts:', modelsRef.current.map(m => ({
      filename: m.userData?.originalName || m.userData?.filename || m.name,
      identifiedType: identifyPartType(m)
    })));
    const target = modelsRef.current.find(m => identifyPartType(m) === partType);
    if (!target) {
      console.warn(`Part type "${partType}" not found. Available types:`,
        modelsRef.current.map(m => identifyPartType(m)).filter(Boolean));
      toast.error(`That part (${partType}) is not loaded in this view`);
      return;
    }
    highlightAndSelectPart(target);
  };

  type PartAction =
    | 'rotXPlus'
    | 'rotXMinus'
    | 'rotYPlus'
    | 'rotYMinus'
    | 'rotZPlus'
    | 'rotZMinus'
    | 'moveUp'
    | 'moveDown'
    | 'moveLeft'
    | 'moveRight';

  const applyActionToPart = (partType: string, action: PartAction) => {
    if (!modelsRef.current || modelsRef.current.length === 0) {
      toast.error('No models loaded');
      return;
    }
    const target = modelsRef.current.find(m => identifyPartType(m) === partType);
    if (!target) {
      console.warn(`Part type "${partType}" not found for action "${action}". Available types:`,
        modelsRef.current.map(m => ({
          filename: m.userData?.originalName || m.userData?.filename || m.name,
          type: identifyPartType(m)
        })));
      toast.error(`That part (${partType}) is not loaded in this view`);
      return;
    }
    highlightAndSelectPart(target, true);
    const rotStep = Number.isFinite(rotationStepDeg) && rotationStepDeg !== 0 ? rotationStepDeg : 1;
    const moveStep = Number.isFinite(nudgeStep) && nudgeStep !== 0 ? nudgeStep : 0.01;
    switch (action) {
      case 'rotXPlus':
        rotatePart('x', rotStep, true, target);
        break;
      case 'rotXMinus':
        rotatePart('x', -rotStep, true, target);
        break;
      case 'rotYPlus':
        rotatePart('y', rotStep, true, target);
        break;
      case 'rotYMinus':
        rotatePart('y', -rotStep, true, target);
        break;
      case 'rotZPlus':
        rotatePart('z', rotStep, true, target);
        break;
      case 'rotZMinus':
        rotatePart('z', -rotStep, true, target);
        break;
      case 'moveUp':
        updatePosition('y', moveStep, target);
        break;
      case 'moveDown':
        updatePosition('y', -moveStep, target);
        break;
      case 'moveLeft':
        updatePosition('x', -moveStep, target);
        break;
      case 'moveRight':
        updatePosition('x', moveStep, target);
        break;
    }
    toast.success(`${getPartDisplayName(target)} updated`);
  };

  // Attach/align selected part to another part - Improved with better feedback
  const attachParts = (attachmentType: 'side' | 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back' | 'center') => {
    if (!modelsRef.current || modelsRef.current.length < 2) {
      toast.error('Multiple models required for attachment');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) return;

    // If we have multiple models, attach the selected one (or second) to the first
    const baseModel = modelsRef.current[0];
    let attachModel = selectedPart;

    // If selectedPart is not a model from modelsRef, use the second model
    if (!attachModel || !modelsRef.current.includes(attachModel)) {
      if (modelsRef.current.length > 1) {
        attachModel = modelsRef.current[1];
      } else {
        toast.error('Please select a part to attach');
        return;
      }
    }

    if (attachModel === baseModel) {
      toast.error('Cannot attach model to itself');
      return;
    }

    // Update matrix world before calculating bounding box for accurate positioning
    baseModel.updateMatrixWorld(true);
    attachModel.updateMatrixWorld(true);

    const baseBox = new THREE.Box3().setFromObject(baseModel);
    const attachBox = new THREE.Box3().setFromObject(attachModel);
    const baseSize = new THREE.Vector3();
    const attachSize = new THREE.Vector3();
    const baseCenter = new THREE.Vector3();
    const attachCenter = new THREE.Vector3();

    baseBox.getSize(baseSize);
    attachBox.getSize(attachSize);
    baseBox.getCenter(baseCenter);
    attachBox.getCenter(attachCenter);

    // Calculate attachment position based on type
    let newPosition = new THREE.Vector3();

    switch (attachmentType) {
      case 'side':
      case 'right':
        // Attach to right side
        newPosition.set(
          baseCenter.x + baseSize.x / 2 + attachSize.x / 2,
          baseCenter.y,
          baseCenter.z
        );
        break;
      case 'left':
        // Attach to left side
        newPosition.set(
          baseCenter.x - baseSize.x / 2 - attachSize.x / 2,
          baseCenter.y,
          baseCenter.z
        );
        break;
      case 'top':
        // Attach to top
        newPosition.set(
          baseCenter.x,
          baseCenter.y + baseSize.y / 2 + attachSize.y / 2,
          baseCenter.z
        );
        break;
      case 'bottom':
        // Attach to bottom
        newPosition.set(
          baseCenter.x,
          baseCenter.y - baseSize.y / 2 - attachSize.y / 2,
          baseCenter.z
        );
        break;
      case 'front':
        // Attach to front
        newPosition.set(
          baseCenter.x,
          baseCenter.y,
          baseCenter.z + baseSize.z / 2 + attachSize.z / 2
        );
        break;
      case 'back':
        // Attach to back
        newPosition.set(
          baseCenter.x,
          baseCenter.y,
          baseCenter.z - baseSize.z / 2 - attachSize.z / 2
        );
        break;
      case 'center':
        // Center align
        newPosition.copy(baseCenter);
        break;
    }

    // Position the attach model relative to its own center
    attachModel.position.set(
      newPosition.x - attachCenter.x,
      newPosition.y - attachCenter.y,
      newPosition.z - attachCenter.z
    );

    // Update position, rotation, and scale state
    if (modelsRef.current.includes(attachModel)) {
      setModelPosition({
        x: attachModel.position.x,
        y: attachModel.position.y,
        z: attachModel.position.z
      });
      const THREE = (window as any).THREE;
      if (THREE) {
        setModelRotation({
          x: (attachModel.rotation.x * 180) / Math.PI,
          y: (attachModel.rotation.y * 180) / Math.PI,
          z: (attachModel.rotation.z * 180) / Math.PI
        });
        setModelScale({
          x: attachModel.scale.x,
          y: attachModel.scale.y,
          z: attachModel.scale.z
        });
      }
    }

    // Update matrix world after positioning
    attachModel.updateMatrixWorld(true);

    // Force render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    // Get actual GLB filenames
    const attachModelName = attachModel.userData?.filename || attachModel.userData?.originalName || attachModel.name || 'part';
    const baseModelName = baseModel.userData?.filename || baseModel.userData?.originalName || baseModel.name || 'base';

    // Format attachment type for message
    const attachmentPosition = attachmentType === 'center' ? 'center' : `${attachmentType} side`;

    // Show detailed message with actual filenames in the format: "filename1" to center of "filename2"
    const message = `"${attachModelName}" to ${attachmentPosition} of "${baseModelName}"`;
    toast.success(`✅ Attached ${message}`);

    // Also update selected part name in message box with attachment info
    setSelectedPartName(`"${attachModelName}" to ${attachmentPosition} of "${baseModelName}"`);
  };

  // Attach all side parts together in sequence
  const attachAllSideParts = () => {
    if (!modelsRef.current || modelsRef.current.length < 2) {
      toast.error('Multiple models required for attachment');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Start with the first model as the base
    let currentBase = modelsRef.current[0];
    const baseBox = new THREE.Box3().setFromObject(currentBase);
    const baseSize = new THREE.Vector3();
    const baseCenter = new THREE.Vector3();
    baseBox.getSize(baseSize);
    baseBox.getCenter(baseCenter);

    // Attach all other models sequentially to the right side
    for (let i = 1; i < modelsRef.current.length; i++) {
      const attachModel = modelsRef.current[i];
      const attachBox = new THREE.Box3().setFromObject(attachModel);
      const attachSize = new THREE.Vector3();
      const attachCenter = new THREE.Vector3();
      attachBox.getSize(attachSize);
      attachBox.getCenter(attachCenter);

      // Calculate position to attach to the right side of current base
      const newPosition = new THREE.Vector3(
        baseCenter.x + baseSize.x / 2 + attachSize.x / 2,
        baseCenter.y,
        baseCenter.z
      );

      // Position the attach model relative to its own center
      attachModel.position.set(
        newPosition.x - attachCenter.x,
        newPosition.y - attachCenter.y,
        newPosition.z - attachCenter.z
      );

      // Update base for next iteration (use the combined bounding box)
      const combinedBox = new THREE.Box3();
      for (let j = 0; j <= i; j++) {
        combinedBox.expandByObject(modelsRef.current[j]);
      }
      combinedBox.getSize(baseSize);
      combinedBox.getCenter(baseCenter);
      currentBase = attachModel; // Use the last attached model as reference
    }

    // Force render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    toast.success(`Attached all ${modelsRef.current.length} side parts together`);
  };

  // Reset all individual parts to center (0,0,0) with default rotation and scale from config
  const resetAllPartsToCenter = () => {
    if (!modelsRef.current || modelsRef.current.length === 0) {
      toast.error('No parts to reset');
      return;
    }

    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Reset all parts to center position (0,0,0), rotation (0,0,0), and scale from config
    modelsRef.current.forEach((part) => {
      // Identify part type to get config
      const partType = identifyPartType(part);
      const config = partType ? PART_POSITION_CONFIG[partType] : null;

      // Use config scale if available, otherwise default to 1,1,1
      const scaleX = config?.scale?.x ?? 1;
      const scaleY = config?.scale?.y ?? 1;
      const scaleZ = config?.scale?.z ?? 1;

      // Reset rotation to 0 first
      part.rotation.set(0, 0, 0);

      // Apply scale from config
      part.scale.set(scaleX, scaleY, scaleZ);

      // Update matrix world to apply rotation and scale
      part.updateMatrixWorld(true);

      // Calculate bounding box center after rotation and scale are applied
      const box = new THREE.Box3().setFromObject(part);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Position the part so its bounding box center is at (0,0,0)
      part.position.set(
        -center.x,
        -center.y,
        -center.z
      );

      // Final update
      part.updateMatrixWorld(true);
    });

    // Adjust camera to fit all parts and ensure all parts are visible
    if (cameraRef.current && controlsRef.current) {
      const combinedBox = new THREE.Box3();
      modelsRef.current.forEach(model => {
        // Ensure model matrix is updated before expanding box
        model.updateMatrixWorld(true);
        combinedBox.expandByObject(model);
      });
      const combinedSize = new THREE.Vector3();
      const combinedCenter = new THREE.Vector3();
      combinedBox.getSize(combinedSize);
      combinedBox.getCenter(combinedCenter);

      // Calculate distance to fit all parts with padding
      const maxDim = Math.max(combinedSize.x, combinedSize.y, combinedSize.z);
      // Use larger multiplier and add padding based on actual bounds
      const padding = Math.max(combinedSize.x, combinedSize.y, combinedSize.z) * 0.5; // 50% padding
      const distance = maxDim > 0 ? (maxDim + padding) * 4.0 : 15; // Increased to 4.0x with padding

      // Account for parts that might be at different Y positions (e.g., top part at Y: 1.0)
      const maxY = combinedBox.max.y;
      const minY = combinedBox.min.y;
      const yRange = maxY - minY;

      // Set camera position to view from an angle that shows all parts
      cameraRef.current.position.set(
        combinedCenter.x + distance * 0.7,
        combinedCenter.y + Math.max(distance * 0.8, yRange * 1.5), // Ensure enough height to see top parts
        combinedCenter.z + distance * 0.7
      );

      controlsRef.current.target.copy(combinedCenter);

      // Ensure camera limits allow viewing all parts
      if (controlsRef.current.minDistance !== undefined) {
        controlsRef.current.minDistance = maxDim * 0.3; // Allow closer zoom
      }
      if (controlsRef.current.maxDistance !== undefined) {
        controlsRef.current.maxDistance = maxDim * 15; // Allow further zoom out
      }

      controlsRef.current.update();
      cameraRef.current.updateProjectionMatrix();
    }

    // Update state for the first part (or selected part if available)
    const targetPart = selectedPart || modelsRef.current[0];
    if (targetPart) {
      setModelPosition({
        x: targetPart.position.x,
        y: targetPart.position.y,
        z: targetPart.position.z
      });
      setModelRotation({ x: 0, y: 0, z: 0 });
      setModelScale({
        x: targetPart.scale.x,
        y: targetPart.scale.y,
        z: targetPart.scale.z
      });
    }

    // Force render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    toast.success(`Reset all ${modelsRef.current.length} parts to center (0,0,0) with rotation (0,0,0) and scale from config`);
  };

  // Handle attach/upload GLB file
  const handleAttachFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            setIsLoading(false);
            return;
          }

          // Create blob URL
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);

          // Load the GLB file
          if (gltfLoaderRef.current && sceneRef.current) {
            const loader = gltfLoaderRef.current;
            const gltf = await loader.loadAsync(url);
            const model = gltf.scene;

            // Remove existing model
            if (modelRef.current) {
              sceneRef.current.remove(modelRef.current);
            }

            // Center and add new model
            const THREE = (window as any).THREE;
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            model.position.sub(center);

            sceneRef.current.add(model);
            modelRef.current = model;
            setCurrentFile(url);
            setCurrentFileType('glb');

            toast.success('GLB file attached successfully');
          }
          setIsLoading(false);
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Error attaching file:', error);
        toast.error('Failed to attach GLB file');
        setIsLoading(false);
      }
    };
    input.click();
  };

  // Handle drag mode toggle
  const toggleDragMode = () => {
    const newDragMode = !isDragMode;
    setIsDragMode(newDragMode);
    // Note: controls are handled manually, so we don't need to disable them
    const targetName = selectedPart
      ? (selectedPart.userData?.originalName || selectedPart.name || 'selected part')
      : 'model';
    toast.info(newDragMode
      ? `Move mode enabled - Click and drag to move ${targetName}`
      : 'Move mode disabled');
  };

  // Handle part selection on click - Enhanced for combined models
  useEffect(() => {
    if (!canvasRef.current || !raycasterRef.current || !cameraRef.current || !sceneRef.current) return;
    if (!modelRef.current && (!modelsRef.current || modelsRef.current.length === 0)) return;

    const canvas = canvasRef.current;
    const raycaster = raycasterRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;

    const handleClick = (event: MouseEvent) => {
      if (isDragging) return; // Don't select while dragging

      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseRef.current, camera);

      // Get all selectable objects from models (including combined models)
      const selectableObjects: any[] = [];

      // Add objects from modelsRef (for combined model types)
      if (modelsRef.current && modelsRef.current.length > 0) {
        modelsRef.current.forEach((model) => {
          model.traverse((child: any) => {
            if (child.isMesh) {
              // Make all meshes selectable for combined models
              selectableObjects.push(child);
              // Also allow selecting the model itself
              if (!selectableObjects.includes(model)) {
                selectableObjects.push(model);
              }
            }
          });
        });
      }

      // Also check modelRef for single models
      if (modelRef.current) {
        modelRef.current.traverse((child: any) => {
          if (child.isMesh && (child.userData.isSelectable || !modelsRef.current || modelsRef.current.length === 0)) {
            selectableObjects.push(child);
          }
        });
        // Also allow selecting the model itself
        if (!selectableObjects.includes(modelRef.current)) {
          selectableObjects.push(modelRef.current);
        }
      }

      const intersects = raycaster.intersectObjects(selectableObjects, true);

      if (intersects.length > 0) {
        let selectedObject = intersects[0].object;

        // If we clicked on a mesh, try to find its parent model (for combined models)
        if (modelsRef.current && modelsRef.current.length > 0) {
          // Check if the selected object is part of one of the models
          let foundModel = null;

          // First, check if it's directly one of the models
          if (modelsRef.current.includes(selectedObject)) {
            foundModel = selectedObject;
          } else {
            // Check parent chain to find the model
            let current = selectedObject;
            while (current && current.parent) {
              if (modelsRef.current.includes(current.parent)) {
                foundModel = current.parent;
                break;
              }
              current = current.parent;
            }

            // If still not found, traverse all models to find which one contains this object
            if (!foundModel) {
              for (const model of modelsRef.current) {
                let isChild = false;
                model.traverse((child: any) => {
                  if (child === selectedObject) {
                    isChild = true;
                  }
                });
                if (isChild) {
                  foundModel = model;
                  break;
                }
              }
            }
          }

          if (foundModel) {
            selectedObject = foundModel;
          }
        }

        // Reset previous selection highlight
        if (selectedPart && selectedPart.material) {
          if (Array.isArray(selectedPart.material)) {
            selectedPart.material.forEach((mat: any) => {
              if (mat.emissive) mat.emissive.setHex(0x000000);
            });
          } else {
            if (selectedPart.material.emissive) {
              selectedPart.material.emissive.setHex(0x000000);
            }
          }
        }

        // Also reset highlights for all models
        if (modelsRef.current && modelsRef.current.length > 0) {
          modelsRef.current.forEach((model) => {
            model.traverse((child: any) => {
              if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: any) => {
                    if (mat.emissive) mat.emissive.setHex(0x000000);
                  });
                } else {
                  if (child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                  }
                }
              }
            });
          });
        }

        // Highlight selected part/model
        if (selectedObject.material) {
          const THREE = (window as any).THREE;
          if (Array.isArray(selectedObject.material)) {
            selectedObject.material.forEach((mat: any) => {
              if (mat.emissive) mat.emissive.setHex(0x444444);
            });
          } else {
            if (selectedObject.material.emissive) {
              selectedObject.material.emissive.setHex(0x444444);
            }
          }
        }

        // Also highlight all meshes in the selected model (for combined models)
        if (modelsRef.current && modelsRef.current.includes(selectedObject)) {
          selectedObject.traverse((child: any) => {
            if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat.emissive) mat.emissive.setHex(0x444444);
                });
              } else {
                if (child.material.emissive) {
                  child.material.emissive.setHex(0x444444);
                }
              }
            }
          });
        }

        setSelectedPart(selectedObject);

        // Check if this is one of the 5 specific GLB parts
        const targetPartTypes = [
          'wmss_single_skin_1_sec',
          'one_collar_single_skin',
          'single_skin_right_side_part',
          'single_skin_left_side_part',
          'single_skin_front_part'
        ];

        // Identify part type - try multiple methods
        let partType = identifyPartType(selectedObject);

        // If not found, try checking userData and traverse to find filename
        if (!partType) {
          // Try to get filename from the model or its children
          let foundName = selectedObject.userData?.originalName ||
            selectedObject.userData?.filename ||
            selectedObject.name || '';

          // Traverse to find filename in children
          if (!foundName || foundName === '') {
            selectedObject.traverse((child: any) => {
              if (!foundName && (child.userData?.originalName || child.userData?.filename || child.name)) {
                foundName = child.userData?.originalName || child.userData?.filename || child.name;
              }
            });
          }

          if (foundName) {
            partType = identifyPartType({
              userData: {
                modelType: selectedObject.userData?.modelType,
                originalName: foundName,
                filename: foundName
              },
              name: foundName
            });
          }
        }

        const isTargetPart = partType && targetPartTypes.includes(partType);

        // Get actual GLB filename - try multiple sources
        let actualFileName = selectedObject.userData?.filename ||
          selectedObject.userData?.originalName ||
          selectedObject.name ||
          'part';

        // Traverse to find filename if not found
        if (!actualFileName || actualFileName === 'part') {
          selectedObject.traverse((child: any) => {
            if ((!actualFileName || actualFileName === 'part') &&
              (child.userData?.originalName || child.userData?.filename || child.name)) {
              actualFileName = child.userData?.originalName || child.userData?.filename || child.name;
            }
          });
        }

        // Update selected part name
        setSelectedPartName(actualFileName);

        // Always show selection message for target parts
        if (isTargetPart) {
          toast.success(`✓ Selected: "${actualFileName}" - Arrow Keys: X/Y Rotate | W/S: Z Rotate | Enter: Attach`);

          // Update rotation, position, and scale state
          const THREE = (window as any).THREE;
          if (THREE) {
            setModelRotation({
              x: (selectedObject.rotation.x * 180) / Math.PI,
              y: (selectedObject.rotation.y * 180) / Math.PI,
              z: (selectedObject.rotation.z * 180) / Math.PI
            });
            setModelPosition({
              x: selectedObject.position.x,
              y: selectedObject.position.y,
              z: selectedObject.position.z
            });
            setModelScale({
              x: selectedObject.scale.x,
              y: selectedObject.scale.y,
              z: selectedObject.scale.z
            });
          }

          // Log for debugging
          console.log(`✅ Selected target part: ${partType}, filename: ${actualFileName}`);
          console.log(`✅ Part is ready for rotation with Arrow Keys`);
        } else {
          // Show info for non-target parts
          toast.info(`Selected: ${actualFileName}`);
          console.log(`ℹ️ Selected part (not target): ${actualFileName}, partType: ${partType || 'null'}`);
        }

        // Force render to show selection
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      } else {
        // Deselect if clicking on empty space
        if (selectedPart && selectedPart.material) {
          if (Array.isArray(selectedPart.material)) {
            selectedPart.material.forEach((mat: any) => {
              if (mat.emissive) mat.emissive.setHex(0x000000);
            });
          } else {
            if (selectedPart.material.emissive) {
              selectedPart.material.emissive.setHex(0x000000);
            }
          }
        }

        // Also reset highlights for all models
        if (modelsRef.current && modelsRef.current.length > 0) {
          modelsRef.current.forEach((model) => {
            model.traverse((child: any) => {
              if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: any) => {
                    if (mat.emissive) mat.emissive.setHex(0x000000);
                  });
                } else {
                  if (child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                  }
                }
              }
            });
          });
        }

        setSelectedPart(null);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [selectedPart, isDragging]);

  // Handle model movement with arrow keys or drag - Also works for 5 target parts even without drag mode
  useEffect(() => {
    // For combined models, allow selecting from modelsRef.current
    let targetObject = selectedPart;
    if (!targetObject) {
      if (modelsRef.current && modelsRef.current.length > 0) {
        targetObject = modelsRef.current[0];
      } else {
        targetObject = modelRef.current;
      }
    }
    if (!targetObject) return;

    // Check if this is one of the 5 target GLB parts
    const targetPartTypes = [
      'wmss_single_skin_1_sec',
      'one_collar_single_skin',
      'single_skin_right_side_part',
      'single_skin_left_side_part',
      'single_skin_front_part'
    ];

    // Identify part type
    let partType = identifyPartType(targetObject);
    if (!partType) {
      let foundName = targetObject.userData?.originalName ||
        targetObject.userData?.filename ||
        targetObject.name || '';
      if (!foundName || foundName === '') {
        targetObject.traverse((child: any) => {
          if (!foundName && (child.userData?.originalName || child.userData?.filename || child.name)) {
            foundName = child.userData?.originalName || child.userData?.filename || child.name;
          }
        });
      }
      if (foundName) {
        partType = identifyPartType({
          userData: {
            modelType: targetObject.userData?.modelType,
            originalName: foundName,
            filename: foundName
          },
          name: foundName
        });
      }
    }
    const isTargetPart = partType && targetPartTypes.includes(partType);

    // Always enable keyboard controls for selected parts (especially target parts)
    // For non-target parts, only enable if drag mode is on
    if (!isTargetPart && !isDragMode) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (!targetObject) {
        console.log('⚠️ No target object for keyboard control');
        return;
      }

      // Re-check if this is a target part (in case selection changed)
      const targetPartTypes = [
        'wmss_single_skin_1_sec',
        'one_collar_single_skin',
        'single_skin_right_side_part',
        'single_skin_left_side_part',
        'single_skin_front_part'
      ];

      let currentPartType = identifyPartType(targetObject);
      if (!currentPartType) {
        let foundName = targetObject.userData?.originalName ||
          targetObject.userData?.filename ||
          targetObject.name || '';
        if (!foundName || foundName === '') {
          targetObject.traverse((child: any) => {
            if (!foundName && (child.userData?.originalName || child.userData?.filename || child.name)) {
              foundName = child.userData?.originalName || child.userData?.filename || child.name;
            }
          });
        }
        if (foundName) {
          currentPartType = identifyPartType({
            userData: {
              modelType: targetObject.userData?.modelType,
              originalName: foundName,
              filename: foundName
            },
            name: foundName
          });
        }
      }
      const currentIsTargetPart = currentPartType && targetPartTypes.includes(currentPartType);

      if (!currentIsTargetPart) {
        // For non-target parts, use original position movement
        const moveDistance = 0.1;
        switch (e.key) {
          case 'ArrowUp':
            targetObject.position.y += moveDistance;
            break;
          case 'ArrowDown':
            targetObject.position.y -= moveDistance;
            break;
          case 'ArrowLeft':
            targetObject.position.x -= moveDistance;
            break;
          case 'ArrowRight':
            targetObject.position.x += moveDistance;
            break;
          default:
            return;
        }
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        return;
      }

      console.log(`🎹 Keyboard pressed: ${e.key} on target part: ${currentPartType}`);

      // For target parts: rotation, position, and attachment
      const moveDistance = 0.01; // Smaller movement for precision
      const rotateAmount = 1; // 1 degree

      // Prevent default for arrow keys to avoid page scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }

      console.log(`🎹 Keyboard pressed: ${e.key} on target part: ${currentPartType}`);

      switch (e.key) {
        // Arrow keys for rotation (more intuitive)
        case 'ArrowUp':
          console.log(`🔄 Rotating ${currentPartType} X-axis -1°`);
          rotatePart('x', -rotateAmount, true, targetObject);
          break;
        case 'ArrowDown':
          console.log(`🔄 Rotating ${currentPartType} X-axis +1°`);
          rotatePart('x', rotateAmount, true, targetObject);
          break;
        case 'ArrowLeft':
          console.log(`🔄 Rotating ${currentPartType} Y-axis -1°`);
          rotatePart('y', -rotateAmount, true, targetObject);
          break;
        case 'ArrowRight':
          console.log(`🔄 Rotating ${currentPartType} Y-axis +1°`);
          rotatePart('y', rotateAmount, true, targetObject);
          break;
        // Additional rotation controls
        case 'q':
        case 'Q':
          rotatePart('x', -rotateAmount, true, targetObject);
          break;
        case 'e':
        case 'E':
          rotatePart('x', rotateAmount, true, targetObject);
          break;
        case 'a':
        case 'A':
          rotatePart('y', -rotateAmount, true, targetObject);
          break;
        case 'd':
        case 'D':
          rotatePart('y', rotateAmount, true, targetObject);
          break;
        case 'w':
        case 'W':
          console.log(`🔄 Rotating ${currentPartType} Z-axis -1°`);
          rotatePart('z', -rotateAmount, true, targetObject);
          break;
        case 's':
        case 'S':
          console.log(`🔄 Rotating ${currentPartType} Z-axis +1°`);
          rotatePart('z', rotateAmount, true, targetObject);
          break;
        // Position controls
        case 'PageUp':
          updatePosition('y', moveDistance, targetObject);
          break;
        case 'PageDown':
          updatePosition('y', -moveDistance, targetObject);
          break;
        case 'Home':
          updatePosition('x', -moveDistance, targetObject);
          break;
        case 'End':
          updatePosition('x', moveDistance, targetObject);
          break;
        case 'Insert':
          updatePosition('z', moveDistance, targetObject);
          break;
        case 'Delete':
          updatePosition('z', -moveDistance, targetObject);
          break;
        // Attachment controls
        case 'Enter':
          if (modelsRef.current && modelsRef.current.length >= 2) {
            attachParts('center');
          } else {
            toast.error('Need at least 2 parts to attach');
          }
          break;
        default:
          return;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isDragMode || !targetObject || !canvasRef.current) return;

      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !targetObject || !dragStartPosRef.current) return;

      const deltaX = (e.clientX - dragStartPosRef.current.x) * 0.01;
      const deltaY = (e.clientY - dragStartPosRef.current.y) * 0.01;

      targetObject.position.x += deltaX;
      targetObject.position.y -= deltaY;

      dragStartPosRef.current = { x: e.clientX, y: e.clientY };

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartPosRef.current = null;
    };

    window.addEventListener('keydown', handleKeyPress);
    if (canvasRef.current) {
      canvasRef.current.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [isDragMode, isDragging, selectedPart]);

  return (
    <Card className={`p-0 flex flex-col ${isFullPageMode ? (isFullPageScroll ? 'relative z-50 m-0 rounded-none min-h-screen' : 'fixed inset-0 z-50 m-0 rounded-none overflow-hidden') : 'h-full'}`}>
      <div className={`mb-2 px-4 pt-4 ${isFullPageMode ? 'bg-card border-b sticky top-0 z-10' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-foreground">3D Model Viewer</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullPageMode(!isFullPageMode)}
              className="gap-2"
              title={isFullPageMode ? 'Exit Full Page Mode' : 'Enter Full Page Mode'}
            >
              {isFullPageMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              {isFullPageMode ? 'Exit Full Page' : 'Full Page'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          )}

          {currentFile && (
            <div className="space-y-2">
              {/* File Navigation and Name Display */}
              {glbUrls && glbUrls.length > 1 && currentFileType === 'glb' && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousFile}
                    className="h-8 w-8 p-0"
                    title="Previous file"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-muted-foreground">
                      File {currentFileIndex + 1} of {glbUrls.length}
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate" title={
                      glbFileNames && glbFileNames[currentFileIndex]
                        ? glbFileNames[currentFileIndex]
                        : currentFile.split('/').pop() || ''
                    }>
                      {glbFileNames && glbFileNames[currentFileIndex]
                        ? glbFileNames[currentFileIndex]
                        : currentFile.split('/').pop() || `File ${currentFileIndex + 1}`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextFile}
                    className="h-8 w-8 p-0"
                    title="Next file"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Current File Info */}
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs px-2 py-1 rounded ${currentFileType === 'glb'
                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                    : 'bg-green-500/20 text-green-700 dark:text-green-400'
                    }`}>
                    {currentFileType === 'glb' ? '3D Model' : 'Image'}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {glbFileNames && glbUrls && glbUrls.length > 0 && currentFileType === 'glb' && glbFileNames[currentFileIndex]
                      ? glbFileNames[currentFileIndex]
                      : currentFile.split('/').pop()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (modelRef.current && sceneRef.current) {
                      sceneRef.current.remove(modelRef.current);
                      modelRef.current.traverse((child: any) => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                          if (Array.isArray(child.material)) {
                            child.material.forEach((mat: any) => mat.dispose());
                          } else {
                            child.material.dispose();
                          }
                        }
                      });
                      modelRef.current = null;
                    }
                    if (imagePlaneRef.current && sceneRef.current) {
                      sceneRef.current.remove(imagePlaneRef.current);
                      if (imagePlaneRef.current.material) {
                        imagePlaneRef.current.material.dispose();
                      }
                      if (imagePlaneRef.current.geometry) {
                        imagePlaneRef.current.geometry.dispose();
                      }
                      imagePlaneRef.current = null;
                    }
                    setCurrentFile(null);
                    setCurrentFileType(null);
                    setCurrentFileIndex(0);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 relative bg-muted ${isFullPageMode ? (isFullPageScroll ? 'min-h-[75vh]' : 'h-[75vh]') : isFullPageScroll ? 'min-h-screen' : 'min-h-[800px]'} ${isFullPageScroll ? 'overflow-auto' : 'overflow-hidden'}`}>
        {/* Arrow Mark Controls - Directly on 3D Viewer Canvas */}
        {modelsRef.current && modelsRef.current.length > 0 && (() => {
          // Filter to only show the 5 specific parts
          const targetPartTypes = [
            'wmss_single_skin_1_sec',
            'one_collar_single_skin',
            'single_skin_right_side_part',
            'single_skin_left_side_part',
            'single_skin_front_part'
          ];

          const filteredParts = modelsRef.current
            .map((model) => ({
              model,
              partType: identifyPartType(model)
            }))
            .filter(({ partType }) => partType && targetPartTypes.includes(partType))
            .slice(0, 5); // Limit to 5 parts

          if (filteredParts.length === 0) return null;

          // Helper function to select part and show message
          const selectPartWithMessage = (model: any) => {
            // Deselect previous part
            if (selectedPart && selectedPart.material) {
              if (Array.isArray(selectedPart.material)) {
                selectedPart.material.forEach((mat: any) => {
                  if (mat.emissive) mat.emissive.setHex(0x000000);
                });
              } else {
                if (selectedPart.material.emissive) {
                  selectedPart.material.emissive.setHex(0x000000);
                }
              }
            }
            // Clear all highlights
            modelsRef.current.forEach((m) => {
              m.traverse((child: any) => {
                if (child.isMesh && child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat: any) => {
                      if (mat.emissive) mat.emissive.setHex(0x000000);
                    });
                  } else {
                    if (child.material.emissive) {
                      child.material.emissive.setHex(0x000000);
                    }
                  }
                }
              });
            });
            // Highlight selected part
            model.traverse((child: any) => {
              if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: any) => {
                    if (mat.emissive) mat.emissive.setHex(0x444444);
                  });
                } else {
                  if (child.material.emissive) {
                    child.material.emissive.setHex(0x444444);
                  }
                }
              }
            });
            setSelectedPart(model);
            // Get actual GLB filename for message
            const actualFileName = model.userData?.filename || model.userData?.originalName || model.name || 'part';
            setSelectedPartName(actualFileName);
            toast.success(`✓ Selected: "${actualFileName}"`);

            const THREE = (window as any).THREE;
            if (THREE) {
              setModelRotation({
                x: (model.rotation.x * 180) / Math.PI,
                y: (model.rotation.y * 180) / Math.PI,
                z: (model.rotation.z * 180) / Math.PI
              });
              setModelPosition({
                x: model.position.x,
                y: model.position.y,
                z: model.position.z
              });
              setModelScale({
                x: model.scale.x,
                y: model.scale.y,
                z: model.scale.z
              });
            }
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
              rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
          };

          // Helper function to select and rotate
          const selectAndRotate = (model: any, axis: 'x' | 'y' | 'z', degrees: number) => {
            // First select the part
            if (selectedPart !== model) {
              selectPartWithMessage(model);
            }
            // Small delay to ensure selection is processed, then rotate
            setTimeout(() => {
              rotatePart(axis, degrees, true, model);
            }, 100);
          };

          // No UI controls - parts are selected by clicking directly on them in the 3D viewer
          // Store filtered parts for use in click handler
          return null;
        })()}

        <div
          ref={canvasRef}
          className="w-full h-full"
          style={{
            position: 'relative',
            minHeight: isFullPageMode ? (isFullPageScroll ? '75vh' : '100%') : isFullPageScroll ? '100vh' : '800px',
            width: '100%',
            height: isFullPageMode && !isFullPageScroll ? '100%' : isFullPageScroll ? 'auto' : '100%',
            display: 'block'
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-background/80">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading 3D model...</p>
            {glbUrl && (
              <p className="text-xs text-muted-foreground mt-1 max-w-md text-center truncate">
                {glbUrl.split('/').pop()}
              </p>
            )}
          </div>
        )}
        {/* Loading state when model type is selected but file not loaded yet */}
        {!currentFile && (isLoading || modelType) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/80">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {modelType ? `Loading ${modelType.replace(/_/g, ' ')}...` : 'Loading 3D model...'}
              </p>
            </div>
          </div>
        )}

        {/* Empty state when no model loaded and no model types available */}
        {!currentFile && !isLoading && !modelType && modelTypes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">No model loaded</p>
              <p className="text-sm text-muted-foreground/70">Select a model type from the dropdown above</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel - Always visible at bottom */}
      <div className={`mt-2 px-4 pb-4 space-y-3 ${isFullPageMode ? (isFullPageScroll ? 'bg-card border-t min-h-[25vh] overflow-y-auto shadow-lg' : 'bg-card border-t h-[25vh] overflow-y-auto shadow-lg') : ''}`}>
        {/* View Controls Section - Enhanced with all views */}
        <div className="border-b pb-3 mb-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <Label className="text-xs font-semibold text-foreground">Camera Views:</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="gap-2"
                title="Toggle full page mode (keeps all controls visible)"
              >
                {isFullPageMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                {isFullPageMode ? 'Exit Full Page' : 'Full Page'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullPageScroll(!isFullPageScroll)}
                className={`gap-2 ${isFullPageScroll ? 'bg-primary text-primary-foreground' : ''}`}
                title="Enable/disable full page scroll mode"
              >
                <RotateCw className="h-4 w-4" />
                {isFullPageScroll ? 'Disable' : 'Enable'} Scroll
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(0, 10, 0); // Top view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Top View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Top View (Plan)"
            >
              <Box className="h-4 w-4" />
              Top
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(0, -10, 0); // Bottom view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Bottom View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Bottom View"
            >
              <Box className="h-4 w-4 rotate-180" />
              Bottom
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(0, 0, 10); // Front view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Front View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Front View (Elevation)"
            >
              <Boxes className="h-4 w-4" />
              Front
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(10, 0, 0); // Right side view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Right Side View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Right Side View"
            >
              <ArrowRight className="h-4 w-4" />
              Right
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(-10, 0, 0); // Left side view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Left Side View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Left Side View"
            >
              <ArrowLeft className="h-4 w-4" />
              Left
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(5, 5, 5); // Isometric view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Isometric View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Isometric View (3D)"
            >
              <Grid3x3 className="h-4 w-4" />
              Isometric
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(10, 0, 0); // X-axis view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('X-Axis View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="X-Axis View"
            >
              <ArrowRight className="h-4 w-4" />
              X-Axis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(0, 10, 0); // Y-axis view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Y-Axis View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Y-Axis View"
            >
              <ArrowUp className="h-4 w-4" />
              Y-Axis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const THREE = (window as any).THREE;
                  if (THREE) {
                    cameraRef.current.position.set(0, 0, 10); // Z-axis view
                    cameraRef.current.lookAt(0, 0, 0);
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                    if (rendererRef.current && sceneRef.current) {
                      rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                    toast.success('Z-Axis View');
                  }
                }
              }}
              className="gap-2"
              disabled={!currentFile}
              title="Z-Axis View"
            >
              <ArrowDown className="h-4 w-4 rotate-90" />
              Z-Axis
            </Button>
          </div>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetCamera}
              className="gap-2 w-full"
              disabled={!currentFile}
              title="Reset camera view to default position"
            >
              <RotateCcw className="h-4 w-4" />
              Reset View
            </Button>
          </div>
        </div>

        {/* Always-visible controls for the 5 target GLB parts */}
        {(modelsRef.current?.length > 0 || (glbUrls && glbUrls.length > 0)) && (
          <div className="space-y-2 border-b pb-3 mb-3">
            <Label className="text-xs font-semibold text-foreground">WMSS + Collar 5-Part Controls</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {TARGET_PART_TYPES.map(({ type, label }) => (
                <div key={`always-${type}`} className="border rounded-md p-2 bg-card/60 space-y-1">
                  <div className="text-xs font-semibold text-foreground truncate" title={label}>{label}</div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => selectPartByType(type)}>
                      Select
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotXMinus')}>
                      X -
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotXPlus')}>
                      X +
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotYMinus')}>
                      Y -
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotYPlus')}>
                      Y +
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotZMinus')}>
                      Z -
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotZPlus')}>
                      Z +
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveUp')}>
                      Up
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveDown')}>
                      Down
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveLeft')}>
                      Left
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveRight')}>
                      Right
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Rot step: {rotationStepDeg}° · Move step: {nudgeStep}m
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Part Attachment Controls - For combined models */}
        {modelsRef.current && modelsRef.current.length >= 2 && (
          <div className="space-y-2 border-t pt-3 mt-3">
            <Label className="text-xs font-semibold text-foreground mb-2 block flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attach Parts (Select part, then click arrow direction):
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => attachParts('left')}
                className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                title="Attach selected part to left side"
              >
                <ArrowLeft className="h-4 w-4" />
                ← Left
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => attachParts('side')}
                className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                title="Attach selected part to right side"
              >
                <ArrowRight className="h-4 w-4" />
                Right →
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => attachParts('top')}
                className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                title="Attach selected part to top"
              >
                <ArrowUp className="h-4 w-4" />
                ↑ Top
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => attachParts('bottom')}
                className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                title="Attach selected part to bottom"
              >
                <ArrowDown className="h-4 w-4" />
                ↓ Bottom
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => attachParts('front')}
                className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                title="Attach selected part to front"
              >
                <ArrowRight className="h-4 w-4 rotate-[-90deg]" />
                ↙ Front
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => attachParts('center')}
                className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                title="Center align selected part"
              >
                <Circle className="h-4 w-4" />
                ⊙ Center
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
              💡 Tip: Select a part first, then click an arrow direction to attach it to the base part.
            </div>
            <div className="mt-2 space-y-2">
              <Button
                variant="default"
                size="sm"
                onClick={attachAllSideParts}
                className="gap-2 w-full"
                title="Attach all side parts together sequentially"
              >
                <Boxes className="h-4 w-4" />
                Attach All Side Parts Together
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={autoPositionAllParts}
                className="gap-2 w-full bg-blue-600 hover:bg-blue-700"
                title="Auto-position all parts based on configuration (X, Y, Z positions and rotations)"
              >
                <Move className="h-4 w-4" />
                Auto-Position All Parts (WMSS Assembly)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllPartsToCenter}
                className="gap-2 w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                title="Reset all parts to center position (0,0,0), rotation (0,0,0), and scale (1,1,1)"
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Parts to Center (0,0,0)
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className="gap-2"
          >
            <Grid3x3 className="h-4 w-4" />
            {showGrid ? 'Hide' : 'Show'} Grid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAxes(!showAxes)}
            className="gap-2"
          >
            {showAxes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showAxes ? 'Hide' : 'Show'} Axes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWireframe(!wireframe)}
            className="gap-2"
            disabled={currentFileType !== 'glb'}
          >
            <Grid3x3 className="h-4 w-4" />
            {wireframe ? 'Solid' : 'Wireframe'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportScreenshot}
            className="gap-2"
            disabled={!currentFile}
          >
            <Download className="h-4 w-4" />
            Screenshot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullPageScroll(!isFullPageScroll)}
            className={`gap-2 ${isFullPageScroll ? 'bg-primary text-primary-foreground' : ''}`}
            title="Enable/disable full page scroll mode"
          >
            <RotateCw className="h-4 w-4" />
            {isFullPageScroll ? 'Disable' : 'Enable'} Scroll
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDragMode}
            className={`gap-2 ${isDragMode ? 'bg-primary text-primary-foreground' : ''}`}
            disabled={!currentFile}
          >
            <Move className="h-4 w-4" />
            {isDragMode ? 'Disable' : 'Enable'} Move
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
            className={`gap-2 ${isMultiSelectMode ? 'bg-primary text-primary-foreground' : ''}`}
            title="Enable multi-select mode to select multiple parts"
          >
            {isMultiSelectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {isMultiSelectMode ? `Multi-Select (${selectedParts.size})` : 'Multi-Select'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAttachFile}
            className="gap-2"
          >
            <Paperclip className="h-4 w-4" />
            Attach GLB
          </Button>
        </div>


        <div className="flex items-center gap-2">
          <Label htmlFor="bg-color" className="text-xs text-muted-foreground">
            Background:
          </Label>
          <input
            id="bg-color"
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="h-8 w-16 rounded border border-border cursor-pointer"
          />
        </div>

        {/* Parts List - Removed per user request */}
        {false && modelParts.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                Model Parts ({modelParts.length}) - Click to Select
              </Label>
              <div className="relative w-48">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search parts..."
                  value={partsSearchFilter}
                  onChange={(e) => setPartsSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 text-xs border rounded-md bg-background"
                />
              </div>
            </div>

            {/* Filtered parts by category */}
            {(() => {
              const filteredParts = modelParts.filter(part =>
                part.name.toLowerCase().includes(partsSearchFilter.toLowerCase()) ||
                (part.category && part.category.toLowerCase().includes(partsSearchFilter.toLowerCase()))
              );

              const groupedParts = filteredParts.reduce((acc, part) => {
                const category = part.category || 'Other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(part);
                return acc;
              }, {} as Record<string, typeof filteredParts>);

              const categories = Object.keys(groupedParts).sort();

              return (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {categories.map(category => (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">
                          {category} ({groupedParts[category].length})
                        </Label>
                        {category === 'Solid' && groupedParts[category].length > 0 && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAllByCategory('Solid')}
                              className="h-6 px-2 text-xs"
                              title={`Select all ${groupedParts[category].length} solid parts`}
                            >
                              <CheckSquare className="h-3 w-3 mr-1" />
                              Select All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteByCategory('Solid')}
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                              title={`Delete all ${groupedParts[category].length} solid parts`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete All
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {groupedParts[category].map((part, index) => (
                          <div key={`${category}-${index}`} className="relative group">
                            <Button
                              variant={
                                isMultiSelectMode
                                  ? (selectedParts.has(part.object) ? 'default' : 'outline')
                                  : (selectedPart === part.object ? 'default' : 'outline')
                              }
                              size="sm"
                              onClick={() => {
                                // Calculate new selection state
                                let newSelectedParts: Set<any>;
                                if (!isMultiSelectMode) {
                                  newSelectedParts = new Set([part.object]);
                                  setSelectedPart(part.object);
                                  setSelectedParts(newSelectedParts);
                                } else {
                                  newSelectedParts = new Set(selectedParts);
                                  if (newSelectedParts.has(part.object)) {
                                    newSelectedParts.delete(part.object);
                                  } else {
                                    newSelectedParts.add(part.object);
                                  }
                                  setSelectedParts(newSelectedParts);

                                  // Update single selection for compatibility
                                  if (newSelectedParts.size === 1) {
                                    setSelectedPart(Array.from(newSelectedParts)[0]);
                                  } else {
                                    setSelectedPart(null);
                                  }
                                }

                                // Update highlights
                                const THREE = (window as any).THREE;

                                // Reset all previous highlights
                                modelParts.forEach((p) => {
                                  if (p.object.material) {
                                    if (Array.isArray(p.object.material)) {
                                      p.object.material.forEach((mat: any) => {
                                        if (mat.emissive) mat.emissive.setHex(0x000000);
                                      });
                                    } else {
                                      if (p.object.material.emissive) {
                                        p.object.material.emissive.setHex(0x000000);
                                      }
                                    }
                                  }
                                });

                                // Highlight selected parts using new state
                                if (isMultiSelectMode) {
                                  newSelectedParts.forEach((obj) => {
                                    if (obj.material) {
                                      if (Array.isArray(obj.material)) {
                                        obj.material.forEach((mat: any) => {
                                          if (mat.emissive) mat.emissive.setHex(0x444444);
                                        });
                                      } else {
                                        if (obj.material.emissive) {
                                          obj.material.emissive.setHex(0x444444);
                                        }
                                      }
                                    }
                                  });
                                } else if (part.object.material) {
                                  if (Array.isArray(part.object.material)) {
                                    part.object.material.forEach((mat: any) => {
                                      if (mat.emissive) mat.emissive.setHex(0x444444);
                                    });
                                  } else {
                                    if (part.object.material.emissive) {
                                      part.object.material.emissive.setHex(0x444444);
                                    }
                                  }
                                }

                                if (!isMultiSelectMode) {
                                  toast.info(`Selected: ${part.name}`);
                                } else {
                                  toast.info(`${newSelectedParts.size} part(s) selected`);
                                }

                                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                                }
                              }}
                              className={`text-xs h-7 pr-8 ${isMultiSelectMode && selectedParts.has(part.object) ? 'ring-2 ring-primary' : ''}`}
                              title={
                                isMultiSelectMode
                                  ? `Click to ${selectedParts.has(part.object) ? 'deselect' : 'select'} ${part.name}. Right-click to delete.`
                                  : `Click to select ${part.name}. Right-click to delete.`
                              }
                              onContextMenu={(e) => {
                                e.preventDefault();
                                const partName = part.object.userData?.originalName || part.name;
                                if (window.confirm(`Delete "${partName}"?`)) {
                                  // Select the part first, then delete
                                  setSelectedPart(part.object);
                                  setTimeout(() => {
                                    handleDeleteSelectedPart();
                                  }, 100);
                                }
                              }}
                            >
                              {isMultiSelectMode && (
                                <span className="mr-1">
                                  {selectedParts.has(part.object) ? (
                                    <CheckSquare className="h-3 w-3 inline" />
                                  ) : (
                                    <Square className="h-3 w-3 inline opacity-50" />
                                  )}
                                </span>
                              )}
                              {!isMultiSelectMode && <MousePointer2 className="h-3 w-3 mr-1" />}
                              {part.name.length > 20 ? `${part.name.substring(0, 20)}...` : part.name}
                            </Button>
                            {/* Quick delete button on hover for solid parts */}
                            {part.category === 'Solid' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const partName = part.object.userData?.originalName || part.name;
                                  if (window.confirm(`Delete "${partName}"?`)) {
                                    // Select first, then delete
                                    setSelectedPart(part.object);
                                    setTimeout(() => {
                                      handleDeleteSelectedPart();
                                    }, 100);
                                  }
                                }}
                                className="absolute right-0 top-0 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={`Quick delete ${part.name}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredParts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No parts found matching "{partsSearchFilter}"
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {selectedPart && (
          <div className="mt-2 p-3 bg-muted rounded-md space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedPart.userData?.originalName || selectedPart.name || 'Unknown'}</span>
                {selectedPart.userData?.category && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                    {selectedPart.userData.category}
                  </span>
                )}
              </p>
              {isDragMode && (
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Drag to move or use arrow keys
                </p>
              )}
            </div>

            {/* Quick select for 5 target parts */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Quick Select Parts:</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {TARGET_PART_TYPES.map(({ type, label }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => selectPartByType(type)}
                    className="gap-2 h-8 text-xs"
                    title={`Select ${label}`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Works when those parts are loaded: Only Top, Left, Right, Front, Collar Hole.
              </p>
            </div>

            {/* Per-part quick boxes (select + rotate + move) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Per-Part Controls (5 GLBs):</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {TARGET_PART_TYPES.map(({ type, label }) => (
                  <div key={`${type}-box`} className="border rounded-md p-2 bg-card/60 space-y-1">
                    <div className="text-xs font-semibold text-foreground truncate" title={label}>{label}</div>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => selectPartByType(type)}>
                        Select
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotYMinus')}>
                        Y -
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'rotYPlus')}>
                        Y +
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveUp')}>
                        Up
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveDown')}>
                        Down
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveLeft')}>
                        Left
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => applyActionToPart(type, 'moveRight')}>
                        Right
                      </Button>
                    </div>
                    {/* Position X, Y, Z Input Fields */}
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <div className="flex flex-col">
                        <Label className="text-[9px] text-muted-foreground mb-0.5">X (m)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-6 text-[10px] px-1"
                          placeholder="0.0"
                          onBlur={(e) => {
                            const target = modelsRef.current?.find(m => identifyPartType(m) === type);
                            if (target) {
                              const val = parseFloat(e.target.value);
                              if (Number.isFinite(val)) {
                                target.position.x = val;
                                setModelPosition({ x: val, y: target.position.y, z: target.position.z });
                                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                                }
                                toast.success(`${label} X position set to ${val.toFixed(2)}m`);
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label className="text-[9px] text-muted-foreground mb-0.5">Y (m)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-6 text-[10px] px-1"
                          placeholder="0.0"
                          onBlur={(e) => {
                            const target = modelsRef.current?.find(m => identifyPartType(m) === type);
                            if (target) {
                              const val = parseFloat(e.target.value);
                              if (Number.isFinite(val)) {
                                target.position.y = val;
                                setModelPosition({ x: target.position.x, y: val, z: target.position.z });
                                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                                }
                                toast.success(`${label} Y position set to ${val.toFixed(2)}m`);
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label className="text-[9px] text-muted-foreground mb-0.5">Z (m)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-6 text-[10px] px-1"
                          placeholder="0.0"
                          onBlur={(e) => {
                            const target = modelsRef.current?.find(m => identifyPartType(m) === type);
                            if (target) {
                              const val = parseFloat(e.target.value);
                              if (Number.isFinite(val)) {
                                target.position.z = val;
                                setModelPosition({ x: target.position.x, y: target.position.y, z: val });
                                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                                }
                                toast.success(`${label} Z position set to ${val.toFixed(2)}m`);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Rot step: {rotationStepDeg}° · Move step: {nudgeStep}m
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rotation Controls */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Rotate (1° steps):</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <Button variant="outline" size="sm" onClick={() => handleRotationAdjust('x', -1)} className="gap-1 h-8" title="Rotate X -1°">
                  <RotateCcw className="h-3 w-3" />
                  <span className="text-xs">X -</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRotationAdjust('x', 1)} className="gap-1 h-8" title="Rotate X +1°">
                  <RotateCw className="h-3 w-3" />
                  <span className="text-xs">X +</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRotationAdjust('y', -1)} className="gap-1 h-8" title="Rotate Y -1°">
                  <RotateCcw className="h-3 w-3" />
                  <span className="text-xs">Y -</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRotationAdjust('y', 1)} className="gap-1 h-8" title="Rotate Y +1°">
                  <RotateCw className="h-3 w-3" />
                  <span className="text-xs">Y +</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRotationAdjust('z', -1)} className="gap-1 h-8" title="Rotate Z -1°">
                  <RotateCcw className="h-3 w-3" />
                  <span className="text-xs">Z -</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRotationAdjust('z', 1)} className="gap-1 h-8" title="Rotate Z +1°">
                  <RotateCw className="h-3 w-3" />
                  <span className="text-xs">Z +</span>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Label className="text-[11px] text-muted-foreground">Step (°)</Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={rotationStepDeg}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      setRotationStepDeg(Number.isFinite(next) ? next : 1);
                    }}
                    className="h-8 w-20 text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={resetSelectedRotation} className="gap-2 h-8">
                  <RotateCcw className="h-3 w-3" />
                  <span className="text-xs">Reset Rotation</span>
                </Button>
                <div className="text-[11px] text-muted-foreground ml-auto">
                  X {modelRotation.x.toFixed(1)}° | Y {modelRotation.y.toFixed(1)}° | Z {modelRotation.z.toFixed(1)}°
                </div>
              </div>
            </div>

            {/* Axis Nudge Controls */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Axis Nudge (smooth horizontal/vertical):</Label>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">Step (m)</Label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.01"
                  value={nudgeStep}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    setNudgeStep(Number.isFinite(next) ? next : 0.01);
                  }}
                  className="h-8 w-24 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Button variant="outline" size="sm" onClick={() => handleAxisNudge('x', -1)} className="gap-1 h-8" title="Move X -step (left)">
                  <ArrowLeft className="h-3 w-3" />
                  <span className="text-xs">X -</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAxisNudge('x', 1)} className="gap-1 h-8" title="Move X +step (right)">
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-xs">X +</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAxisNudge('y', 1)} className="gap-1 h-8" title="Move Y +step (up)">
                  <ArrowUp className="h-3 w-3" />
                  <span className="text-xs">Y +</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAxisNudge('y', -1)} className="gap-1 h-8" title="Move Y -step (down)">
                  <ArrowDown className="h-3 w-3" />
                  <span className="text-xs">Y -</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAxisNudge('z', -1)} className="gap-1 h-8" title="Move Z -step (forward)">
                  <ArrowUp className="h-3 w-3 rotate-[-45deg]" />
                  <span className="text-xs">Z -</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAxisNudge('z', 1)} className="gap-1 h-8" title="Move Z +step (back)">
                  <ArrowDown className="h-3 w-3 rotate-[45deg]" />
                  <span className="text-xs">Z +</span>
                </Button>
              </div>
            </div>

            {/* Position Control Buttons */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Move Position:</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('up', 0.1)}
                  className="gap-1 h-8"
                  title="Move Up"
                >
                  <ArrowUp className="h-3 w-3" />
                  <span className="text-xs">Up</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('forward', 0.1)}
                  className="gap-1 h-8"
                  title="Move Forward"
                >
                  <ArrowUp className="h-3 w-3 rotate-[-45deg]" />
                  <span className="text-xs">Forward</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('backward', 0.1)}
                  className="gap-1 h-8"
                  title="Move Backward"
                >
                  <ArrowDown className="h-3 w-3 rotate-[45deg]" />
                  <span className="text-xs">Back</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('left', 0.1)}
                  className="gap-1 h-8"
                  title="Move Left"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span className="text-xs">Left</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Reset position to center
                    const THREE = (window as any).THREE;
                    if (selectedPart && THREE) {
                      selectedPart.position.set(0, 0, 0);
                      if (rendererRef.current && sceneRef.current && cameraRef.current) {
                        rendererRef.current.render(sceneRef.current, cameraRef.current);
                      }
                      toast.info('Position reset to center');
                    }
                  }}
                  className="gap-1 h-8"
                  title="Reset Position"
                >
                  <Circle className="h-3 w-3" />
                  <span className="text-xs">Center</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('right', 0.1)}
                  className="gap-1 h-8"
                  title="Move Right"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-xs">Right</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('down', 0.1)}
                  className="gap-1 h-8"
                  title="Move Down"
                >
                  <ArrowDown className="h-3 w-3" />
                  <span className="text-xs">Down</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('left', 0.5)}
                  className="gap-1 h-8"
                  title="Move Left (Large)"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span className="text-xs">Left+</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('right', 0.5)}
                  className="gap-1 h-8"
                  title="Move Right (Large)"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-xs">Right+</span>
                </Button>
              </div>

              {/* Fine-tune controls */}
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('left', 0.01)}
                  className="gap-1 flex-1 h-7 text-xs"
                  title="Fine Move Left"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Fine Left
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('right', 0.01)}
                  className="gap-1 flex-1 h-7 text-xs"
                  title="Fine Move Right"
                >
                  <ArrowRight className="h-3 w-3" />
                  Fine Right
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('up', 0.01)}
                  className="gap-1 flex-1 h-7 text-xs"
                  title="Fine Move Up"
                >
                  <ArrowUp className="h-3 w-3" />
                  Fine Up
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePart('down', 0.01)}
                  className="gap-1 flex-1 h-7 text-xs"
                  title="Fine Move Down"
                >
                  <ArrowDown className="h-3 w-3" />
                  Fine Down
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>Controls: Click on parts to select | Enable Move mode to drag parts | Use arrow keys to move selected part</p>
          <p className="mt-1">Left click + drag to rotate | Right click + drag to pan | Scroll to zoom</p>
          <p className="mt-1">Supported: GLB/GLTF 3D models and images (JPG, PNG, GIF, etc.)</p>
        </div>

        {/* Message Box - Selected Part Name */}
        {selectedPartName && (
          <div className="mt-4 p-3 bg-primary/10 border-2 border-primary/30 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                <div>
                  <div className="text-xs font-semibold text-primary">Selected Part:</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{selectedPartName}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPartName('');
                  if (selectedPart) {
                    selectedPart.traverse((child: any) => {
                      if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                          child.material.forEach((mat: any) => {
                            if (mat.emissive) mat.emissive.setHex(0x000000);
                          });
                        } else {
                          if (child.material.emissive) {
                            child.material.emissive.setHex(0x000000);
                          }
                        }
                      }
                    });
                  }
                  setSelectedPart(null);
                }}
                className="h-6 w-6 p-0 hover:bg-primary/20"
                title="Clear selection"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        {!selectedPartName && currentFile && (
          <div className="mt-4 p-3 bg-muted/80 border border-border rounded-lg shadow">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
              <div>
                <div className="text-xs text-muted-foreground">Current file:</div>
                <div className="text-sm font-semibold text-foreground truncate">
                  {currentFile.split('/').pop()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

GLBViewer.displayName = 'GLBViewer';

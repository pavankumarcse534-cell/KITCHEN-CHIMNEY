import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, X, RotateCcw, Grid3x3, Download, Maximize, Minimize, Lightbulb, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface GLBViewerProps {
  glbUrl?: string;
  imageUrl?: string;
  modelType?: string; // Current model type for upload
  onGlbExported?: (glbBlob: Blob, filename: string) => void; // Callback when GLB is exported
}

export interface GLBViewerRef {
  exportToGLB: () => void;
}

export const GLBViewer = forwardRef<GLBViewerRef, GLBViewerProps>(({ glbUrl, imageUrl, modelType, onGlbExported }, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const imagePlaneRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const threeLoadedRef = useRef<boolean>(false);
  const gltfLoaderRef = useRef<any>(null);
  const gltfLoaderLoadingRef = useRef<boolean>(false);
  const gltfExporterRef = useRef<any>(null);
  const gltfExporterLoadingRef = useRef<boolean>(false);
  const gridHelperRef = useRef<any>(null);
  const axesHelperRef = useRef<any>(null);
  const initialCameraPositionRef = useRef<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFileType, setCurrentFileType] = useState<'glb' | 'image' | '3d-object' | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#f6f6f6');

  // Load Three.js and dependencies from CDN
  useEffect(() => {
    if (threeLoadedRef.current) return;

    const loadScript = (src: string, type: string = 'text/javascript'): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.type = type;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    // Load GLTFLoader with multiple fallback methods
    const loadGLTFLoader = async (): Promise<any> => {
      // If already loaded, return cached loader
      if (gltfLoaderRef.current) {
        return gltfLoaderRef.current;
      }

      // If already loading, wait for it
      if (gltfLoaderLoadingRef.current) {
        let attempts = 0;
        while (gltfLoaderLoadingRef.current && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
          if (gltfLoaderRef.current) {
            return gltfLoaderRef.current;
          }
        }
      }

      gltfLoaderLoadingRef.current = true;

      try {
        // Check if THREE.js is loaded
        if (!(window as any).THREE) {
          throw new Error('Three.js not loaded yet');
        }

        // Method 1: Use ES module via esm.sh (handles module resolution automatically)
        // Try multiple CDN sources for reliability
        const cdnSources = [
          // esm.sh - handles ES modules properly
          'https://esm.sh/three@0.159.0/examples/jsm/loaders/GLTFLoader.js',
          // skypack - also handles ES modules
          'https://cdn.skypack.dev/three@0.159.0/examples/jsm/loaders/GLTFLoader.js',
          // jsdelivr with ES module
          'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/GLTFLoader.js',
          // unpkg with ES module
          'https://unpkg.com/three@0.159.0/examples/jsm/loaders/GLTFLoader.js'
        ];
        
        // Check if already loaded
        if ((window as any).THREE && (window as any).THREE.GLTFLoader) {
          gltfLoaderRef.current = (window as any).THREE.GLTFLoader;
          gltfLoaderLoadingRef.current = false;
          console.log('✅ GLTFLoader already available from THREE');
          return gltfLoaderRef.current;
        }
        
        let lastError: Error | null = null;
        
        for (const cdnUrl of cdnSources) {
          try {
            console.log(`Attempting to load GLTFLoader via UMD build from: ${cdnUrl}`);
            
            // Check if script is already being loaded
            const existingScript = document.querySelector(`script[src="${cdnUrl}"]`);
            if (existingScript) {
              // Wait for existing script to load
              console.log('GLTFLoader script already loading, waiting...');
              let waitCount = 0;
              while (waitCount < 50 && !((window as any).THREE && (window as any).THREE.GLTFLoader)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
              }
              if ((window as any).THREE && (window as any).THREE.GLTFLoader) {
                gltfLoaderRef.current = (window as any).THREE.GLTFLoader;
                gltfLoaderLoadingRef.current = false;
                console.log('✅ GLTFLoader loaded from existing script');
                return gltfLoaderRef.current;
              }
            }
            
            // Try dynamic import first (works with esm.sh, skypack, and modern CDNs)
            try {
              console.log(`Attempting dynamic import from ${cdnUrl}...`);
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
                gltfLoaderRef.current = loader;
                gltfLoaderLoadingRef.current = false;
                console.log(`✅ GLTFLoader loaded successfully via dynamic import from ${cdnUrl}`);
                return gltfLoaderRef.current;
              }
            } catch (importError) {
              console.warn(`Dynamic import failed from ${cdnUrl}, trying script tag...`, importError);
            }
            
            // Fallback: Use script tag with ES module import
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.type = 'module';
              
              // Create import statement that attaches to window
              script.textContent = `
                import { GLTFLoader } from '${cdnUrl}';
                window.GLTFLoader = GLTFLoader;
                window.dispatchEvent(new CustomEvent('GLTFLoaderReady', { detail: GLTFLoader }));
              `;
              
              const timeout = setTimeout(() => {
                window.removeEventListener('GLTFLoaderReady', handleReady);
                reject(new Error(`Timeout loading GLTFLoader from ${cdnUrl}`));
              }, 15000);
              
              const handleReady = (event: any) => {
                clearTimeout(timeout);
                window.removeEventListener('GLTFLoaderReady', handleReady);
                if (event.detail) {
                  gltfLoaderRef.current = event.detail;
                  gltfLoaderLoadingRef.current = false;
                  console.log(`✅ GLTFLoader loaded successfully via ES module script from ${cdnUrl}`);
                  resolve();
                } else {
                  reject(new Error(`GLTFLoader not provided in event from ${cdnUrl}`));
                }
              };
              
              window.addEventListener('GLTFLoaderReady', handleReady);
              
              script.onerror = (error) => {
                clearTimeout(timeout);
                window.removeEventListener('GLTFLoaderReady', handleReady);
                console.error(`Script error loading from ${cdnUrl}:`, error);
                reject(new Error(`Failed to load ES module script from ${cdnUrl}`));
              };
              
              document.head.appendChild(script);
            });
            
            if (gltfLoaderRef.current) {
              return gltfLoaderRef.current;
            }
          } catch (cdnError) {
            console.warn(`Failed to load from ${cdnUrl}:`, cdnError);
            lastError = cdnError as Error;
            // Try next CDN source
            continue;
          }
        }
        
        // If all CDN sources failed, try fetching and executing the code directly
        const errorDetails = lastError instanceof Error ? lastError.message : 'Unknown error';
        console.error('All CDN sources failed, attempting to fetch GLTFLoader code directly...');
        
        const THREE_Check = (window as any).THREE;
        if (!THREE_Check) {
          throw new Error(`Failed to load GLTFLoader: THREE.js is not available. Please refresh the page.`);
        }
        
        // Try fetching the UMD code and executing it manually as last resort
        for (const fallbackUrl of cdnSources) {
          try {
            console.log(`Trying direct fetch fallback from: ${fallbackUrl}`);
            const response = await fetch(fallbackUrl, {
              mode: 'cors',
              cache: 'no-cache'
            });
            
            if (response.ok) {
              const code = await response.text();
              // Execute the UMD code
              const script = document.createElement('script');
              script.textContent = code;
              document.head.appendChild(script);
              
              // Wait and check multiple times for attachment
              let checkCount = 0;
              while (checkCount < 30) {
                await new Promise(resolve => setTimeout(resolve, 100));
                checkCount++;
                
                const THREE_Final = (window as any).THREE;
                let loader = null;
                if (THREE_Final && THREE_Final.GLTFLoader) {
                  loader = THREE_Final.GLTFLoader;
                } else if (THREE_Final && THREE_Final.examples && THREE_Final.examples.loaders && THREE_Final.examples.loaders.GLTFLoader) {
                  loader = THREE_Final.examples.loaders.GLTFLoader;
                } else if ((window as any).GLTFLoader) {
                  loader = (window as any).GLTFLoader;
                }
                
                if (loader) {
                  gltfLoaderRef.current = loader;
                  gltfLoaderLoadingRef.current = false;
                  console.log(`✅ GLTFLoader loaded successfully via direct fetch from ${fallbackUrl}`);
                  return gltfLoaderRef.current;
                }
              }
            }
          } catch (fetchError) {
            console.warn(`Direct fetch from ${fallbackUrl} failed:`, fetchError);
            continue;
          }
        }
        
        throw new Error(`Failed to load GLTFLoader from all sources. Last error: ${errorDetails}. Please check your internet connection and refresh the page.`);
      } catch (error) {
        // Ensure loading flag is reset in all error cases
        gltfLoaderLoadingRef.current = false;
        throw error;
      }
    };

    const loadThreeJS = async () => {
      try {
        // Load Three.js UMD build
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js');
        console.log('Three.js loaded successfully');
        threeLoadedRef.current = true;
        
        // Preload GLTFLoader in the background
        loadGLTFLoader().catch((error) => {
          console.warn('Preloading GLTFLoader failed, will retry when needed:', error);
        });
      } catch (error) {
        console.error('Failed to load Three.js:', error);
        toast.error('Failed to load 3D viewer library. Please refresh the page.');
      }
    };

    loadThreeJS();
  }, []);

  // Load GLTFExporter for exporting scenes to GLB
  const loadGLTFExporter = async (): Promise<any> => {
    // If already loaded, return cached exporter
    if (gltfExporterRef.current) {
      return gltfExporterRef.current;
    }

    // If already loading, wait for it
    if (gltfExporterLoadingRef.current) {
      let attempts = 0;
      while (gltfExporterLoadingRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        if (gltfExporterRef.current) {
          return gltfExporterRef.current;
        }
      }
    }

    gltfExporterLoadingRef.current = true;

    try {
      const THREE = (window as any).THREE;
      if (!THREE) {
        throw new Error('Three.js not loaded yet');
      }

      // Method 1: Try dynamic import (ES modules)
      try {
        console.log('Attempting to load GLTFExporter via dynamic import...');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error - Dynamic import from CDN URL is not type-checked
        const exporterModule = await import('https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/exporters/GLTFExporter.js') as any;
        const GLTFExporter = exporterModule.GLTFExporter;
        gltfExporterRef.current = GLTFExporter;
        gltfExporterLoadingRef.current = false;
        console.log('GLTFExporter loaded successfully via dynamic import');
        return GLTFExporter;
      } catch (importError) {
        console.warn('Dynamic import failed, trying alternative method...', importError);
      }

      // Method 2: Try loading via script tag
      try {
        console.log('Attempting to load GLTFExporter via script tag...');
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.type = 'module';
          script.textContent = `
            import { GLTFExporter } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/exporters/GLTFExporter.js';
            window.GLTFExporter = GLTFExporter;
          `;
          script.onload = () => {
            setTimeout(() => {
              if ((window as any).GLTFExporter) {
                gltfExporterRef.current = (window as any).GLTFExporter;
                gltfExporterLoadingRef.current = false;
                console.log('GLTFExporter loaded successfully via script tag');
                resolve();
              } else {
                reject(new Error('GLTFExporter not found on window'));
              }
            }, 100);
          };
          script.onerror = () => reject(new Error('Script tag load failed'));
          document.head.appendChild(script);
        });
        if (gltfExporterRef.current) {
          return gltfExporterRef.current;
        } else {
          throw new Error('GLTFExporter was not properly set after script tag load');
        }
      } catch (scriptError) {
        console.warn('Script tag method failed, trying fetch method...', scriptError);
      }

      // Method 3: Use fetch and eval (last resort)
      try {
        console.log('Attempting to load GLTFExporter via fetch...');
        const response = await fetch('https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/exporters/GLTFExporter.js');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const code = await response.text();
        
        // Create a module context
        const module = { exports: {} };
        const exports = module.exports;
        
        // Execute the module code with proper context
        const func = new Function('THREE', 'exports', code);
        func(THREE, exports);
        
        if (exports && (exports as any).GLTFExporter) {
          gltfExporterRef.current = (exports as any).GLTFExporter;
          gltfExporterLoadingRef.current = false;
          console.log('GLTFExporter loaded successfully via fetch');
          return gltfExporterRef.current;
        } else {
          throw new Error('GLTFExporter not found in module exports');
        }
      } catch (fetchError) {
        const errorDetails = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        console.error('All GLTFExporter loading methods failed. Last error:', errorDetails);
        console.error('Attempted methods: 1) Dynamic import, 2) Script tag, 3) Fetch and eval');
        throw new Error(`Failed to load GLTFExporter: All three loading methods (dynamic import, script tag, fetch) have failed. Last error: ${errorDetails}. Please check your internet connection and try again.`);
      }
    } catch (error) {
      gltfExporterLoadingRef.current = false;
      throw error;
    }
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
      const exporter = new GLTFExporter();

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
        async (result: ArrayBuffer | string) => {
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
        (error: Error) => {
          console.error('Error exporting scene:', error);
          setIsLoading(false);
          toast.error(`Export failed: ${error.message || 'Unknown error'}`);
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
          camera.position.set(3, 2, 5);
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

          // Create simple orbit controls manually (since we can't easily load OrbitControls from CDN)
          let isDragging = false;
          let previousMousePosition = { x: 0, y: 0 };
          const canvas = renderer.domElement;

          const onMouseDown = (e: MouseEvent) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
          };

          const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            // Rotate camera around target
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(camera.position);
            spherical.theta -= deltaX * 0.01;
            spherical.phi += deltaY * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            camera.position.setFromSpherical(spherical);
            camera.lookAt(0, 0, 0);
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
          };

          const onMouseUp = () => {
            isDragging = false;
          };

          const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const scale = e.deltaY > 0 ? 1.1 : 0.9;
            camera.position.multiplyScalar(scale);
          };

          canvas.addEventListener('mousedown', onMouseDown);
          canvas.addEventListener('mousemove', onMouseMove);
          canvas.addEventListener('mouseup', onMouseUp);
          canvas.addEventListener('wheel', onWheel);

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

          // Create a simple controls object for compatibility
          const controlsObj = {
            target: initialTarget,
            update: () => {
              camera.lookAt(initialTarget);
            }
          };
          controlsRef.current = controlsObj;

          // Add grid helper
          const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
          scene.add(gridHelper);
          gridHelperRef.current = gridHelper;

          // Add axes helper
          const axesHelper = new THREE.AxesHelper(5);
          scene.add(axesHelper);
          axesHelperRef.current = axesHelper;

          sceneRef.current = scene;
          rendererRef.current = renderer;
          cameraRef.current = camera;

          // Animation loop - continuously render the scene
          let frameCount = 0;
          const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
              // Update camera controls if needed
              if (controlsRef.current && controlsRef.current.update) {
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
      
      const loader = new GLTFLoader();
      
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

      // Step 3: Center the model at origin by translating it
      // Move the model so its center is at (0, 0, 0)
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;

      // Step 4: Calculate scale to fit model nicely in view
      const maxDim = Math.max(size.x, size.y, size.z);
      let scaleFactor = 1;
      if (maxDim > 0) {
        const targetSize = 2.5; // Target size for the model (slightly larger for better visibility)
        scaleFactor = targetSize / maxDim;
        model.scale.setScalar(scaleFactor);
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
      
      const finalMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);

      console.log('Scaled model bounds:', {
        size: { x: scaledSize.x, y: scaledSize.y, z: scaledSize.z },
        center: { x: scaledCenter.x, y: scaledCenter.y, z: scaledCenter.z },
        maxDim: finalMaxDim
      });

      // Step 6: Position camera to view centered model
      // Calculate distance to fit model nicely in view (with padding)
      const distance = finalMaxDim > 0 ? finalMaxDim * 2.5 : 5;
      const angle = Math.PI / 4; // 45 degree angle for nice perspective
      const newPos = new THREE.Vector3(
        distance * Math.cos(angle),
        distance * 0.7, // Elevated view
        distance * Math.sin(angle)
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
      
      // Verify model is centered (should be very close to 0,0,0)
      const finalBox = new THREE.Box3().setFromObject(model);
      const finalCenter = new THREE.Vector3();
      finalBox.getCenter(finalCenter);
      
      console.log('✅ Model added to scene and centered');
      console.log('   Scene children count:', sceneRef.current.children.length);
      console.log('   Model position:', { x: model.position.x.toFixed(3), y: model.position.y.toFixed(3), z: model.position.z.toFixed(3) });
      console.log('   Model center:', { x: finalCenter.x.toFixed(3), y: finalCenter.y.toFixed(3), z: finalCenter.z.toFixed(3) });
      console.log('   Model scale:', { x: model.scale.x.toFixed(3), y: model.scale.y.toFixed(3), z: model.scale.z.toFixed(3) });
      console.log('   Camera position:', { x: newPos.x.toFixed(3), y: newPos.y.toFixed(3), z: newPos.z.toFixed(3) });
      console.log('   Camera looking at:', { x: lookAtTarget.x.toFixed(3), y: lookAtTarget.y.toFixed(3), z: lookAtTarget.z.toFixed(3) });
      console.log('   Final max dimension:', finalMaxDim.toFixed(3));
      console.log('   Camera distance:', distance.toFixed(3));
      
      // Ensure model center is at origin (double-check)
      if (Math.abs(finalCenter.x) > 0.01 || Math.abs(finalCenter.y) > 0.01 || Math.abs(finalCenter.z) > 0.01) {
        console.warn('⚠️ Model center is not at origin, adjusting...');
        model.position.x -= finalCenter.x;
        model.position.y -= finalCenter.y;
        model.position.z -= finalCenter.z;
        console.log('   Adjusted model position:', { x: model.position.x.toFixed(3), y: model.position.y.toFixed(3), z: model.position.z.toFixed(3) });
      }

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


  // Load GLB from URL prop
  useEffect(() => {
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
  }, [glbUrl, currentFile, currentFileType]);

  // Load Image from URL prop
  useEffect(() => {
    console.log('GLBViewer - imageUrl changed:', imageUrl);
    console.log('GLBViewer - currentFile:', currentFile);
    
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
    
    const loadImg = async () => {
      // Wait for Three.js to be ready (max 5 seconds)
      let attempts = 0;
      while ((!threeLoadedRef.current || !sceneRef.current) && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (!threeLoadedRef.current || !sceneRef.current) {
        console.error('GLBViewer - Three.js not initialized after waiting');
        toast.error('3D viewer not ready. Please refresh the page.');
        return;
      }
      
      if (imageUrl !== currentFile) {
        console.log('GLBViewer - Loading image:', imageUrl);
        setIsLoading(true);
        try {
          await loadImage(imageUrl);
          setIsLoading(false);
          setCurrentFile(imageUrl);
          setCurrentFileType('image');
          console.log('GLBViewer - Image loaded successfully');
        } catch (error: any) {
          setIsLoading(false);
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
          
          toast.error(errorMsg);
          console.error('Error loading image from prop:', error);
        }
      }
    };
    
    loadImg();
  }, [imageUrl]);

  // Toggle grid helper
  useEffect(() => {
    if (gridHelperRef.current && sceneRef.current) {
      const isInScene = sceneRef.current.children.includes(gridHelperRef.current);
      if (showGrid && !isInScene) {
        sceneRef.current.add(gridHelperRef.current);
      } else if (!showGrid && isInScene) {
        sceneRef.current.remove(gridHelperRef.current);
      }
    }
  }, [showGrid]);

  // Toggle axes helper
  useEffect(() => {
    if (axesHelperRef.current && sceneRef.current) {
      const isInScene = sceneRef.current.children.includes(axesHelperRef.current);
      if (showAxes && !isInScene) {
        sceneRef.current.add(axesHelperRef.current);
      } else if (!showAxes && isInScene) {
        sceneRef.current.remove(axesHelperRef.current);
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
      modelRef.current.traverse((node: any) => {
        if (node.isMesh && node.material) {
          try {
            if (Array.isArray(node.material)) {
              node.material.forEach((mat: any) => {
                if (mat) {
                  if (typeof mat.wireframe !== 'undefined') {
                    mat.wireframe = wireframe;
                    mat.needsUpdate = true;
                  }
                  // Also handle MeshStandardMaterial and other material types
                  if (mat.type && mat.type.includes('Material')) {
                    mat.wireframe = wireframe;
                    mat.needsUpdate = true;
                  }
                }
              });
            } else {
              if (node.material) {
                if (typeof node.material.wireframe !== 'undefined') {
                  node.material.wireframe = wireframe;
                  node.material.needsUpdate = true;
                }
                // Also handle MeshStandardMaterial and other material types
                if (node.material.type && node.material.type.includes('Material')) {
                  node.material.wireframe = wireframe;
                  node.material.needsUpdate = true;
                }
              }
            }
          } catch (error) {
            console.warn('Error updating wireframe:', error);
          }
        }
      });
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
      
      // If we have a saved initial position, use it (but always look at center)
      if (initialCameraPositionRef.current && initialCameraPositionRef.current.position) {
        cameraRef.current.position.copy(initialCameraPositionRef.current.position);
      } else {
        // Default reset position - good viewing angle
        const distance = 5;
        const angle = Math.PI / 4;
        cameraRef.current.position.set(
          distance * Math.cos(angle),
          distance * 0.7,
          distance * Math.sin(angle)
        );
      }
      
      // Always look at center (0, 0, 0) where models are centered
      cameraRef.current.lookAt(centerTarget);
      cameraRef.current.updateProjectionMatrix();
      
      // Update controls target to center
      if (controlsRef.current) {
        controlsRef.current.target = centerTarget.clone();
        if (controlsRef.current.update) {
          controlsRef.current.update();
        }
      }
      
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

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!canvasRef.current) {
      toast.error('Canvas not available');
      return;
    }

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (canvasRef.current.requestFullscreen) {
          canvasRef.current.requestFullscreen().catch((err: any) => {
            console.error('Error entering fullscreen:', err);
            toast.error('Failed to enter fullscreen mode');
          });
        } else if ((canvasRef.current as any).webkitRequestFullscreen) {
          (canvasRef.current as any).webkitRequestFullscreen();
        } else if ((canvasRef.current as any).mozRequestFullScreen) {
          (canvasRef.current as any).mozRequestFullScreen();
        } else if ((canvasRef.current as any).msRequestFullscreen) {
          (canvasRef.current as any).msRequestFullscreen();
        } else {
          toast.error('Fullscreen is not supported in this browser');
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err: any) => {
            console.error('Error exiting fullscreen:', err);
            toast.error('Failed to exit fullscreen mode');
          });
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      toast.error('Failed to toggle fullscreen');
    }
  };

  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-4">3D Model Viewer</h2>
        
        <div className="space-y-4">
          {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          )}

          {currentFile && (
            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-xs px-2 py-1 rounded ${
                  currentFileType === 'glb' 
                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400' 
                    : 'bg-green-500/20 text-green-700 dark:text-green-400'
                }`}>
                  {currentFileType === 'glb' ? '3D Model' : 'Image'}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {currentFile.split('/').pop()}
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
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-[400px] bg-muted rounded-lg overflow-hidden">
        <div 
          ref={canvasRef} 
          className="w-full h-full"
          style={{ 
            position: 'relative',
            minHeight: '400px',
            width: '100%',
            height: '100%',
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
        {!currentFile && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <p className="text-muted-foreground">No model loaded</p>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetCamera}
            className="gap-2"
            disabled={!currentFile}
          >
            <RotateCcw className="h-4 w-4" />
            Reset View
          </Button>
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
            onClick={toggleFullscreen}
            className="gap-2"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
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

        <div className="text-xs text-muted-foreground">
          <p>Controls: Left click + drag to rotate | Right click + drag to pan | Scroll to zoom</p>
          <p className="mt-1">Supported: GLB/GLTF 3D models and images (JPG, PNG, GIF, etc.)</p>
        </div>
      </div>
    </Card>
  );
});

GLBViewer.displayName = 'GLBViewer';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, useGLTF, Html } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Trash2, RotateCcw, Eye, EyeOff, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as THREE from 'three';

interface Model {
  id: string;
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible?: boolean;
  name?: string;
}

interface PaletteItem {
  id: string;
  name: string;
  url: string;
  thumb?: string;
  modelType?: string;
}

interface GLBCollarManagerProps {
  apiBase?: string;
}

// Model component using React Three Fiber
function Model({ 
  url, 
  id, 
  selected, 
  onSelect, 
  onChangeTransform, 
  visible = true,
  position,
  rotation,
  scale
}: {
  url: string;
  id: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onChangeTransform?: (id: string, transform: any) => void;
  visible?: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);

  useEffect(() => {
    if (scene) {
      scene.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  useFrame(() => {
    if (ref.current) {
      ref.current.visible = visible;
      if (position) {
        ref.current.position.set(...position);
      }
      if (rotation) {
        ref.current.rotation.set(...rotation);
      }
      if (scale) {
        ref.current.scale.set(...scale);
      }
    }
  });

  return (
    <group ref={ref}>
      <primitive
        object={scene}
        onClick={(e: any) => {
          e.stopPropagation();
          onSelect(id);
        }}
      />
      {selected && onChangeTransform && (
        <TransformControls
          ref={transformRef}
          object={ref.current}
          mode="translate"
          onObjectChange={(e) => {
            if (ref.current && onChangeTransform) {
              const pos = ref.current.position;
              const rot = ref.current.rotation;
              const scl = ref.current.scale;
              onChangeTransform(id, {
                position: [pos.x, pos.y, pos.z],
                rotation: [rot.x, rot.y, rot.z],
                scale: [scl.x, scl.y, scl.z],
              });
            }
          }}
        />
      )}
    </group>
  );
}

// Palette component for selecting and placing models
function Palette({ 
  items, 
  onPlace 
}: { 
  items: PaletteItem[]; 
  onPlace: (item: PaletteItem) => void;
}) {
  return (
    <Card className="p-4" style={{ position: 'absolute', right: 20, top: 20, maxWidth: 300, maxHeight: '80vh', overflow: 'auto' }}>
      <Label className="text-sm font-semibold mb-3 block">Model Palette</Label>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">No models in palette</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-2 border rounded-md hover:bg-muted">
              {it.thumb ? (
                <img src={it.thumb} alt={it.name} className="w-12 h-12 object-cover rounded" />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs">
                  GLB
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{it.name}</div>
                {it.modelType && (
                  <div className="text-xs text-muted-foreground truncate">{it.modelType}</div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPlace(it)}
                className="h-7 text-xs"
              >
                Place
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// Main GLB Collar Manager Component
export default function GLBCollarManager({ apiBase = '/api' }: GLBCollarManagerProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [palette, setPalette] = useState<PaletteItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  useEffect(() => {
    fetchState();
  }, []);

  async function fetchState() {
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      // Fetch models from backend
      const modelsResponse = await fetch(`${API_BASE_URL}${apiBase}/models/`);
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        setModels(Array.isArray(modelsData) ? modelsData : []);
      }

      // Fetch palette (available model types)
      const paletteResponse = await fetch(`${API_BASE_URL}${apiBase}/get-all-model-types/`);
      if (paletteResponse.ok) {
        const paletteData = await paletteResponse.json();
        if (paletteData.success && paletteData.model_types) {
          const paletteItems: PaletteItem[] = paletteData.model_types
            .filter((mt: any) => mt.has_model && mt.glb_url)
            .map((mt: any) => ({
              id: mt.model_type,
              name: mt.title || mt.model_type,
              url: mt.glb_url,
              thumb: mt.preview_url,
              modelType: mt.model_type,
            }));
          setPalette(paletteItems);
        }
      }
    } catch (error) {
      console.error('Error fetching state:', error);
      toast.error('Failed to load models and palette');
    } finally {
      setIsLoading(false);
    }
  }

  function onSelect(id: string) {
    setSelectedId(id);
  }

  async function saveTransform(id: string, transform: any) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      await fetch(`${API_BASE_URL}${apiBase}/models/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transform),
      });

      setModels((ms) => ms.map((m) => (m.id === id ? { ...m, ...transform } : m)));
    } catch (error) {
      console.error('Error saving transform:', error);
      toast.error('Failed to save transform');
    }
  }

  async function placePalette(item: PaletteItem) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      // Calculate position to avoid overlap
      const modelCount = models.length;
      const payload = {
        url: item.url,
        name: item.name,
        position: [modelCount * 2, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        visible: true,
      };

      const response = await fetch(`${API_BASE_URL}${apiBase}/models/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const newModel = await response.json();
        setModels((ms) => [...ms, newModel]);
        toast.success(`Placed ${item.name}`);
      } else {
        throw new Error('Failed to place model');
      }
    } catch (error) {
      console.error('Error placing model:', error);
      toast.error('Failed to place model');
    }
  }

  async function tempDelete(id: string) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      await fetch(`${API_BASE_URL}${apiBase}/models/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: false }),
      });

      setModels((ms) => ms.map((m) => (m.id === id ? { ...m, visible: false } : m)));
      if (selectedId === id) setSelectedId(null);
      toast.success('Model hidden');
    } catch (error) {
      console.error('Error hiding model:', error);
      toast.error('Failed to hide model');
    }
  }

  async function restore(id: string) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      await fetch(`${API_BASE_URL}${apiBase}/models/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: true }),
      });

      setModels((ms) => ms.map((m) => (m.id === id ? { ...m, visible: true } : m)));
      toast.success('Model restored');
    } catch (error) {
      console.error('Error restoring model:', error);
      toast.error('Failed to restore model');
    }
  }

  async function permDelete(id: string) {
    if (!window.confirm('Are you sure you want to permanently delete this model?')) {
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      await fetch(`${API_BASE_URL}${apiBase}/models/${id}/`, {
        method: 'DELETE',
      });

      setModels((ms) => ms.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success('Model deleted permanently');
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Failed to delete model');
    }
  }

  async function fixCollarsKeepOne(modelId: string) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`);

      const response = await fetch(`${API_BASE_URL}${apiBase}/models/${modelId}/sanitize/`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Collars sanitized - keeping one centered');
        fetchState(); // Refetch to get updated model
      } else {
        throw new Error('Sanitization failed');
      }
    } catch (error) {
      console.error('Error fixing collars:', error);
      toast.error('Failed to fix collars. Endpoint may not be implemented yet.');
    }
  }

  const selectedModel = models.find((m) => m.id === selectedId);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Canvas shadows camera={{ position: [0, 2, 6], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} castShadow />
        <gridHelper args={[10, 10]} />
        <axesHelper args={[5]} />

        <group>
          {models
            .filter((m) => m.visible !== false)
            .map((m) => (
              <Model
                key={m.id}
                id={m.id}
                url={m.url}
                visible={m.visible !== false}
                selected={selectedId === m.id}
                onSelect={onSelect}
                onChangeTransform={saveTransform}
                position={m.position}
                rotation={m.rotation}
                scale={m.scale}
              />
            ))}
        </group>

        <OrbitControls />
      </Canvas>

      {/* Control Panel */}
      <Card className="p-4" style={{ position: 'absolute', left: 20, top: 20, minWidth: 280 }}>
        <Label className="text-sm font-semibold mb-3 block">GLB Collar Manager</Label>
        
        <div className="space-y-2 mb-4">
          <div className="text-xs text-muted-foreground">
            <strong>Selected:</strong> {selectedId ? selectedModel?.name || selectedId : '—'}
          </div>
          
          {selectedId && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransformMode('translate')}
                  className={transformMode === 'translate' ? 'bg-primary text-primary-foreground' : ''}
                >
                  Move
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransformMode('rotate')}
                  className={transformMode === 'rotate' ? 'bg-primary text-primary-foreground' : ''}
                >
                  Rotate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransformMode('scale')}
                  className={transformMode === 'scale' ? 'bg-primary text-primary-foreground' : ''}
                >
                  Scale
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedId && tempDelete(selectedId)}
                  className="text-xs"
                >
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hide
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedId && restore(selectedId)}
                  className="text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => selectedId && permDelete(selectedId)}
                  className="text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedId && fixCollarsKeepOne(selectedId)}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Fix Collars
                </Button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">
              Models: {models.filter(m => m.visible !== false).length} visible / {models.length} total
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchState}
              className="w-full text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Palette */}
      <Palette items={palette} onPlace={placePalette} />

      {isLoading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="text-center p-4 bg-background/90 rounded-lg">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">Loading models...</div>
          </div>
        </div>
      )}
    </div>
  );
}


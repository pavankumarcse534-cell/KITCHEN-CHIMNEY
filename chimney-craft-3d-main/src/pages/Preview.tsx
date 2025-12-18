import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GLBViewer } from "@/components/GLBViewer";
import { Loader2, Grid3x3, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ModelType {
  model_type: string;
  title: string;
  preview_url?: string;
  glb_url?: string;
  all_glb_urls?: string[];
  glb_files?: Array<{
    id: number;
    url: string;
    file_path: string;
    file_name: string;
    file_type: string;
    is_primary: boolean;
    order: number;
  }>;
  has_model?: boolean;
  has_preview?: boolean;
}

const Preview = () => {
  const navigate = useNavigate();
  const [modelTypes, setModelTypes] = useState<ModelType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelType | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'viewer'>('grid');
  const [allGlbUrls, setAllGlbUrls] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllModels = async () => {
      try {
        setIsLoading(true);
        const API_BASE_URL = import.meta.env.VITE_API_URL || 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:8000' 
            : `http://${window.location.hostname}:8000`);
        
        const url = `${API_BASE_URL}/api/get-all-model-types/`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-cache',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.model_types && Array.isArray(data.model_types)) {
          // Remove duplicates and filter only models that have GLB files
          const uniqueModelTypes = new Map<string, ModelType>();
          
          data.model_types.forEach((mt: ModelType) => {
            // Filter out unwanted model types
            const excludedTypes = ['wmss_single_skin_1_sec', 'one_collar_hole_single_skin', 'one_collar_single_skin'];
            if (excludedTypes.includes(mt.model_type)) {
              return; // Skip these model types
            }
            
            // Only include valid model types with GLB files
            if (mt.model_type && 
                mt.model_type.trim() !== '' && 
                mt.title &&
                mt.has_model && 
                (mt.glb_url || (mt.all_glb_urls && mt.all_glb_urls.length > 0))) {
              // Use model_type as key to prevent duplicates
              if (!uniqueModelTypes.has(mt.model_type)) {
                uniqueModelTypes.set(mt.model_type, mt);
              } else {
                // If duplicate found, keep the one with more GLB files
                const existing = uniqueModelTypes.get(mt.model_type)!;
                const existingGlbCount = existing.all_glb_urls?.length || (existing.glb_url ? 1 : 0);
                const newGlbCount = mt.all_glb_urls?.length || (mt.glb_url ? 1 : 0);
                if (newGlbCount > existingGlbCount) {
                  uniqueModelTypes.set(mt.model_type, mt);
                }
              }
            }
          });
          
          // Convert map to array and sort by title
          const modelsWithGlb = Array.from(uniqueModelTypes.values()).sort((a, b) => 
            a.title.localeCompare(b.title)
          );
          
          setModelTypes(modelsWithGlb);
          
          // Collect all GLB URLs from all model types for single preview
          const glbUrls: string[] = [];
          modelsWithGlb.forEach((mt: ModelType) => {
            // Use all_glb_urls if available (includes all GLB files from DesignGLBFile)
            if (mt.all_glb_urls && mt.all_glb_urls.length > 0) {
              glbUrls.push(...mt.all_glb_urls);
            } 
            // Fallback to primary glb_url if all_glb_urls is not available
            else if (mt.glb_url) {
              glbUrls.push(mt.glb_url);
            }
          });
          
          // Remove duplicates
          const uniqueGlbUrls = Array.from(new Set(glbUrls));
          setAllGlbUrls(uniqueGlbUrls);
          
          console.log(`✅ Loaded ${modelsWithGlb.length} models with GLB files`);
          console.log(`✅ Collected ${uniqueGlbUrls.length} unique GLB URLs for preview:`, uniqueGlbUrls);
          toast.success(`Loaded ${modelsWithGlb.length} 3D models with ${uniqueGlbUrls.length} GLB files`);
        } else {
          console.warn('Invalid response format:', data);
          setModelTypes([]);
        }
      } catch (error: any) {
        console.error('Error fetching models:', error);
        toast.error(`Failed to load models: ${error.message}`);
        setModelTypes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllModels();
  }, []);

  const handleModelClick = (model: ModelType) => {
    setSelectedModel(model);
    setViewMode('viewer');
    // Log all GLB files for this model
    if (model.all_glb_urls && model.all_glb_urls.length > 0) {
      console.log(`📦 Model "${model.title}" has ${model.all_glb_urls.length} GLB files:`, model.all_glb_urls);
    } else if (model.glb_url) {
      console.log(`📦 Model "${model.title}" has 1 GLB file:`, model.glb_url);
    }
  };

  const handleViewAll = () => {
    if (allGlbUrls.length === 0) {
      toast.error('No GLB files available to preview');
      return;
    }
    console.log('Viewing all models:', allGlbUrls.length, 'GLB URLs');
    setSelectedModel(null);
    setViewMode('viewer');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedModel(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading 3D models...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'viewer') {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-card border-b border-border p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToGrid}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Back to Grid
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedModel ? selectedModel.title : 'All 3D Models Preview'}
                </h1>
                {selectedModel && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedModel.all_glb_urls && selectedModel.all_glb_urls.length > 0
                      ? `Displaying ${selectedModel.all_glb_urls.length} GLB file(s)`
                      : selectedModel.glb_url
                      ? 'Displaying 1 GLB file'
                      : 'No GLB files'}
                  </p>
                )}
                {!selectedModel && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Displaying {allGlbUrls.length} GLB file(s) from all models
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
            >
              Go to Main Page
            </Button>
          </div>
        </div>

        <div className="h-[calc(100vh-80px)]">
          <GLBViewer
            key={selectedModel ? `single-${selectedModel.model_type}-${selectedModel.all_glb_urls?.length || 1}` : `all-${allGlbUrls.length}`}
            glbUrl={selectedModel && !selectedModel.all_glb_urls ? selectedModel.glb_url : undefined}
            glbUrls={
              selectedModel 
                ? (selectedModel.all_glb_urls && selectedModel.all_glb_urls.length > 0 
                    ? selectedModel.all_glb_urls 
                    : selectedModel.glb_url ? [selectedModel.glb_url] : undefined)
                : (allGlbUrls.length > 0 ? allGlbUrls : undefined)
            }
            glbFileNames={
              selectedModel && selectedModel.glb_files && selectedModel.glb_files.length > 0
                ? selectedModel.glb_files.map(file => file.file_name || file.url.split('/').pop() || '')
                : selectedModel && selectedModel.all_glb_urls && selectedModel.all_glb_urls.length > 0
                ? selectedModel.all_glb_urls.map(url => url.split('/').pop() || '')
                : undefined
            }
            modelType={selectedModel?.model_type}
            modelTypes={modelTypes}
            onModelTypeSelect={(modelType) => {
              const model = modelTypes.find(m => m.model_type === modelType);
              if (model) {
                setSelectedModel(model);
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">3D Models Preview Gallery</h1>
              <p className="text-sm text-muted-foreground mt-1">
                All {modelTypes.length} GLB models in one place
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleViewAll}
                className="gap-2"
                disabled={allGlbUrls.length === 0}
              >
                <Grid3x3 className="h-4 w-4" />
                View All in 3D
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
              >
                Go to Main Page
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {modelTypes.length === 0 ? (
          <div className="text-center py-16">
            <Grid3x3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">No 3D Models Found</h2>
            <p className="text-muted-foreground">
              Upload GLB files via the backend admin to see them here.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-muted-foreground">
                Click on any model card to view it in the 3D viewer, or click "View All in 3D" to see all models together.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {modelTypes.map((model) => (
                <Card
                  key={model.model_type}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 group"
                  onClick={() => handleModelClick(model)}
                >
                  <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                    {model.preview_url ? (
                      <img
                        src={model.preview_url}
                        alt={model.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <Grid3x3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">No Preview</p>
                        </div>
                      </div>
                    )}
                    {model.has_model && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        GLB
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">
                      {model.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {model.has_model && (
                        <span className="flex items-center gap-1">
                          <Grid3x3 className="h-3 w-3" />
                          {model.all_glb_urls && model.all_glb_urls.length > 0
                            ? `${model.all_glb_urls.length} GLB file(s)`
                            : '3D Model'}
                        </span>
                      )}
                      {model.has_preview && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Preview
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Total: {modelTypes.length} models with GLB files</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Preview;


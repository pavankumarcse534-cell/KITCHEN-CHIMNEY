import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ProjectForm } from "@/components/ProjectForm";
import { ItemTable } from "@/components/ItemTable";
import { GLBViewer } from "@/components/GLBViewer";
import AutodeskViewer from "@/components/AutodeskViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, FileDown, Download, Loader2, FileSpreadsheet, FileType } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const Index = () => {
  const [searchParams] = useSearchParams();
  const initialModelType = searchParams.get('modelType') || '';

  const [projectData, setProjectData] = useState({
    projectName: '',
    clientName: '',
    customerCode: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    drawingType: '',
    sheetType: '',
    modelType: initialModelType,
    dimSection1: '',
    dimSection2: '',
    dimSection3: '',
    dimSection4: '',
    dimSection5: '',
    length: '',
    width: '',
    height: '',
  });

  const [items, setItems] = useState<any[]>([]);
  const [glbFileUrl, setGlbFileUrl] = useState<string>('');
  const [glbFileUrls, setGlbFileUrls] = useState<string[]>([]); // Multiple GLB URLs
  const [glbFileName, setGlbFileName] = useState<string>('');
  const [glbFileNames, setGlbFileNames] = useState<string[]>([]); // Multiple GLB file names
  const [imageFileUrl, setImageFileUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [modelImages, setModelImages] = useState<any[]>([]);
  const [modelTypes, setModelTypes] = useState<any[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const glbViewerRef = useRef<{ exportToGLB: () => void } | null>(null);

  const handleSave = () => {
    if (!projectData.projectName || !projectData.clientName) {
      toast.error("Please fill in required project information");
      return;
    }

    const projectExport = {
      ...projectData,
      items,
      totalItems: items.length,
      modelImages,
      modelImagesCount: modelImages.length,
      savedAt: new Date().toISOString(),
    };

    console.log("Project Data:", projectExport);
    toast.success("Project saved successfully!");
  };

  const handleExport = () => {
    const projectExport = {
      ...projectData,
      items,
      totalItems: items.length,
      modelImages,
      modelImagesCount: modelImages.length,
    };

    const dataStr = JSON.stringify(projectExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectData.projectName || 'chimney-project'}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Project exported successfully!");
  };

  const handleExportExcel = () => {
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Project Information
      const projectDataArray = [
        ['Project Information'],
        ['Project Name', projectData.projectName || ''],
        ['Client Name', projectData.clientName || ''],
        ['Customer Code', projectData.customerCode || ''],
        ['Date', projectData.date || ''],
        ['Location', projectData.location || ''],
        ['Drawing Type', projectData.drawingType || ''],
        ['Sheet Type', projectData.sheetType || ''],
        ['Model Type', projectData.modelType || ''],
        [''],
        ['Dimensions'],
        ['Section 1', projectData.dimSection1 || ''],
        ['Section 2', projectData.dimSection2 || ''],
        ['Section 3', projectData.dimSection3 || ''],
        ['Section 4', projectData.dimSection4 || ''],
        ['Section 5', projectData.dimSection5 || ''],
        [''],
        ['3D Model Information'],
        ['GLB File', glbFileName || 'Not uploaded'],
        ['Image File', imageFileName || 'Not uploaded'],
        ['Total Items', items.length],
        ['Model Images Count', modelImages.length],
      ];

      const projectSheet = XLSX.utils.aoa_to_sheet(projectDataArray);
      XLSX.utils.book_append_sheet(workbook, projectSheet, 'Project Info');

      // Sheet 2: Items List
      if (items.length > 0) {
        const itemsData = items.map((item, index) => ({
          'No': index + 1,
          'Item Name': item.name || '',
          'Quantity': item.quantity || 0,
          'Unit': item.unit || '',
          'Description': item.description || '',
          'Notes': item.notes || '',
        }));

        const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
      } else {
        // Empty items sheet
        const emptyItemsSheet = XLSX.utils.aoa_to_sheet([['No', 'Item Name', 'Quantity', 'Unit', 'Description', 'Notes']]);
        XLSX.utils.book_append_sheet(workbook, emptyItemsSheet, 'Items');
      }

      // Sheet 3: Summary
      const summaryData = [
        ['Summary'],
        ['Total Items', items.length],
        ['Model Type', projectData.modelType || 'N/A'],
        ['Drawing Type', projectData.drawingType || 'N/A'],
        ['Export Date', new Date().toLocaleString()],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${projectData.projectName || 'chimney-project'}-${Date.now()}.xlsx`;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Excel file exported successfully!");
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error("Failed to export Excel file. Please try again.");
    }
  };

  const handleExportDWG = async () => {
    if (!projectData.modelType || (!glbFileUrl && !imageFileUrl)) {
      toast.error('Please select a model type and ensure a 3D model is loaded');
      return;
    }

    try {
      // For DWG export, we'll export the GLB file first
      // The user can convert GLB to DWG using external tools or backend conversion
      if (glbFileUrl) {
        // Download the GLB file
        const response = await fetch(glbFileUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch GLB file');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Change extension to .dwg (user can convert later, or we can add backend conversion)
        const filename = `${projectData.modelType.replace(/_/g, '-')}-${Date.now()}.glb`;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        toast.success("GLB file exported! Note: Convert to DWG using CAD software or backend conversion.");

        // Optionally, try to convert via backend if endpoint exists
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL ||
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://localhost:8000'
              : `http://${window.location.hostname}:8000`);

          // Try to convert GLB to DWG via backend
          const convertResponse = await fetch(`${API_BASE_URL}/api/convert-glb-to-dwg/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              glb_url: glbFileUrl,
              model_type: projectData.modelType,
            }),
          });

          if (convertResponse.ok) {
            const dwgBlob = await convertResponse.blob();
            const dwgUrl = URL.createObjectURL(dwgBlob);
            const dwgLink = document.createElement('a');
            dwgLink.href = dwgUrl;
            dwgLink.download = `${projectData.modelType.replace(/_/g, '-')}-${Date.now()}.dwg`;
            dwgLink.click();
            URL.revokeObjectURL(dwgUrl);
            toast.success("DWG file exported successfully!");
          }
        } catch (convertError) {
          // Backend conversion not available, GLB already downloaded
          console.log('Backend DWG conversion not available, GLB file downloaded instead');
        }
      } else {
        toast.error('No GLB file available to export. Please load a 3D model first.');
      }
    } catch (error) {
      console.error('Error exporting DWG:', error);
      toast.error("Failed to export DWG file. Please try again.");
    }
  };

  const handleMultipleFilesUploaded = (files: Array<{ url: string; filename: string; thumbnailUrl?: string | null }>) => {
    console.log('Multiple files uploaded:', files);
    const urls = files.map(f => f.url);
    const names = files.map(f => f.filename);
    setGlbFileUrls(urls);
    setGlbFileNames(names);
    // Also set first file for backward compatibility
    if (urls.length > 0) {
      setGlbFileUrl(urls[0]);
      setGlbFileName(names[0]);
    }
    // Clear image data when GLB files are uploaded
    setImageFileUrl('');
    setImageFileName('');
    toast.success(`Successfully uploaded ${files.length} GLB file(s)`);
  };

  const handleImageUploaded = (url: string, filename: string) => {
    console.log('Preview image uploaded:', url, filename);
    setImageFileUrl(url);
    setImageFileName(filename);
    // Clear GLB data when image is uploaded
    setGlbFileUrl('');
    setGlbFileUrls([]);
    setGlbFileName('');
    setGlbFileNames([]);

    // Refresh model types to show updated preview
    const refreshModelTypes = async () => {
      try {
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

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.model_types) {
            setModelTypes(data.model_types);
            console.log('✅ Model types refreshed after preview upload');
          }
        }
      } catch (error) {
        console.warn('Failed to refresh model types:', error);
      }
    };

    // Refresh after a short delay to ensure backend has processed the upload
    setTimeout(() => {
      refreshModelTypes();
    }, 1000);

    toast.success('Preview image uploaded successfully! Refreshing gallery...');
  };

  const handleFileDeleted = () => {
    console.log('File deleted');
    // Clear all file data
    setGlbFileUrl('');
    setGlbFileName('');
    setImageFileUrl('');
    setImageFileName('');
    toast.success('3D model file deleted successfully');
  };

  // Handle GLB export and upload to backend
  const handleGlbExported = async (glbBlob: Blob, filename: string) => {
    if (!projectData.modelType) {
      toast.error('Please select a model type before exporting');
      return;
    }

    try {
      // Get API URL from env or default to localhost
      // In network scenarios, ensure backend is accessible from the same network
      const API_BASE_URL = import.meta.env.VITE_API_URL ||
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:8000'
          : `http://${window.location.hostname}:8000`);
      const url = `${API_BASE_URL}/api/upload-glb/`;

      console.log('Uploading exported GLB to backend...');
      console.log('Model Type:', projectData.modelType);
      console.log('Filename:', filename);

      // Create FormData
      const formData = new FormData();
      formData.append('file', glbBlob, filename);
      formData.append('model_type', projectData.modelType);

      // Create AbortController for timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 60000); // 60 second timeout for large file uploads

      try {
        // Upload to backend
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            // Try to parse as JSON for better error messages
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error) {
                errorText = errorJson.error;
              }
            } catch {
              // Not JSON, use text as is
            }
          } catch {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }

          if (response.status === 400) {
            throw new Error(`Invalid request: ${errorText}`);
          } else if (response.status === 413) {
            throw new Error('File too large. Maximum size is 500MB.');
          } else if (response.status >= 500) {
            throw new Error(`Server error (${response.status}): ${errorText || 'Please check backend logs.'}`);
          } else {
            throw new Error(`Upload failed (${response.status}): ${errorText}`);
          }
        }

        const data = await response.json();
        console.log('GLB uploaded successfully:', data);

        if (data.success && data.glb_file_url) {
          // URLs from backend should already be absolute, but validate
          let glbUrl = data.glb_file_url.trim();
          if (!glbUrl.startsWith('http://') && !glbUrl.startsWith('https://')) {
            // Fallback: construct absolute URL if backend didn't provide one
            glbUrl = glbUrl.startsWith('/')
              ? `${API_BASE_URL}${glbUrl}`
              : `${API_BASE_URL}/${glbUrl}`;
          }

          // Validate URL format
          try {
            new URL(glbUrl);
            setGlbFileUrl('');
            setTimeout(() => {
              setGlbFileUrl(glbUrl);
              setGlbFileName(data.design_title || filename);
              setImageFileUrl('');
              setImageFileName('');
            }, 150);

            toast.success(`Exported GLB uploaded successfully for ${projectData.modelType}!`);
          } catch (urlError) {
            console.error('Invalid GLB URL from backend:', glbUrl);
            toast.error('Upload succeeded but received invalid URL from backend.');
          }
        } else {
          toast.error('Upload succeeded but no URL returned from backend.');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Error uploading exported GLB:', error);
      let errorMsg = 'Failed to upload exported GLB to backend.';

      if (error.name === 'AbortError') {
        errorMsg = 'Upload timeout: File upload took too long. Please try again or use a smaller file.';
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        const apiUrl = import.meta.env.VITE_API_URL ||
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8000'
            : `http://${window.location.hostname}:8000`);
        errorMsg = `Network error: Cannot connect to backend at ${apiUrl}. Please ensure backend server is running and CORS is configured.`;
      } else if (error.message?.includes('CORS') || error.message?.includes('Cross-Origin')) {
        errorMsg = 'CORS error: Backend may not allow requests from this origin. Please check CORS settings.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      toast.error(errorMsg);
    }
  };

  // Check backend health before fetching model types
  const checkBackendHealth = async (API_BASE_URL: string): Promise<boolean> => {
    try {
      const healthUrl = `${API_BASE_URL}/api/health/`;
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: abortController.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  };

  // Fetch all model types on component mount
  useEffect(() => {
    const fetchModelTypes = async (retryCount = 0) => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL ||
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8000'
            : `http://${window.location.hostname}:8000`);

        // Check backend health first
        if (retryCount === 0) {
          console.log('Checking backend health...');
          const isHealthy = await checkBackendHealth(API_BASE_URL);
          if (!isHealthy && retryCount === 0) {
            console.warn('Backend health check failed, will retry...');
            toast.info('Connecting to backend server...', { duration: 2000 });
          }
        }

        const url = `${API_BASE_URL}/api/get-all-model-types/`;

        console.log('Fetching model types from:', url);

        // Create AbortController for timeout handling
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, 20000); // 20 second timeout for model types (17 types might take time)

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          cache: 'no-cache',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Model types response:', data);

        if (data.success && data.model_types && Array.isArray(data.model_types)) {
          // Remove duplicates and invalid model types
          const uniqueModelTypes = new Map<string, any>();

          data.model_types.forEach((modelType: any) => {
            // Only include model types with valid model_type and title
            if (modelType.model_type && modelType.model_type.trim() !== '' && modelType.title) {
              // Filter out unwanted model types
              const excludedTypes = ['wmss_single_skin_1_sec', 'one_collar_hole_single_skin', 'one_collar_single_skin'];
              if (excludedTypes.includes(modelType.model_type)) {
                return; // Skip these model types
              }

              // Use model_type as key to prevent duplicates
              if (!uniqueModelTypes.has(modelType.model_type)) {
                uniqueModelTypes.set(modelType.model_type, modelType);
              } else {
                // If duplicate found, keep the one with more data (has_model or has_preview)
                const existing = uniqueModelTypes.get(modelType.model_type);
                if ((modelType.has_model || modelType.has_preview) && !(existing.has_model || existing.has_preview)) {
                  uniqueModelTypes.set(modelType.model_type, modelType);
                }
              }
            }
          });

          // Convert map to array and sort by title (alphabetically)
          const sortedModelTypes = Array.from(uniqueModelTypes.values()).sort((a: any, b: any) =>
            a.title.localeCompare(b.title)
          );

          setModelTypes(sortedModelTypes);
          console.log(`✅ Loaded ${sortedModelTypes.length} unique model types (filtered from ${data.model_types.length} total)`);
          console.log(`📋 Model types list:`, sortedModelTypes.map((t: any) => t.title));

          // Log preview status for debugging
          const withPreviews = sortedModelTypes.filter((t: any) => t.preview_url).length;
          const withModels = sortedModelTypes.filter((t: any) => t.has_model || t.glb_url).length;
          console.log(`✅ Model types with previews: ${withPreviews}/${sortedModelTypes.length}`);
          console.log(`✅ Model types with GLB files: ${withModels}/${sortedModelTypes.length}`);

          if (retryCount > 0) {
            toast.success(`Successfully loaded ${sortedModelTypes.length} model types`, { duration: 3000 });
          }
        } else {
          console.warn('Invalid response format:', data);
          setModelTypes([]);
        }
      } catch (error: any) {
        console.error('Error fetching model types:', error);

        // Retry logic for network errors with exponential backoff
        const isNetworkError = error.message?.includes('Failed to fetch') ||
          error.message?.includes('NetworkError') ||
          error.message?.includes('ERR_CONNECTION_REFUSED') ||
          error.message?.includes('ERR_NETWORK') ||
          error.name === 'AbortError';

        if (isNetworkError && retryCount < 5) {
          const retryDelay = Math.min((retryCount + 1) * 2000, 10000); // Max 10 seconds
          console.log(`Retrying connection to backend (attempt ${retryCount + 1}/5) in ${retryDelay}ms...`);
          toast.info(`Backend not responding. Retrying... (${retryCount + 1}/5)`, { duration: 3000 });
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return fetchModelTypes(retryCount + 1);
        }

        setModelTypes([]);

        // Show helpful error message after all retries failed
        if (isNetworkError) {
          const API_BASE_URL = import.meta.env.VITE_API_URL ||
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://localhost:8000'
              : `http://${window.location.hostname}:8000`);

          toast.error(
            'Cannot connect to backend server',
            {
              duration: 10000,
              description: `Backend server at ${API_BASE_URL} is not responding.\n\nPlease ensure:\n1. Backend server is running\n2. Port 8000 is not blocked\n3. Server is accessible`,
              action: {
                label: 'Check Backend',
                onClick: () => {
                  window.open(`${API_BASE_URL}/api/health/`, '_blank');
                }
              }
            }
          );
        } else if (error.name === 'AbortError') {
          toast.error('Request timeout: Backend server is taking too long to respond', { duration: 8000 });
        } else {
          toast.error(`Failed to load model types: ${error.message || 'Unknown error'}`, { duration: 5000 });
        }
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchModelTypes();
  }, []);

  // Function to refresh model types (can be called manually)
  const refreshModelTypes = async () => {
    try {
      setIsLoadingTypes(true);
      const API_BASE_URL = import.meta.env.VITE_API_URL ||
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:8000'
          : `http://${window.location.hostname}:8000`);

      const url = `${API_BASE_URL}/api/get-all-model-types/`;

      console.log('Refreshing model types from:', url);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 20000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.model_types && Array.isArray(data.model_types)) {
        // Remove duplicates and invalid model types (same logic as fetchModelTypes)
        const uniqueModelTypes = new Map<string, any>();

        data.model_types.forEach((modelType: any) => {
          if (modelType.model_type && modelType.model_type.trim() !== '' && modelType.title) {
            if (!uniqueModelTypes.has(modelType.model_type)) {
              uniqueModelTypes.set(modelType.model_type, modelType);
            } else {
              const existing = uniqueModelTypes.get(modelType.model_type);
              if ((modelType.has_model || modelType.has_preview) && !(existing.has_model || existing.has_preview)) {
                uniqueModelTypes.set(modelType.model_type, modelType);
              }
            }
          }
        });

        const sortedModelTypes = Array.from(uniqueModelTypes.values()).sort((a: any, b: any) =>
          a.title.localeCompare(b.title)
        );

        setModelTypes(sortedModelTypes);
        console.log(`✅ Refreshed ${sortedModelTypes.length} unique model types (filtered from ${data.model_types.length} total)`);
        console.log(`📋 Refreshed model types list:`, sortedModelTypes.map((t: any) => t.title));

        toast.success(`Model types refreshed successfully (${sortedModelTypes.length} types)`);
      } else {
        console.warn('Invalid response format:', data);
        setModelTypes([]);
        toast.error('Failed to refresh model types');
      }
    } catch (error: any) {
      console.error('Error refreshing model types:', error);
      toast.error(`Failed to refresh: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  // Update modelType when URL parameter changes
  useEffect(() => {
    const modelTypeFromUrl = searchParams.get('modelType');
    if (modelTypeFromUrl && modelTypeFromUrl !== projectData.modelType) {
      setProjectData(prev => ({ ...prev, modelType: modelTypeFromUrl }));
    }
  }, [searchParams, projectData.modelType]);

  // Handle model type selection
  const handleModelTypeClick = (modelType: string) => {
    // Clear current GLB/image URLs immediately
    setGlbFileUrl('');
    setImageFileUrl('');
    setGlbFileName('');
    setImageFileName('');

    // Set the selected model type
    // The useEffect for fetchModelByType will automatically load the GLB file
    setProjectData(prev => ({ ...prev, modelType: modelType }));

    toast.info(`Loading 3D model: ${modelType}`);
  };

  // Fetch GLB/image by model type when model type changes

  // Fetch GLB/image by model type when model type changes
  useEffect(() => {
    const fetchModelByType = async (retryCount = 0) => {
      if (!projectData.modelType) {
        // Clear URLs if no model type selected
        setGlbFileUrl('');
        setImageFileUrl('');
        setGlbFileName('');
        setImageFileName('');
        return;
      }

      try {
        // Get API URL from env or default based on current hostname
        // This allows network access when accessing from other devices
        const API_BASE_URL = import.meta.env.VITE_API_URL ||
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8000'
            : `http://${window.location.hostname}:8000`);


        const url = `${API_BASE_URL}/api/get-model-by-type/?model_type=${encodeURIComponent(projectData.modelType)}`;

        console.log('Fetching model for type:', projectData.modelType);
        console.log('API URL:', url);
        console.log('Retry attempt:', retryCount);


        // Special logging for WMCH COMPENSATING MAIN ASSEMBLY models
        const isWmchAssembly = projectData.modelType === 'wmch_compensating_main_assembly_5_sec' ||
          projectData.modelType === 'wmch_compensating_main_assembly_2_sec';
        if (isWmchAssembly) {
          console.log(`🔄 Loading WMCH COMPENSATING MAIN ASSEMBLY preview for ${projectData.modelType}...`);
          console.log('🔄 API URL:', url);
        }

        // Special logging for combined model types
        const isCombinedType = projectData.modelType === 'wmss_single_skin_1_sec_and_one_collar_hole_single_skin';
        if (isCombinedType) {
          console.log(`🔄 Loading COMBINED model type: ${projectData.modelType}...`);
          console.log('🔄 Title: WMSS SINGLE SKIN 1 SEC && ONE COLLAR HOLE SINGLE SKIN');
          console.log('🔄 This will fetch files from WMSS SINGLE SKIN 1 SEC component and files directly uploaded to the combined design');
          console.log('🔄 API URL:', url);
        }

        // Create AbortController for timeout handling (better browser compatibility)
        // Use longer timeout for WMCH assembly models as they may have larger files
        const timeoutDuration = isWmchAssembly ? 40000 : 25000; // 40 seconds for WMCH assemblies

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, timeoutDuration);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          // Add cache control to prevent stale data
          cache: 'no-cache',
        });

        // Clear timeout if request completes successfully
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Model data received:', data);
        console.log('Has GLB URL:', !!data.glb_url);
        console.log('Has image URL:', !!data.image_url);
        console.log('Message:', data.message);

        // Special logging for combined model types
        if (isCombinedType) {
          console.log(`🔄 COMBINED TYPE - Full response data for ${projectData.modelType}:`, JSON.stringify(data, null, 2));
          console.log(`🔄 COMBINED TYPE - GLB Files Count:`, data.glb_files_count || 0);
          console.log(`🔄 COMBINED TYPE - GLB Files:`, data.glb_files);
          console.log(`🔄 COMBINED TYPE - Is Combined:`, data.is_combined);
          console.log(`🔄 COMBINED TYPE - Component Types:`, data.component_types);
        }

        // Special logging for WMCH COMPENSATING MAIN ASSEMBLY models (reuse existing variable)
        if (isWmchAssembly) {
          console.log(`🔄 WMCH ASSEMBLY - Full response data for ${projectData.modelType}:`, JSON.stringify(data, null, 2));
          console.log(`🔄 WMCH ASSEMBLY - GLB URL:`, data.glb_url);
          console.log(`🔄 WMCH ASSEMBLY - Image URL:`, data.image_url);
          console.log(`🔄 WMCH ASSEMBLY - Success:`, data.success);
        }

        // Check if we have GLB files (multiple or single) or image URL
        if (data.success && (data.glb_url || data.glb_files || data.image_url)) {
          // Prioritize GLB over image
          // Check for multiple GLB files first
          if (data.glb_files && Array.isArray(data.glb_files) && data.glb_files.length > 0) {
            // Handle multiple GLB files
            const glbUrls: string[] = [];
            const glbNames: string[] = [];

            for (const file of data.glb_files) {
              if (file.url) {
                let glbUrl = file.url.trim();
                const fileName = file.file_name || file.url.split('/').pop() || 'model.glb';

                // Filter out unwanted file: WMSS Single Skin 1 sec (1).glb
                const fileNameLower = fileName.toLowerCase();
                const urlLower = glbUrl.toLowerCase();
                if (fileNameLower.includes('wmss') &&
                  fileNameLower.includes('single') &&
                  fileNameLower.includes('skin') &&
                  fileNameLower.includes('1') &&
                  fileNameLower.includes('sec') &&
                  fileNameLower.includes('(1)')) {
                  console.log(`🚫 Filtered out unwanted file: ${fileName}`);
                  continue; // Skip this file
                }
                // Also check URL encoded version
                if (urlLower.includes('wmss%20single%20skin%201%20sec%20(1)') ||
                  urlLower.includes('wmss single skin 1 sec (1)')) {
                  console.log(`🚫 Filtered out unwanted file from URL: ${glbUrl}`);
                  continue; // Skip this file
                }

                // Make absolute URL if needed
                if (!glbUrl.startsWith('http://') && !glbUrl.startsWith('https://')) {
                  if (glbUrl.startsWith('/')) {
                    glbUrl = `${API_BASE_URL}${glbUrl}`;
                  } else {
                    glbUrl = `${API_BASE_URL}/${glbUrl}`;
                  }
                }

                try {
                  new URL(glbUrl); // Validate URL
                  glbUrls.push(glbUrl);
                  glbNames.push(fileName);
                } catch (e) {
                  console.warn('Invalid GLB URL:', glbUrl);
                }
              }
            }

            if (glbUrls.length > 0) {
              console.log(`✅ Setting ${glbUrls.length} GLB URLs for preview`);
              setImageFileUrl('');
              setImageFileName('');
              setGlbFileUrl('');
              setGlbFileName('');

              setTimeout(() => {
                setGlbFileUrls(glbUrls);
                setGlbFileNames(glbNames);
                // Also set first file for backward compatibility
                setGlbFileUrl(glbUrls[0]);
                setGlbFileName(glbNames[0]);
                console.log('✅ Multiple GLB files loaded:', glbUrls.length);
              }, 100);
            }
          } else if (data.glb_url) {
            // Handle single GLB URL (backward compatibility)
            // Verify URL is absolute and valid
            let glbUrl = data.glb_url.trim();

            // Backend should return absolute URLs, but handle relative URLs as fallback
            if (!glbUrl.startsWith('http://') && !glbUrl.startsWith('https://')) {
              // Make absolute URL
              if (glbUrl.startsWith('/')) {
                glbUrl = `${API_BASE_URL}${glbUrl}`;
              } else {
                glbUrl = `${API_BASE_URL}/${glbUrl}`;
              }
            }

            // Verify URL is valid
            try {
              new URL(glbUrl); // This will throw if URL is invalid
              console.log('✅ Setting GLB URL for preview:', glbUrl);
              console.log('✅ Model Type:', projectData.modelType);
              console.log('✅ Design Title:', data.title);

              // Clear image URL first
              setImageFileUrl('');
              setImageFileName('');

              // Clear GLB URLs to force GLBViewer to reload
              setGlbFileUrl('');
              setGlbFileUrls([]);
              setGlbFileName('');
              setGlbFileNames([]);

              // Use a small delay to ensure state clears before setting new URL
              // This ensures GLBViewer detects the change properly
              // For WMCH assemblies, use longer delay and force reload
              const delay = isWmchAssembly ? 400 : 100; // Longer delay for WMCH assemblies

              setTimeout(() => {
                // Set new URL - this will trigger GLBViewer to load
                console.log('🔄 Setting GLB URL state:', glbUrl);
                setGlbFileUrl(glbUrl);
                setGlbFileName(data.title || projectData.modelType);
                console.log('✅ GLB URL set, preview should load now:', glbUrl);
                console.log('✅ Model type:', projectData.modelType);
                console.log('✅ Design title:', data.title);
                console.log('✅ GLBViewer should re-render with new URL');

                // Special handling for WMCH COMPENSATING MAIN ASSEMBLY models
                if (isWmchAssembly) {
                  const modelName = projectData.modelType === 'wmch_compensating_main_assembly_5_sec'
                    ? 'WMCH COMPENSATING MAIN ASSEMBLY WITH 5 SEC'
                    : 'WMCH COMPENSATING MAIN ASSEMBLY WITH 2 SEC';

                  console.log(`✅ WMCH ASSEMBLY GLB URL set for ${projectData.modelType}:`, glbUrl);
                  console.log(`✅ WMCH ASSEMBLY preview loading in frontend...`);
                  toast.success(`${modelName} preview loading...`, { duration: 3000 });

                  // Force an additional reload for WMCH assemblies to ensure they display
                  setTimeout(() => {
                    // Clear and reset to force GLBViewer to reload
                    setGlbFileUrl('');
                    setTimeout(() => {
                      setGlbFileUrl(glbUrl);
                      console.log(`✅ WMCH ASSEMBLY - Forced reload for frontend preview`);
                      toast.success(`${modelName} preview loaded`, { duration: 3000 });
                    }, 150);
                  }, 300);
                } else {
                  toast.success(`3D model loaded: ${data.title || projectData.modelType}`, { duration: 3000 });
                }
              }, delay);
            } catch (urlError) {
              console.error('❌ Invalid GLB URL:', glbUrl, urlError);
              toast.error('Invalid GLB URL received from backend. Please check backend configuration.');
            }
          } else if (data.image_url) {
            // Verify URL is absolute and valid
            let imgUrl = data.image_url.trim();

            // Backend should return absolute URLs, but handle relative URLs as fallback
            if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
              // Make absolute URL
              if (imgUrl.startsWith('/')) {
                imgUrl = `${API_BASE_URL}${imgUrl}`;
              } else {
                imgUrl = `${API_BASE_URL}/${imgUrl}`;
              }
            }

            // Verify URL is valid
            try {
              new URL(imgUrl); // This will throw if URL is invalid
              console.log('Setting Image URL for preview:', imgUrl);
              console.log('Model Type:', projectData.modelType);

              // Special handling for WMCH assemblies - use longer delay for image loading (reuse existing variable)
              const imageDelay = isWmchAssembly ? 400 : 200;

              // Clear first to trigger reload
              setImageFileUrl('');
              setGlbFileUrl('');
              setGlbFileName('');
              setImageFileName('');

              // Set new URL after delay (longer for WMCH assemblies)
              setTimeout(() => {
                console.log('🔄 Setting Image URL state:', imgUrl);
                setImageFileUrl(imgUrl);
                setImageFileName(data.title || projectData.modelType);
                console.log('✅ Image URL set, preview should load now');
                console.log('✅ GLBViewer should re-render with new image URL');

                // For WMCH assemblies, verify image loads and retry if needed
                if (isWmchAssembly) {
                  const img = new Image();
                  img.onload = () => {
                    console.log(`✅ WMCH ASSEMBLY image loaded successfully: ${imgUrl}`);
                    toast.success(`Image loaded for ${data.title || projectData.modelType}`, { duration: 3000 });
                  };
                  img.onerror = () => {
                    console.warn(`⚠️ WMCH ASSEMBLY image failed to load, retrying: ${imgUrl}`);
                    // Retry after a delay
                    setTimeout(() => {
                      setImageFileUrl('');
                      setTimeout(() => {
                        setImageFileUrl(imgUrl);
                        console.log('Retried WMCH ASSEMBLY image load');
                      }, 200);
                    }, 1000);
                  };
                  img.src = imgUrl;
                } else {
                  toast.success(`Image loaded for ${data.title || projectData.modelType}`);
                }
              }, imageDelay);
            } catch (urlError) {
              console.error('Invalid Image URL:', imgUrl, urlError);
              toast.error('Invalid Image URL received from backend. Please check backend configuration.');
            }
          }
        } else {
          // No model file found for this type – design exists but no GLB/preview is available
          console.log('No GLB/image file found for type:', projectData.modelType, data);
          setGlbFileUrl('');
          setImageFileUrl('');
          setGlbFileName('');
          setImageFileName('');

          // Show a simple info message without forcing the user to open Django admin
          const modelTypeName = data.title || projectData.modelType.replace(/_/g, ' ').toUpperCase();
          toast.info(
            `No 3D model file is available yet for ${modelTypeName}. You can use the "Upload GLB" button below to add a model for this type.`,
            { duration: 8000 }
          );
        }
      } catch (error: any) {
        console.error('Error fetching model by type:', error);

        // Handle specific error types with user-friendly messages
        let errorMessage = 'Failed to load model';

        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          errorMessage = 'Request timeout: Backend server may be slow or unreachable.';
          console.error('Request timeout - backend may be slow or unreachable');

          // Show helpful message for timeout
          const apiUrl = import.meta.env.VITE_API_URL ||
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://localhost:8000'
              : `http://${window.location.hostname}:8000`);

          toast.error(
            'Backend request timeout',
            {
              duration: 8000,
              description: `The backend at ${apiUrl} is not responding. Please check if the server is running and accessible.`,
            }
          );
        } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.message?.includes('ERR_CONNECTION_REFUSED') || error.message?.includes('ERR_NETWORK')) {
          const apiUrl = import.meta.env.VITE_API_URL ||
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://localhost:8000'
              : `http://${window.location.hostname}:8000`);

          // Retry logic for network errors (up to 5 retries with exponential backoff)
          if (retryCount < 5) {
            const retryDelay = Math.min((retryCount + 1) * 2000, 10000); // Max 10 seconds
            console.log(`Retrying connection to backend (attempt ${retryCount + 1}/5) in ${retryDelay}ms...`);
            toast.info(`Backend not responding. Retrying... (${retryCount + 1}/5)`, { duration: 3000 });
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchModelByType(retryCount + 1);
          }

          // After all retries failed, show comprehensive error message
          errorMessage = `Cannot connect to backend server at ${apiUrl}. The backend server may not be running.`;
          console.error('Network error - backend server not reachable at', apiUrl);

          // Show user-friendly error with actionable instructions
          toast.error(
            'Backend server not responding. Please start the backend server.',
            {
              duration: 10000,
              description: `Expected backend at: ${apiUrl}\n\nTo start backend:\n1. Open terminal in backend folder\n2. Run: .\\start_backend_fixed.ps1\n\nOr use: FIX_BACKEND_CONNECTION.bat from project root`,
              action: {
                label: 'Check Backend',
                onClick: () => {
                  window.open(`${apiUrl}/api/health/`, '_blank');
                }
              }
            }
          );
        } else if (error.message?.includes('CORS') || error.message?.includes('Cross-Origin')) {
          errorMessage = 'CORS error: Backend may not allow requests from this origin. Please check CORS settings.';
          console.error('CORS error detected');
        } else if (error.message?.includes('HTTP error')) {
          const statusMatch = error.message.match(/status: (\d+)/);
          const status = statusMatch ? statusMatch[1] : 'unknown';
          if (status === '404') {
            errorMessage = 'Model not found: The requested model type does not exist. Please upload via Django admin.';
          } else if (status >= '500') {
            errorMessage = `Server error (${status}): Please check backend logs.`;
          } else {
            errorMessage = `Server error: ${error.message}. Please check backend logs.`;
          }
          console.error('HTTP error:', error);
        } else if (error.message?.includes('Invalid GLB URL') || error.message?.includes('Invalid Image URL')) {
          errorMessage = error.message;
          console.error('URL validation error:', error);
        } else {
          errorMessage = `Error: ${error.message || 'Unknown error occurred'}`;
          console.error('Unknown error:', error);
        }

        toast.error(errorMessage);

        // Clear URLs on error
        setGlbFileUrl('');
        setImageFileUrl('');
        setGlbFileName('');
        setImageFileName('');
      }
    };

    fetchModelByType(0);
  }, [projectData.modelType]);

  // Debug: Log when URLs change to help troubleshoot preview issues
  useEffect(() => {
    console.log('📊 Preview URLs updated:', {
      glbFileUrl,
      imageFileUrl,
      glbFileName,
      imageFileName,
      modelType: projectData.modelType
    });
  }, [glbFileUrl, imageFileUrl, glbFileName, imageFileName, projectData.modelType]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Kitchen Chimney Design System</h1>
              <p className="text-sm text-muted-foreground mt-1">
                3D Configuration & Production Management Platform
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => glbViewerRef.current?.exportToGLB()}
                variant="outline"
                className={`gap-2 ${projectData.modelType && (glbFileUrl || imageFileUrl) ? 'animate-pulse' : ''}`}
                disabled={!projectData.modelType || (!glbFileUrl && !imageFileUrl)}
              >
                <Download className="h-4 w-4" />
                Export GLB
              </Button>
              <Button
                onClick={handleExportDWG}
                variant="outline"
                className="gap-2"
                disabled={!projectData.modelType || (!glbFileUrl && !imageFileUrl)}
              >
                <FileType className="h-4 w-4" />
                Export DWG
              </Button>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Save Project
              </Button>
              <Button onClick={handleExport} variant="outline" className="gap-2">
                <FileDown className="h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        {/* Split Layout: Project Form/Table (Left) and 3D Viewer (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 min-h-[800px]">
          {/* Left Side: Project Form and Item Table */}
          <div className="space-y-6">
            <ProjectForm
              projectData={projectData}
              setProjectData={setProjectData}
              modelTypes={modelTypes}
            />

            <ItemTable
              items={items}
              setItems={setItems}
            />
          </div>

          {/* Right Side: CAD File Viewer (Autodesk APS) */}
          <div className="h-full">
            <AutodeskViewer
              className="w-full h-full min-h-[800px]"
              fileUrl={glbFileUrl}
              onModelLoaded={(urn) => {
                console.log('CAD model loaded:', urn);
                toast.success('CAD model loaded successfully!');
              }}
              onError={(error) => {
                console.error('CAD viewer error:', error);
                toast.error(`CAD viewer error: ${error}`);
              }}
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">3D Model / Image</p>
            <p className="text-2xl font-bold text-accent">
              {glbFileName ? glbFileName : (imageFileName ? imageFileName : 'Not uploaded')}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Items</p>
            <p className="text-2xl font-bold text-foreground">{items.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Drawing Type</p>
            <p className="text-2xl font-bold text-foreground">
              {projectData.drawingType ? projectData.drawingType.toUpperCase() : '-'}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Model Type</p>
            <p className="text-2xl font-bold text-foreground">
              {projectData.modelType ? projectData.modelType.replace('-', ' ') : '-'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

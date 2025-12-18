import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, X, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { GLBViewer } from "./GLBViewer";

interface UploadedFile {
  url: string;
  filename: string;
  thumbnailUrl?: string | null;
  fileType?: 'model' | 'original';
}

interface ModelFileUploadProps {
  modelType?: string;
  onFileUploaded: (url: string, filename: string, thumbnailUrl?: string | null) => void;
  onMultipleFilesUploaded?: (files: UploadedFile[]) => void;
  currentFileName?: string;
  currentFileUrl?: string;
  maxFiles?: number;
}

export const ModelFileUpload = ({ 
  modelType, 
  onFileUploaded, 
  onMultipleFilesUploaded,
  currentFileName, 
  currentFileUrl,
  maxFiles = 4 
}: ModelFileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [originalFiles, setOriginalFiles] = useState<UploadedFile[]>([]);
  const [modelFiles, setModelFiles] = useState<UploadedFile[]>([]);
  const [showOriginalPreview, setShowOriginalPreview] = useState(false);
  const [showModelPreview, setShowModelPreview] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Get API URL from env or default based on current hostname for network access
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000' 
      : typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:8000`
        : 'http://localhost:8000');

  // Fetch existing files when modelType changes
  useEffect(() => {
    if (modelType) {
      loadExistingFiles();
    } else {
      setOriginalFiles([]);
      setModelFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelType]);

  const loadExistingFiles = async () => {
    if (!modelType) return;
    
    setIsLoadingFiles(true);
    try {
      const url = `${API_BASE_URL}/api/get-model-by-type/?model_type=${encodeURIComponent(modelType)}`;
      console.log('🔄 Loading existing files for model type:', modelType, 'URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Files response data:', data);
        console.log('📦 GLB files count:', data.glb_files?.length || 0);
        
        // Parse GLB files from response
        const originalFilesList: UploadedFile[] = [];
        const modelFilesList: UploadedFile[] = [];

        if (data.glb_files && Array.isArray(data.glb_files)) {
          console.log('📦 Processing GLB files:', data.glb_files.length);
          data.glb_files.forEach((file: any, index: number) => {
            const fileInfo: UploadedFile = {
              url: file.url || file.glb_file_url || '',
              filename: file.file_name || file.filename || 'unknown',
              thumbnailUrl: file.thumbnail_url || null,
              fileType: file.file_type || 'model',
            };

            console.log(`📦 File ${index + 1}:`, {
              filename: fileInfo.filename,
              fileType: fileInfo.fileType,
              url: fileInfo.url ? fileInfo.url.substring(0, 50) + '...' : 'no URL'
            });

            if (file.file_type === 'original') {
              originalFilesList.push(fileInfo);
            } else {
              modelFilesList.push(fileInfo);
            }
          });
        } else {
          console.warn('⚠️ No glb_files array in response or not an array');
        }

        // Also check legacy fields
        if (data.original_file_url && !originalFilesList.find(f => f.url === data.original_file_url)) {
          originalFilesList.push({
            url: data.original_file_url,
            filename: data.original_filename || 'original_file',
            fileType: 'original',
          });
        }

        if (data.glb_url && !modelFilesList.find(f => f.url === data.glb_url)) {
          modelFilesList.push({
            url: data.glb_url,
            filename: data.title || modelType,
            fileType: 'model',
          });
        }

        console.log('✅ Final file lists:', {
          originalFiles: originalFilesList.length,
          modelFiles: modelFilesList.length
        });

        // Merge with existing files to preserve optimistic updates
        setOriginalFiles(prev => {
          const merged = [...prev];
          originalFilesList.forEach(newFile => {
            const exists = merged.some(f => f.url === newFile.url || f.filename === newFile.filename);
            if (!exists) {
              merged.push(newFile);
            }
          });
          // Return backend files first (most up-to-date), then any optimistic updates
          return [...originalFilesList, ...merged.filter(f => !originalFilesList.some(bf => bf.url === f.url || bf.filename === f.filename))];
        });
        
        setModelFiles(prev => {
          const merged = [...prev];
          modelFilesList.forEach(newFile => {
            const exists = merged.some(f => f.url === newFile.url || f.filename === newFile.filename);
            if (!exists) {
              merged.push(newFile);
            }
          });
          // Return backend files first (most up-to-date), then any optimistic updates
          return [...modelFilesList, ...merged.filter(f => !modelFilesList.some(bf => bf.url === f.url || bf.filename === f.filename))];
        });
      } else {
        console.error('❌ Failed to load files:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error loading existing files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFileSelect = async (files: FileList | null, fileType: 'model' | 'original' = 'model') => {
    if (!files || files.length === 0) return;

    // Convert FileList to Array
    const fileArray = Array.from(files);
    
    // Validate number of files
    const totalFiles = selectedFiles.length + fileArray.length;
    if (totalFiles > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed. Please select up to ${maxFiles - selectedFiles.length} more file(s).`);
      return;
    }

    // Validate all files
    const validExtensions = ['.glb', '.gltf', '.stp', '.step'];
    const MAX_FILE_SIZE = 524288000; // 500 MB
    
    for (const file of fileArray) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        toast.error(`File "${file.name}" is not a valid 3D model file (.glb, .gltf, .stp, .step)`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024} MB`);
        return;
      }
    }

    if (!modelType) {
      toast.error('Please select a model type first');
      return;
    }

    // Add files to selected files with file type
    const filesWithType = fileArray.map(file => ({ file, fileType }));
    setSelectedFiles(prev => [...prev, ...fileArray]);
    
    // Upload files with specified file type
    await uploadFiles([...selectedFiles, ...fileArray], fileType);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[], fileType: 'model' | 'original' = 'model') => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Filter GLB/GLTF files and STP/STEP files
      const glbFiles = files.filter(f => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return ext === '.glb' || ext === '.gltf';
      });
      
      const stpFiles = files.filter(f => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return ext === '.stp' || ext === '.step';
      });

      const uploadedResults: UploadedFile[] = [];

      // Upload GLB/GLTF files together (multiple)
      if (glbFiles.length > 0) {
        const url = `${API_BASE_URL}/api/upload-glb/`;
        
        const formData = new FormData();
        glbFiles.forEach(file => {
          formData.append('files[]', file);
        });
        formData.append('model_type', modelType || '');
        // Use specified file_type
        formData.append('file_type', fileType);

        const response = await uploadWithProgress(url, formData);
        
        if (response.success && response.files) {
          response.files.forEach((fileInfo: any) => {
            uploadedResults.push({
              url: fileInfo.url || fileInfo.glb_file_url,
              filename: fileInfo.file_name || fileInfo.file_path?.split('/').pop() || 'unknown',
              thumbnailUrl: fileInfo.thumbnail_url || null,
              fileType: fileType
            });
          });
        }
      }

      // Upload STP/STEP files one by one (they need conversion)
      for (const file of stpFiles) {
        const url = `${API_BASE_URL}/api/upload-3d-object/`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model_type', modelType || '');

        const response = await uploadWithProgress(url, formData);
        
        if (response.success) {
          uploadedResults.push({
            url: response.glb_file_url || response.file_url || '',
            filename: response.glb_file || response.original_filename || file.name,
            thumbnailUrl: response.thumbnail_url || null,
            fileType: 'original'
          });
        }
      }

      if (uploadedResults.length > 0) {
        setUploadedFiles(prev => [...prev, ...uploadedResults]);
        setSelectedFiles([]);
        
        // Immediately add uploaded files to the state (optimistic update)
        uploadedResults.forEach(file => {
          if (file.fileType === 'original') {
            setOriginalFiles(prev => {
              // Check if file already exists to avoid duplicates
              const exists = prev.some(f => f.url === file.url || f.filename === file.filename);
              return exists ? prev : [...prev, file];
            });
          } else {
            setModelFiles(prev => {
              // Check if file already exists to avoid duplicates
              const exists = prev.some(f => f.url === file.url || f.filename === file.filename);
              return exists ? prev : [...prev, file];
            });
          }
        });
        
        // Call callbacks
        if (onMultipleFilesUploaded) {
          onMultipleFilesUploaded(uploadedResults);
        } else if (onFileUploaded && uploadedResults.length > 0) {
          // Backward compatibility: call single file callback with first file
          onFileUploaded(uploadedResults[0].url, uploadedResults[0].filename, uploadedResults[0].thumbnailUrl);
        }
        
        toast.success(`Successfully uploaded ${uploadedResults.length} file(s) for ${modelType}!`);
        
        // Wait a bit before reloading to ensure backend has processed the files
        // This will merge with the optimistic update above
        setTimeout(async () => {
          console.log('🔄 Reloading files after upload to sync with backend...');
          await loadExistingFiles();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error uploading files:', error);
      let errorMsg = 'Failed to upload files.';
      
      if (error.message?.includes('timeout')) {
        errorMsg = 'Upload timeout: File upload took too long. Please try again or use smaller files.';
      } else if (error.message?.includes('Network error') || error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED') || error.message?.includes('ERR_NETWORK')) {
        errorMsg = `Backend server not responding at ${API_BASE_URL}.\n\nPlease ensure:\n1. Backend server is running\n2. Port 8000 is accessible\n3. Server is not blocked by firewall`;
      } else if (error.message?.includes('CORS') || error.message?.includes('Cross-Origin')) {
        errorMsg = 'CORS error: Backend may not allow requests from this origin. Please check CORS settings.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadWithProgress = (url: string, formData: FormData): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMsg = errorData.error || errorMsg;
          } catch (e) {
            errorMsg = xhr.statusText || errorMsg;
          }
          reject(new Error(errorMsg));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error: Failed to upload file'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      const timeoutId = setTimeout(() => {
        xhr.abort();
        reject(new Error('Upload timeout: File upload took too long'));
      }, 300000); // 5 minutes for multiple files

      xhr.addEventListener('loadend', () => {
        clearTimeout(timeoutId);
      });

      xhr.open('POST', url);
      xhr.send(formData);
    });
  };

  // Delete functionality removed - users cannot delete 3D model files from frontend

  const handleReloadFiles = async () => {
    await loadExistingFiles();
    toast.success('Files reloaded successfully');
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">3D Model Files</h3>
            <p className="text-sm text-muted-foreground">
              Upload GLB (.glb, .gltf) or STEP (.step, .stp) files. You can select multiple files at once using Ctrl+Click or Shift+Click. STEP files will be automatically converted to GLB.
            </p>
          </div>
          {modelType && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReloadFiles}
              disabled={isLoadingFiles}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              Reload Files
            </Button>
          )}
        </div>

        {/* Upload Section */}
        <div className="space-y-4">
          {/* Original File Upload */}
          <div className="space-y-2">
            <Label htmlFor="original-file-input" className="text-sm font-semibold text-foreground">
              Original File:
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                id="original-file-input"
                type="file"
                accept=".glb,.gltf,.stp,.step"
                multiple
                onChange={(e) => handleFileSelect(e.target.files, 'original')}
                className="hidden"
                disabled={isUploading || !modelType}
              />
              <label
                htmlFor="original-file-input"
                className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading || !modelType ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {!modelType 
                    ? 'Please select a model type first'
                    : isUploading 
                      ? 'Uploading...'
                      : '💡 Click "Choose Files" to select multiple files (Legacy field - use GLB Files section instead)'
                  }
                </span>
                <span className="text-xs text-muted-foreground">
                  💡 Click "Choose Files" to select multiple files (GLB, GLTF, STEP, or STP formats)
                </span>
              </label>
            </div>
          </div>

          {/* Model File Upload */}
          <div className="space-y-2">
            <Label htmlFor="model-file-input" className="text-sm font-semibold text-foreground">
              Model File:
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                id="model-file-input"
                type="file"
                accept=".glb,.gltf,.stp,.step"
                multiple
                onChange={(e) => handleFileSelect(e.target.files, 'model')}
                className="hidden"
                disabled={isUploading || !modelType}
              />
              <label
                htmlFor="model-file-input"
                className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading || !modelType ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {!modelType 
                    ? 'Please select a model type first'
                    : isUploading 
                      ? 'Uploading...'
                      : '💡 Click "Choose Files" to select multiple GLB files'
                  }
                </span>
                <span className="text-xs text-muted-foreground">
                  💡 Click "Choose Files" to select multiple GLB files
                </span>
              </label>
            </div>
          </div>

          {/* Original File Preview Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Original File Preview:</h4>
                <p className="text-xs text-muted-foreground">
                  {originalFiles.length > 0 
                    ? `${originalFiles.length} original file(s) uploaded`
                    : 'No original file uploaded'
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format of original file (GLB or STEP only)
                </p>
              </div>
              {originalFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOriginalPreview(!showOriginalPreview)}
                  className="flex items-center gap-2"
                >
                  {showOriginalPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showOriginalPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
              )}
            </div>
            
            {originalFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {originalFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border">
                      <FileDown className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-foreground truncate max-w-[200px]" title={file.filename}>
                        {file.filename}
                      </span>
                    </div>
                  ))}
                </div>
                {showOriginalPreview && originalFiles.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden" style={{ height: '400px' }}>
                    <GLBViewer 
                      glbUrls={originalFiles.map(f => f.url).filter(Boolean)}
                      modelType={modelType}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model File Preview Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Model File Preview:</h4>
                <p className="text-xs text-muted-foreground">
                  {modelFiles.length > 0 
                    ? `${modelFiles.length} model file(s) uploaded`
                    : 'No model file uploaded'
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Click "Choose Files" to select multiple GLB files
                </p>
              </div>
              {modelFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModelPreview(!showModelPreview)}
                  className="flex items-center gap-2"
                >
                  {showModelPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showModelPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
              )}
            </div>
            
            {modelFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {modelFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border">
                      <FileDown className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-foreground truncate max-w-[200px]" title={file.filename}>
                        {file.filename}
                      </span>
                    </div>
                  ))}
                </div>
                {showModelPreview && modelFiles.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden" style={{ height: '400px' }}>
                    <GLBViewer 
                      glbUrls={modelFiles.map(f => f.url).filter(Boolean)}
                      modelType={modelType}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && !isUploading && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Selected Files ({selectedFiles.length}/{maxFiles}):</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded-lg border border-border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSelectedFile(index)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && !isUploading && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Uploaded Files ({uploadedFiles.length}):</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded bg-green-500/10 flex items-center justify-center">
                        <FileDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">3D Model File</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded flex-shrink-0">
                    Uploaded
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isUploading && (
          <div className="space-y-2">
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Uploading... {Math.round(uploadProgress)}%
            </p>
          </div>
        )}

        {/* Legacy current file display */}
        {currentFileName && !isUploading && modelFiles.length === 0 && originalFiles.length === 0 && (
          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                  <FileDown className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" title={currentFileName}>
                  {currentFileName}
                </p>
                <p className="text-xs text-muted-foreground">3D Model File</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded">
                Uploaded
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};





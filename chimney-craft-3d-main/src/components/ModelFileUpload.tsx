import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, FileDown } from "lucide-react";
import { toast } from "sonner";

interface ModelFileUploadProps {
  modelType?: string;
  onFileUploaded: (url: string, filename: string, thumbnailUrl?: string | null) => void;
  currentFileName?: string;
  currentFileUrl?: string;
}

export const ModelFileUpload = ({ modelType, onFileUploaded, currentFileName, currentFileUrl }: ModelFileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Delete functionality removed - users cannot delete 3D model files

  // Get API URL from env or default based on current hostname for network access
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000' 
      : typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:8000`
        : 'http://localhost:8000');

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0]; // Only handle single file upload
    
    // Validate file type
    const validExtensions = ['.glb', '.gltf', '.stp', '.step'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Please select a valid 3D model file (.glb, .gltf, .stp, .step)');
      return;
    }

    // Check file size (500 MB max)
    const MAX_FILE_SIZE = 524288000; // 500 MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024} MB`);
      return;
    }

    if (!modelType) {
      toast.error('Please select a model type first');
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Determine which endpoint to use based on file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isSTPFile = fileExtension === '.stp' || fileExtension === '.step';
      
      // Use upload-3d-object for STP files (handles conversion), upload-glb for GLB/GLTF files
      const url = isSTPFile 
        ? `${API_BASE_URL}/api/upload-3d-object/`
        : `${API_BASE_URL}/api/upload-glb/`;
      
      console.log(`Uploading ${fileExtension} file to: ${url}`);
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model_type', modelType || '');

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      // Handle response
      const response = await new Promise<any>((resolve, reject) => {
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

        // Set timeout (60 seconds for large files)
        const timeoutId = setTimeout(() => {
          xhr.abort();
          reject(new Error('Upload timeout: File upload took too long'));
        }, 60000);

        xhr.addEventListener('loadend', () => {
          clearTimeout(timeoutId);
        });

        // Send request
        xhr.open('POST', url);
        // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
        xhr.send(formData);
      });

      console.log('File uploaded successfully:', response);
      
      // Handle response from both endpoints
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let thumbnailUrl: string | null = null;
      
      if (isSTPFile) {
        // Response from upload-3d-object endpoint
        if (response.success && (response.glb_file_url || response.file_url)) {
          fileUrl = response.glb_file_url || response.file_url;
          fileName = response.glb_file || response.original_filename || file.name;
          thumbnailUrl = response.thumbnail_url || null;
          
          if (response.converted_to_glb) {
            toast.success(`STEP file converted to GLB and uploaded successfully for ${modelType}!`);
          } else {
            toast.success(`File uploaded successfully for ${modelType}!`);
          }
        } else {
          throw new Error(response.error || 'Upload failed: Invalid response');
        }
      } else {
        // Response from upload-glb endpoint
        if (response.success && response.glb_file_url) {
          fileUrl = response.glb_file_url;
          fileName = response.glb_file || response.original_filename || file.name;
          thumbnailUrl = response.thumbnail_url || null;
          toast.success(`3D model uploaded successfully for ${modelType}!`);
        } else {
          throw new Error(response.error || 'Upload failed: Invalid response');
        }
      }
      
      if (fileUrl && fileName) {
        console.log('Calling onFileUploaded with:', { fileUrl, fileName, thumbnailUrl });
        onFileUploaded(fileUrl, fileName, thumbnailUrl);
      } else {
        throw new Error('Upload succeeded but no file URL returned');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      let errorMsg = 'Failed to upload file.';
      
      if (error.message?.includes('timeout')) {
        errorMsg = 'Upload timeout: File upload took too long. Please try again or use a smaller file.';
      } else if (error.message?.includes('Network error') || error.message?.includes('Failed to fetch')) {
        errorMsg = `Network error: Cannot connect to backend at ${API_BASE_URL}. Please ensure backend server is running and CORS is configured.`;
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

  // Delete functionality removed - users cannot delete 3D model files from frontend

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">3D Model File</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload GLB, GLTF, STEP, or STP files. STEP/STP files will be automatically converted to GLB for preview.
          </p>
        </div>

        <div>
          <Label htmlFor="model-file-input" className="sr-only">Upload 3D Model File</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              id="model-file-input"
              type="file"
              accept=".glb,.gltf,.stp,.step"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              disabled={isUploading || !modelType}
            />
            <label
              htmlFor="model-file-input"
              className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading || !modelType ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {!modelType 
                  ? 'Please select a model type first'
                  : isUploading 
                    ? 'Uploading...'
                    : 'Click to upload 3D model file or drag and drop'
                }
              </span>
              <span className="text-xs text-muted-foreground">
                Supports: GLB, GLTF, STEP, STP (Max 500MB)
              </span>
            </label>
          </div>
        </div>

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

        {currentFileName && !isUploading && (
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
              {/* Delete button removed - users cannot delete 3D model files */}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};





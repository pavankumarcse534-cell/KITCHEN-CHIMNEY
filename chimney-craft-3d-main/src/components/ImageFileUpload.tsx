import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageFileUploadProps {
  modelType?: string;
  onFileUploaded: (url: string, filename: string) => void;
  currentFileName?: string;
  currentFileUrl?: string;
}

export const ImageFileUpload = ({ modelType, onFileUploaded, currentFileName, currentFileUrl }: ImageFileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    const validExtensions = ['.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Please select a valid image file (.png, .svg, .jpg, .jpeg, .gif, .webp)');
      return;
    }

    // Check file size (10 MB max for images)
    const MAX_FILE_SIZE = 10485760; // 10 MB
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

  const uploadFile = async (file: File, retryCount = 0) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const url = `${API_BASE_URL}/api/upload-image/`;
      
      console.log('Uploading preview image:', {
        fileName: file.name,
        fileSize: file.size,
        modelType: modelType,
        url: url
      });
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model_type', modelType || '');
      formData.append('is_thumbnail', 'true'); // Mark as thumbnail/preview for model type

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
          // Backend returns 201 CREATED for successful uploads
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log('Image upload response:', data);
              resolve(data);
            } catch (e) {
              console.error('Error parsing response:', e, xhr.responseText);
              reject(new Error('Invalid response from server'));
            }
          } else {
            let errorMsg = `Upload failed with status ${xhr.status}`;
            console.error('Upload failed:', {
              status: xhr.status,
              statusText: xhr.statusText,
              responseText: xhr.responseText,
              headers: xhr.getAllResponseHeaders()
            });
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMsg = errorData.error || errorData.message || errorMsg;
              console.error('Parsed error data:', errorData);
            } catch (e) {
              console.error('Failed to parse error response as JSON:', e);
              errorMsg = xhr.statusText || errorMsg;
            }
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('XHR error event fired', {
            status: xhr.status,
            statusText: xhr.statusText,
            responseText: xhr.responseText,
            readyState: xhr.readyState
          });
          const errorMsg = xhr.status === 0 
            ? 'Network error: Cannot connect to backend server'
            : `Network error: Failed to upload file (Status: ${xhr.status})`;
          reject(new Error(errorMsg));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Set timeout (30 seconds for images)
        const timeoutId = setTimeout(() => {
          xhr.abort();
          reject(new Error('Upload timeout: File upload took too long'));
        }, 30000);

        xhr.addEventListener('loadend', () => {
          clearTimeout(timeoutId);
        });

        // Send request
        xhr.open('POST', url);
        // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
        xhr.send(formData);
      });

      console.log('Image uploaded successfully:', response);
      
      // Handle multiple possible response formats from backend
      const fileUrl = response.image_file_url || response.image_url || response.url || response.thumbnail_url;
      const fileName = response.image_file || response.original_filename || response.filename || file.name;
      
      if (response.success && fileUrl) {
        // Ensure URL is absolute
        let absoluteUrl = fileUrl;
        if (!absoluteUrl.startsWith('http://') && !absoluteUrl.startsWith('https://')) {
          if (absoluteUrl.startsWith('/')) {
            absoluteUrl = `${API_BASE_URL}${absoluteUrl}`;
          } else {
            absoluteUrl = `${API_BASE_URL}/${absoluteUrl}`;
          }
        }
        
        console.log('✅ Preview image URL from backend:', absoluteUrl);
        console.log('✅ Preview image filename:', fileName);
        console.log('✅ Model type:', modelType);
        console.log('Calling onFileUploaded with:', { fileUrl: absoluteUrl, fileName });
        
        // Call callback to update parent component
        onFileUploaded(absoluteUrl, fileName);
        
        toast.success(`Preview image uploaded successfully for ${modelType}!`, {
          description: 'The preview will appear in the model type gallery shortly.',
          duration: 4000
        });
      } else {
        throw new Error(response.error || 'Upload failed: Invalid response - no image URL returned');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
      // Retry logic for network errors
      const isNetworkError = error.message?.includes('Network error') || 
                            error.message?.includes('Cannot connect') ||
                            error.message?.includes('Failed to fetch') ||
                            error.message?.includes('ERR_CONNECTION_REFUSED') ||
                            error.message?.includes('ERR_NETWORK');
      
      if (isNetworkError && retryCount < 3) {
        const retryDelay = (retryCount + 1) * 2000;
        console.log(`Retrying preview upload (attempt ${retryCount + 1}/3) in ${retryDelay}ms...`);
        toast.info(`Backend not responding. Retrying preview upload... (${retryCount + 1}/3)`, { duration: 3000 });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return uploadFile(file, retryCount + 1);
      }
      
      let errorMsg = 'Failed to upload preview image.';
      
      if (error.message?.includes('timeout')) {
        errorMsg = 'Upload timeout: File upload took too long. Please try again or use a smaller file.';
      } else if (isNetworkError) {
        errorMsg = `Backend server not responding at ${API_BASE_URL}.\n\nPlease ensure:\n1. Backend server is running\n2. Port 8000 is accessible\n3. Server is not blocked`;
        toast.error(
          'Backend server not responding',
          {
            duration: 10000,
            description: errorMsg,
            action: {
              label: 'Check Backend',
              onClick: () => {
                window.open(`${API_BASE_URL}/api/health/`, '_blank');
              }
            }
          }
        );
        return; // Don't show duplicate error
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

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Image File</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload PNG, SVG, JPG, or other image files. Images will be displayed in the 3D viewer.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-file-input" className="sr-only">Upload Image File</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isUploading
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isUploading) {
                handleFileSelect(e.dataTransfer.files);
              }
            }}
            onClick={() => {
              if (!isUploading) {
                document.getElementById('image-file-input')?.click();
              }
            }}
          >
            <input
              id="image-file-input"
              type="file"
              accept=".png,.svg,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={isUploading}
            />
            
            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Uploading...</p>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.round(uploadProgress)}%</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">
                  {currentFileName
                    ? 'Click to upload a different image file or drag and drop'
                    : 'Click to upload image file or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports: PNG, SVG, JPG, JPEG, GIF, WEBP (Max 10MB)
                </p>
              </div>
            )}
          </div>
        </div>

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
                <p className="text-xs text-muted-foreground">Image File</p>
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


import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ModelImage {
  id: string;
  url: string;
  filename: string;
  file?: File;
}

interface ModelImageUploadProps {
  images: ModelImage[];
  onImagesChange: (images: ModelImage[]) => void;
}

export const ModelImageUpload = ({ images, onImagesChange }: ModelImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  // Get API URL from env or default based on current hostname for network access
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000' 
      : typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:8000`
        : 'http://localhost:8000');

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => {
      const isImage = file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
      return isImage;
    });

    if (imageFiles.length === 0) {
      toast.error('Please select valid image files');
      return;
    }

    // Upload each image
    for (const file of imageFiles) {
      await uploadImage(file);
    }
  };

  const uploadImage = async (file: File) => {
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setIsUploading(true);
    setUploadProgress(prev => ({ ...prev, [imageId]: 0 }));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 60000;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(prev => ({ ...prev, [imageId]: percentComplete }));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            const fileUrl = response.image_file_url;
            const absoluteUrl = fileUrl.startsWith('http') 
              ? fileUrl 
              : `${API_BASE_URL}${fileUrl}`;

            const newImage: ModelImage = {
              id: imageId,
              url: absoluteUrl,
              filename: response.image_file
            };

            onImagesChange([...images, newImage]);
            setUploadProgress(prev => {
              const updated = { ...prev };
              delete updated[imageId];
              return updated;
            });
            toast.success(`Image "${file.name}" uploaded successfully`);
          } catch (error) {
            console.error('Error parsing response:', error);
            toast.error('Failed to parse server response');
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const error = JSON.parse(xhr.responseText);
            if (error.error) {
              errorMessage = error.error;
            } else if (typeof error === 'string') {
              errorMessage = error;
            }
          } catch {
            // Not JSON, use status text
            if (xhr.status === 400) {
              errorMessage = 'Invalid request: Please check file format and size.';
            } else if (xhr.status === 413) {
              errorMessage = 'File too large. Maximum size is 10MB.';
            } else if (xhr.status >= 500) {
              errorMessage = `Server error (${xhr.status}): Please check backend logs.`;
            } else {
              errorMessage = `Upload failed (${xhr.status}): ${xhr.statusText || 'Unknown error'}`;
          }
          }
          toast.error(errorMessage);
        }
        setIsUploading(false);
      });

      xhr.addEventListener('error', () => {
        const apiUrl = import.meta.env.VITE_API_URL || 
          (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8000' 
            : typeof window !== 'undefined' 
              ? `http://${window.location.hostname}:8000`
              : 'http://localhost:8000');
        toast.error(`Network error: Cannot connect to backend at ${apiUrl}. Please ensure backend server is running.`);
        setIsUploading(false);
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
      });

      xhr.addEventListener('timeout', () => {
        toast.error('Upload timeout: File upload took too long. Please try again or use a smaller file.');
        setIsUploading(false);
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
      });

      xhr.open('POST', `${API_BASE_URL}/api/upload-image/`);
      xhr.send(formData);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
      setIsUploading(false);
      setUploadProgress(prev => {
        const updated = { ...prev };
        delete updated[imageId];
        return updated;
      });
    }
  };

  const removeImage = (imageId: string) => {
    onImagesChange(images.filter(img => img.id !== imageId));
    toast.success('Image removed');
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Model Images</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload reference images, thumbnails, or documentation images for this model
          </p>
        </div>

        <div>
          <Label htmlFor="model-image-input" className="sr-only">Upload Model Images</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              id="model-image-input"
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              disabled={isUploading}
            />
            <label
              htmlFor="model-image-input"
              className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to upload model images or drag and drop
              </span>
              <span className="text-xs text-muted-foreground">
                Supports: JPG, PNG, GIF, BMP, WEBP, SVG (Max 10MB each)
              </span>
            </label>
          </div>
        </div>

        {isUploading && Object.keys(uploadProgress).length > 0 && (
          <div className="space-y-2">
            {Object.entries(uploadProgress).map(([id, progress]) => (
              <div key={id} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ccc"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999"%3EImage%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(image.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground mt-1 truncate" title={image.filename}>
                  {image.filename}
                </p>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && !isUploading && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No model images uploaded yet</p>
          </div>
        )}
      </div>
    </Card>
  );
};



import React, { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Loader2, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AutodeskViewerProps {
    className?: string;
    onModelLoaded?: (urn: string) => void;
    onError?: (error: string) => void;
    fileUrl?: string; // URL of the file to load automatically
}

// Backend URL constant - using localhost for better compatibility
const BACKEND_URL = 'http://localhost:8000';

const AutodeskViewer: React.FC<AutodeskViewerProps> = ({
    className = '',
    onModelLoaded,
    onError,
    fileUrl
}) => {
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [isSDKLoaded, setIsSDKLoaded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [translationProgress, setTranslationProgress] = useState(0);
    const [translationStatus, setTranslationStatus] = useState<'idle' | 'uploading' | 'translating' | 'loading' | 'complete' | 'error'>('idle');
    const [currentUrn, setCurrentUrn] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load Autodesk Viewer SDK
    useEffect(() => {
        const loadViewerSDK = async () => {
            if ((window as any).Autodesk) {
                setIsSDKLoaded(true);
                return;
            }

            try {
                // Load CSS
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
                document.head.appendChild(link);

                // Load JS
                const script = document.createElement('script');
                script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
                script.async = true;
                script.onload = () => {
                    console.log('✅ Autodesk Viewer SDK loaded');

                    // Suppress non-critical console warnings and errors
                    const originalError = console.error;
                    const originalWarn = console.warn;

                    console.error = (...args: any[]) => {
                        const errorString = args.join(' ');
                        // Suppress known harmless errors
                        if (errorString.includes('MixpanelProvider') ||
                            errorString.includes('extensions/MixpanelProvider') ||
                            errorString.includes('Multiple instances of Three.js') ||
                            errorString.includes('message channel closed') ||
                            errorString.includes('asynchronous response')) {
                            return;
                        }
                        originalError.apply(console, args);
                    };

                    console.warn = (...args: any[]) => {
                        const warnString = args.join(' ');
                        // Suppress known harmless warnings
                        if (warnString.includes('Multiple instances of Three.js') ||
                            warnString.includes('Download the React DevTools') ||
                            warnString.includes('Slow network is detected') ||
                            warnString.includes('Fallback font will be used')) {
                            return;
                        }
                        originalWarn.apply(console, args);
                    };

                    setIsSDKLoaded(true);
                };
                script.onerror = () => {
                    const errorMsg = 'Failed to load Autodesk Viewer SDK';
                    console.error(errorMsg);
                    setError(errorMsg);
                    toast.error(errorMsg);
                };
                document.head.appendChild(script);
            } catch (err) {
                const errorMsg = `Error loading Viewer SDK: ${err}`;
                console.error(errorMsg);
                setError(errorMsg);
                toast.error(errorMsg);
            }
        };

        loadViewerSDK();
    }, []);

    // Initialize viewer when SDK is loaded
    useEffect(() => {
        if (!isSDKLoaded || !viewerContainerRef.current) return;

        const initViewer = async () => {
            try {
                // Get public token from backend with timeout and retry
                console.log('🔑 Fetching APS token from backend...');

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                let tokenResponse;
                try {
                    tokenResponse = await fetch(`${BACKEND_URL}/api/aps/token/`, {
                        signal: controller.signal,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                    clearTimeout(timeoutId);
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);

                    // Provide helpful error message
                    let errorMsg = 'Cannot connect to backend server';
                    if (fetchError.name === 'AbortError') {
                        errorMsg = 'Backend server timeout - server is not responding';
                    } else if (fetchError.message?.includes('Failed to fetch')) {
                        errorMsg = 'Backend server is not running or not accessible';
                    }

                    const helpMsg = `
Backend server issue detected:

1. Check if backend is running on port 8000
2. Open a new terminal and run:
   cd backend
   python manage.py runserver

3. Verify APS credentials in backend/.env:
   - APS_CLIENT_ID
   - APS_CLIENT_SECRET

Current backend URL: ${BACKEND_URL}
                    `.trim();

                    console.error('❌ Backend connection failed:', fetchError);
                    setError(errorMsg);
                    toast.error(errorMsg, {
                        description: 'Please start the backend server',
                        duration: 10000,
                    });

                    // Show detailed help in console
                    console.error(helpMsg);
                    return;
                }

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json().catch(() => ({}));
                    const errorMsg = errorData.error || `Backend error: ${tokenResponse.status}`;
                    throw new Error(errorMsg);
                }

                const tokenData = await tokenResponse.json();

                if (!tokenData.access_token) {
                    throw new Error('No access token received from backend. Check APS credentials in .env file.');
                }

                const accessToken = tokenData.access_token;
                console.log('✅ APS token received');

                // Initialize viewer
                const Autodesk = (window as any).Autodesk;
                const options = {
                    env: 'AutodeskProduction2',
                    api: 'streamingV2',
                    getAccessToken: (callback: (token: string, expire: number) => void) => {
                        callback(accessToken, tokenData.expires_in);
                    }
                };

                // Initialize Autodesk Viewing with options
                Autodesk.Viewing.Initializer(options, async () => {
                    const config = {
                        extensions: [], // Don't auto-load extensions
                        disabledExtensions: {
                            hyperlink: true,
                            bimwalk: true,
                            measure: false
                        }
                    };

                    const viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current, config);

                    const startCode = viewer.start();
                    if (startCode > 0) {
                        console.error('Failed to initialize viewer');
                        setError('Failed to start viewer');
                        return;
                    }

                    viewerRef.current = viewer;
                    console.log('✅ Autodesk Viewer initialized');

                    // Only show initial toast if no fileUrl is provided
                    if (!fileUrl) {
                        toast.success('CAD Viewer ready! Drag & drop your files.');
                    }

                    // Check localStorage for saved URN if no fileUrl
                    if (!fileUrl) {
                        const savedUrn = localStorage.getItem('autodesk_current_urn');
                        if (savedUrn) {
                            console.log('📦 Found saved URN, loading model...');
                            setCurrentUrn(savedUrn);
                            loadModel(savedUrn);
                        }
                    }
                });
            } catch (err: any) {
                const errorMsg = `Viewer initialization error: ${err.message || err}`;
                console.error(errorMsg, err);
                setError(errorMsg);
                toast.error('Failed to initialize CAD viewer', {
                    description: err.message || 'Check console for details',
                    duration: 10000,
                });
                if (onError) onError(errorMsg);
            }
        };

        initViewer();

        return () => {
            if (viewerRef.current) {
                viewerRef.current.finish();
                viewerRef.current = null;
            }
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [isSDKLoaded]);

    // Auto-load file from URL when prop changes
    useEffect(() => {
        if (!fileUrl || !viewerRef.current) return;

        const loadFileFromUrl = async () => {
            try {
                console.log('🔄 Auto-loading file from URL:', fileUrl);
                setIsUploading(true);
                setTranslationStatus('uploading');
                setError(null);
                setTranslationProgress(0);

                // Fetch the file as a blob
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

                const blob = await response.blob();
                // Create a File object from blob
                const filename = fileUrl.split('/').pop() || 'model.stp';
                const file = new File([blob], filename, { type: blob.type });

                handleFileUpload(file);
            } catch (e: any) {
                console.error('Error auto-loading file:', e);
                setError(`Failed to load file: ${e.message}`);
                setTranslationStatus('error');
            }
        };

        loadFileFromUrl();
    }, [fileUrl, isSDKLoaded]); // Re-run when fileUrl changes or SDK loads

    // Load model into viewer
    const loadModel = async (urn: string) => {
        if (!viewerRef.current) {
            console.error('Viewer not initialized');
            return;
        }

        try {
            setTranslationStatus('loading');
            const documentId = `urn:${urn}`;

            await new Promise<void>((resolve, reject) => {
                const Autodesk = (window as any).Autodesk;
                Autodesk.Viewing.Document.load(
                    documentId,
                    (doc: any) => {
                        const viewables = doc.getRoot().getDefaultGeometry();
                        viewerRef.current.loadDocumentNode(doc, viewables).then(() => {
                            console.log('✅ Model loaded successfully');
                            setTranslationStatus('complete');
                            setCurrentUrn(urn);
                            localStorage.setItem('autodesk_current_urn', urn);
                            toast.success('Model loaded successfully!');
                            if (onModelLoaded) onModelLoaded(urn);
                            resolve();
                        });
                    },
                    (errorCode: number, errorMsg: string) => {
                        reject(new Error(`Load error (${errorCode}): ${errorMsg}`));
                    }
                );
            });
        } catch (err) {
            const errorMsg = `Failed to load model: ${err}`;
            console.error(errorMsg);
            setError(errorMsg);
            setTranslationStatus('error');
            toast.error(errorMsg);
            if (onError) onError(errorMsg);
        }
    };

    // Poll translation status
    const pollTranslationStatus = async (urn: string) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/aps/status/${urn}/`);
            if (!response.ok) {
                throw new Error('Failed to get translation status');
            }

            const data = await response.json();
            setTranslationProgress(data.progress);

            if (data.status === 'success') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                console.log('✅ Translation complete');
                toast.success('Translation complete! Loading model...');
                await loadModel(urn);
            } else if (data.status === 'failed') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                const errorMsg = `Translation failed: ${data.error || 'Unknown error'}`;
                setError(errorMsg);
                setTranslationStatus('error');
                toast.error(errorMsg);
                if (onError) onError(errorMsg);
            }
        } catch (err) {
            console.error('Error polling status:', err);
        }
    };

    // Handle file upload with validation
    const handleFileUpload = async (file: File) => {
        try {
            // Validate file type
            const fileName = file.name.toLowerCase();
            const allowedExtensions = ['.step', '.stp', '.sldprt', '.iges', '.igs', '.dwg', '.ipt', '.iam', '.f3d'];
            const fileExtension = '.' + fileName.split('.').pop();

            if (!allowedExtensions.includes(fileExtension)) {
                const errorMsg = `Unsupported file type: ${fileExtension}. Please upload: ${allowedExtensions.join(', ')}`;
                setError(errorMsg);
                toast.error(errorMsg);
                return;
            }

            // Validate file size (max 100MB)
            const maxSize = 100 * 1024 * 1024;
            if (file.size > maxSize) {
                const errorMsg = `File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 100MB.`;
                setError(errorMsg);
                toast.error(errorMsg);
                return;
            }

            // Validate file is not empty
            if (file.size === 0) {
                const errorMsg = 'File is empty. Please select a valid CAD file.';
                setError(errorMsg);
                toast.error(errorMsg);
                return;
            }

            setIsUploading(true);
            setTranslationStatus('uploading');
            setError(null);
            setTranslationProgress(0);

            console.log(`📤 Uploading file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
            toast.info(`Uploading ${file.name}...`);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${BACKEND_URL}/api/aps/upload/`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await response.json();
            const urn = data.urn;

            console.log('✅ File uploaded, URN:', urn);
            toast.success('File uploaded! Translating to SVF...');

            setIsUploading(false);
            setTranslationStatus('translating');

            // Start polling translation status
            pollIntervalRef.current = setInterval(() => {
                pollTranslationStatus(urn);
            }, 2000); // Poll every 2 seconds
        } catch (err) {
            const errorMsg = `Upload error: ${err}`;
            console.error(errorMsg);
            setError(errorMsg);
            setIsUploading(false);
            setTranslationStatus('error');
            toast.error(errorMsg);
            if (onError) onError(errorMsg);
        }
    };

    // Drag and drop handlers - Fixed for stability
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if leaving the container itself
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            console.log('📁 File dropped:', files[0].name);
            handleFileUpload(files[0]);
        } else {
            toast.error('No file detected. Please try again.');
        }
    };

    // File input handler
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            console.log('📁 File selected:', files[0].name);
            handleFileUpload(files[0]);
            // Reset the input value to allow re-uploading the same file
            e.target.value = '';
        }
    };

    // Clear current model
    const handleClearModel = () => {
        if (viewerRef.current) {
            viewerRef.current.unloadModel(viewerRef.current.model);
        }
        setCurrentUrn(null);
        setTranslationStatus('idle');
        setTranslationProgress(0);
        setError(null);
        localStorage.removeItem('autodesk_current_urn');
        toast.info('Model cleared');
    };

    return (
        <Card className={`relative ${className}`}>
            {/* Viewer Container */}
            <div
                ref={viewerContainerRef}
                className="w-full h-full min-h-[600px]"
                style={{ position: 'relative' }}
            />

            {/* Drag & Drop Overlay - Always active when idle */}
            <div
                className={`absolute inset-0 flex items-center justify-center transition-all ${translationStatus === 'idle'
                    ? 'bg-muted/80 pointer-events-auto'
                    : isDragging
                        ? 'bg-primary/10 border-4 border-primary border-dashed pointer-events-auto'
                        : 'bg-transparent pointer-events-none'
                    }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {translationStatus === 'idle' && (
                    <div className="text-center p-8 pointer-events-auto">
                        <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">Drop CAD File Here</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            <strong>Supported Formats:</strong>
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                            STEP (.step, .stp) • SOLIDWORKS (.sldprt) • IGES (.iges, .igs)<br />
                            AutoCAD (.dwg) • Inventor (.ipt, .iam) • Fusion 360 (.f3d)
                        </p>
                        <label htmlFor="file-upload">
                            <Button asChild>
                                <span>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Browse Files
                                </span>
                            </Button>
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            accept=".step,.stp,.sldprt,.iges,.igs,.dwg,.ipt,.iam,.f3d"
                            onChange={handleFileInputChange}
                        />
                    </div>
                )}

                {/* Drag feedback when model is loaded */}
                {translationStatus === 'complete' && isDragging && (
                    <div className="text-center p-8 bg-background/90 rounded-lg border-2 border-primary">
                        <Upload className="w-16 h-16 mx-auto mb-4 text-primary animate-bounce" />
                        <h3 className="text-xl font-semibold mb-2">Drop to Replace Model</h3>
                        <p className="text-sm text-muted-foreground">
                            Release to upload new CAD file
                        </p>
                    </div>
                )}

                {/* Floating upload button when model is loaded */}
                {translationStatus === 'complete' && !isDragging && (
                    <div className="absolute top-4 left-4 pointer-events-auto">
                        <label htmlFor="file-upload-floating">
                            <Button variant="outline" size="sm" className="bg-background/90 backdrop-blur">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload New CAD
                            </Button>
                        </label>
                        <input
                            id="file-upload-floating"
                            type="file"
                            className="hidden"
                            accept=".step,.stp,.sldprt,.iges,.igs,.dwg,.ipt,.iam,.f3d"
                            onChange={handleFileInputChange}
                        />
                    </div>
                )}
            </div>

            {/* Upload Progress */}
            {(translationStatus === 'uploading' || translationStatus === 'translating') && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90">
                    <div className="text-center p-8">
                        <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                        <h3 className="text-xl font-semibold mb-2">
                            {translationStatus === 'uploading' ? 'Uploading...' : 'Translating to SVF...'}
                        </h3>
                        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${translationProgress}%` }}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">{translationProgress}% complete</p>
                    </div>
                </div>
            )}

            {/* Loading Model */}
            {translationStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90">
                    <div className="text-center p-8">
                        <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                        <h3 className="text-xl font-semibold mb-2">Loading Model...</h3>
                    </div>
                </div>
            )}

            {/* Success */}
            {translationStatus === 'complete' && currentUrn && (
                <div className="absolute top-4 right-4 flex gap-2">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-700 dark:text-green-300">Model Loaded</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleClearModel}>
                        <X className="w-4 h-4 mr-2" />
                        Clear
                    </Button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="absolute top-4 left-4 right-4 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-destructive">Error</p>
                        <p className="text-xs text-destructive/80">{error}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* SDK Loading */}
            {!isSDKLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-background">
                    <div className="text-center p-8">
                        <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                        <h3 className="text-xl font-semibold mb-2">Loading Viewer SDK...</h3>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default AutodeskViewer;

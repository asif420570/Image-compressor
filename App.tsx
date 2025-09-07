import React, { useState, useEffect, useRef } from 'react';

// TypeScript declarations for external libraries
declare global {
  interface Window {
    imageCompression: (imageFile: File, options: any) => Promise<File>;
    JSZip: any;
  }
}

// Helper to format file size
const formatBytes = (bytes: number, decimals = 2): string => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// --- Icons ---
const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
);
const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
);
const RemoveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const AddIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);


// --- State Interface ---
interface ImageFileState {
  id: number;
  originalFile: File;
  originalUrl: string;
  compressedFile: File | null;
  compressedUrl: string | null;
  status: 'compressing' | 'done' | 'error';
  error?: string;
}

const App: React.FC = () => {
  const [imageFiles, setImageFiles] = useState<ImageFileState[]>([]);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef<number>(0);
  const filesRef = useRef(imageFiles);
  filesRef.current = imageFiles;

  // --- Core Compression Logic ---
  const compressImage = async (id: number, file: File) => {
    const options = {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.7, // Smart default
    };

    try {
      const compressed = await window.imageCompression(file, options);
      setImageFiles(prev =>
        prev.map(img =>
          img.id === id
            ? {
                ...img,
                status: 'done',
                compressedFile: compressed,
                compressedUrl: URL.createObjectURL(compressed),
              }
            : img
        )
      );
    } catch (e) {
      console.error(e);
      setImageFiles(prev =>
        prev.map(img =>
          img.id === id
            ? { ...img, status: 'error', error: 'Compression failed.' }
            : img
        )
      );
    }
  };

  // --- Event Handlers ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImageFiles: ImageFileState[] = Array.from(files).map(file => ({
      id: nextId.current++,
      originalFile: file,
      originalUrl: URL.createObjectURL(file),
      compressedFile: null,
      compressedUrl: null,
      status: 'compressing',
    }));

    setImageFiles(prev => [...prev, ...newImageFiles]);
    newImageFiles.forEach(file => compressImage(file.id, file.originalFile));

    // Reset file input value to allow re-uploading the same file
    event.target.value = '';
  };

  const handleRemoveImage = (idToRemove: number) => {
    const fileToRemove = imageFiles.find(f => f.id === idToRemove);
    if (fileToRemove) {
      if (fileToRemove.originalUrl) URL.revokeObjectURL(fileToRemove.originalUrl);
      if (fileToRemove.compressedUrl) URL.revokeObjectURL(fileToRemove.compressedUrl);
    }
    setImageFiles(prev => prev.filter(file => file.id !== idToRemove));
  };
  
  const handleDownloadAll = async () => {
    if (!window.JSZip) {
      alert("Error: JSZip library not found.");
      return;
    }
    setIsZipping(true);
    const zip = new window.JSZip();
    
    imageFiles.forEach(file => {
      if (file.status === 'done' && file.compressedFile) {
        zip.file(`compressed-${file.originalFile.name}`, file.compressedFile);
      }
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'compressed-images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch(e) {
      console.error(e);
      alert("Failed to create zip file.");
    } finally {
      setIsZipping(false);
    }
  };
  
  const handleAddMore = () => {
    fileInputRef.current?.click();
  };

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      // On unmount, revoke all URLs from the files stored in the ref
      filesRef.current.forEach(file => {
        if (file.originalUrl) URL.revokeObjectURL(file.originalUrl);
        if (file.compressedUrl) URL.revokeObjectURL(file.compressedUrl);
      });
    };
  }, []);
  
  const allSuccessfullyCompressed = imageFiles.length > 0 && imageFiles.every(f => f.status === 'done');

  // --- Render Logic ---
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Batch Image Compressor</h1>
        <p>Optimize multiple images at once. Fast, private, and free.</p>
      </header>

      <main>
        {imageFiles.length === 0 ? (
          <div className="upload-zone" onClick={handleAddMore}>
            <label className="upload-label">
              <UploadIcon />
              <span className="upload-text-main">Drag & Drop Your Images Here, or Browse Files</span>
            </label>
          </div>
        ) : (
          <>
            <section className="global-actions">
                <button onClick={handleAddMore} className="btn btn-primary">
                    <AddIcon /> Add More Images
                </button>
                <button onClick={handleDownloadAll} disabled={!allSuccessfullyCompressed || isZipping} className="btn btn-primary">
                {isZipping ? (
                  <>
                    <div className="spinner"></div> Zipping...
                  </>
                ) : (
                  <>
                    <DownloadIcon /> Download All as ZIP
                  </>
                )}
                </button>
            </section>

            <section className="results-list">
              {imageFiles.map(file => (
                <article key={file.id} className="result-card" aria-labelledby={`filename-${file.id}`}>
                  <img src={file.originalUrl} alt={file.originalFile.name} className="card-thumbnail" />
                  <div className="card-details">
                    <p id={`filename-${file.id}`} className="card-filename">{file.originalFile.name}</p>
                    <p className="card-size-orig">{formatBytes(file.originalFile.size)}</p>
                  </div>
                  <div className="card-status" role="status">
                    {file.status === 'compressing' && <div className="spinner" aria-label="Compressing"></div>}
                    {file.status === 'done' && file.compressedFile && (
                      <>
                        <span className="card-size-new">{formatBytes(file.compressedFile.size)}</span>
                        <span className="card-savings">
                          - {Math.round(100 - (file.compressedFile.size / file.originalFile.size) * 100)}%
                        </span>
                      </>
                    )}
                    {file.status === 'error' && <span style={{ color: '#721c24' }}>Error</span>}
                  </div>
                  <div className="card-actions">
                    {file.status === 'done' && file.compressedUrl && (
                      <a
                        href={file.compressedUrl}
                        download={`compressed-${file.originalFile.name}`}
                        className="btn-icon"
                        aria-label="Download compressed image"
                      >
                        <DownloadIcon />
                      </a>
                    )}
                    <button onClick={() => handleRemoveImage(file.id)} className="btn-icon remove" aria-label="Remove image">
                      <RemoveIcon />
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>

      <input
        ref={fileInputRef}
        id="file-upload"
        type="file"
        className="upload-input"
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />
    </div>
  );
};

export default App;

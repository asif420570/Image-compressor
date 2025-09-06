import React, { useState, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    imageCompression: (imageFile: File, options: any) => Promise<File>;
  }
}

const formatBytes = (bytes: number, decimals = 2): string => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const UploadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
);

const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
);

const App: React.FC = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<number>(0.7);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [compressedImageUrl, setCompressedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
      if (compressedImageUrl) URL.revokeObjectURL(compressedImageUrl);
    };
  }, [originalImageUrl, compressedImageUrl]);

  const runCompression = async (file: File, compressionQuality: number) => {
    setIsLoading(true);
    setError(null);

    if (compressedImageUrl) {
        URL.revokeObjectURL(compressedImageUrl);
    }
    setCompressedFile(null);
    setCompressedImageUrl(null);

    const options = {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: compressionQuality,
    };

    try {
      const compressed = await window.imageCompression(file, options);
      setCompressedFile(compressed);
      setCompressedImageUrl(URL.createObjectURL(compressed));
    } catch (e) {
      console.error(e);
      setError('Failed to compress image. The file might be corrupted or in an unsupported format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (originalImageUrl) {
          URL.revokeObjectURL(originalImageUrl);
      }
      setOriginalFile(file);
      setOriginalImageUrl(URL.createObjectURL(file));
      setError(null);
      await runCompression(file, quality);
    }
  };

  const handleApply = useCallback(async () => {
    if (!originalFile) {
      setError('Please select an image first.');
      return;
    }
    await runCompression(originalFile, quality);
  }, [originalFile, quality]);
  
  const handleDownload = () => {
    if (compressedImageUrl && compressedFile) {
        const link = document.createElement('a');
        link.href = compressedImageUrl;
        
        const originalName = originalFile?.name || 'image.jpg';
        const nameParts = originalName.split('.');
        const extension = nameParts.length > 1 ? nameParts.pop() : 'jpg';
        const baseName = nameParts.join('.');
        
        link.download = `${baseName}-compressed.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Smart Image Compressor</h1>
        <p>Reduce your image file size without losing quality.</p>
      </header>

      <main>
        <div className="upload-zone">
          <label htmlFor="file-upload" className="upload-label">
            <UploadIcon />
            <span className="upload-text-main">
              {originalFile ? originalFile.name : 'Drag & Drop your image here, or click to browse'}
            </span>
            {!originalFile && <span className="upload-text-sub">PNG, JPG, WEBP, GIF</span>}
          </label>
          <input id="file-upload" type="file" className="upload-input" accept="image/*" onChange={handleFileChange} />
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        {originalFile && (
          <>
            <section className="controls-section">
              <div className="slider-container">
                <label htmlFor="quality" className="slider-label">
                  Quality: <span>{Math.round(quality * 100)}%</span>
                </label>
                <input
                  id="quality"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="quality-slider"
                />
              </div>
              <button onClick={handleApply} disabled={isLoading} className="btn btn-primary">
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    Applying...
                  </>
                ) : 'Apply'}
              </button>
            </section>

            <section className="results-section">
              <div className="image-card">
                <h3>Original</h3>
                <div className="image-preview">
                  {originalImageUrl ? (
                    <img src={originalImageUrl} alt="Original" />
                  ) : <div className="placeholder-text">No image</div>}
                </div>
                {originalFile && <p className="file-info">Size: {formatBytes(originalFile.size)}</p>}
              </div>

              <div className="image-card">
                <h3>Compressed</h3>
                <div className="image-preview">
                  {isLoading ? (
                      <div className="placeholder-text">Processing...</div>
                  ) : compressedImageUrl ? (
                    <img src={compressedImageUrl} alt="Compressed" />
                  ) : (
                    <div className="placeholder-text">Awaiting compression</div>
                  )}
                </div>
                {compressedFile && (
                  <div className="file-info-compressed">
                    <p className="file-info">
                      New Size: <span>{formatBytes(compressedFile.size)}</span>
                    </p>
                    {originalFile && (
                      <p className="savings-tag">
                        - {Math.round(100 - (compressedFile.size / originalFile.size) * 100)}%
                      </p>
                    )}
                    <button onClick={handleDownload} className="btn btn-download">
                      <DownloadIcon />
                      Download Image
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <section className="content-section">
        <div className="content-header">
            <h2>The Ultimate Online Image Compressor</h2>
            <p>Drastically reduce the file size of your JPG, PNG, and WEBP images with our fast, free, and private tool. Optimize your images for the web, email, and social media in seconds.</p>
        </div>

        <h3>How to Compress Your Image in 3 Easy Steps</h3>
        <ol className="steps-list">
            <li><strong>Upload Your Image:</strong> Drag and drop your file or click to select the image you want to compress. Our tool is ready to start instantly.</li>
            <li><strong>Optimize Intelligently:</strong> Your image is immediately compressed with our smart default settings. For more control, use the quality slider and click "Apply" to find the perfect balance between quality and file size.</li>
            <li><strong>Download & Enjoy:</strong> Click the "Download" button to get your optimized image. You'll be amazed at the size reduction and the quality retained!</li>
        </ol>

        <h3>Why Choose Our Image Compressor?</h3>
        <ul className="feature-list">
            <li><strong>🔒 Secure & Private:</strong> Your privacy is our top priority. All compression is performed directly in your browser. This means your images are <strong>never</strong> sent or stored on our servers.</li>
            <li><strong>⚡ Blazing Fast:</strong> Our tool uses the latest client-side technology to compress your images in just a few seconds. There are no queues or waiting times.</li>
            <li><strong>⚖️ Perfect Balance:</strong> Our advanced compression algorithm intelligently finds the perfect balance between image quality and file size, ensuring your images look great and load quickly on any website.</li>
            <li><strong>✅ Simple for Everyone:</strong> We've designed a clean, intuitive, and powerful interface that anyone can use, with no complicated settings or software to install.</li>
        </ul>

        <h3>About Image Compression & Why It Matters</h3>
        <p>Image compression is the process of reducing the digital size of a graphic file without significantly degrading its visual quality. This is crucial for web performance, as smaller image files lead to faster loading websites, which improves user experience and Google search rankings (SEO). Our tool uses smart "lossy" compression techniques to analyze your image and remove unnecessary data, resulting in a much smaller file that's perfect for web use, sharing via email, or social media posts. An optimized image can be the difference between a slow, frustrating website and a fast, professional one.</p>

        <h3>Frequently Asked Questions (FAQ)</h3>
        <div className="faq-section">
            <div className="faq-item">
                <h4>Q: Is this image compression tool really free?</h4>
                <p>A: Yes, this tool is 100% free for everyone. There are no hidden costs or limits.</p>
            </div>
            <div className="faq-item">
                <h4>Q: Will compressing my image reduce its quality?</h4>
                <p>A: Our tool is designed to achieve maximum compression with minimal impact on visual quality. For most uses on the web, the quality difference is nearly invisible to the human eye, but the file size reduction is massive.</p>
            </div>
            <div className="faq-item">
                <h4>Q: What is the difference between JPG, PNG, and WEBP?</h4>
                <p>A: JPG is the best format for photographs with many colors. PNG is ideal for graphics with sharp lines or transparency (like logos). WEBP is a modern format developed by Google that offers excellent compression for both types of images, but may not be supported by very old browsers.</p>
            </div>
            <div className="faq-item">
                <h4>Q: Are there any limits on how many images I can compress?</h4>
                <p>A: No, you can compress as many images as you like, one by one. We plan to add batch processing in the future!</p>
            </div>
        </div>
      </section>
    </div>
  );
};

export default App;
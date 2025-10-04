import './style.css';

// --- Type Definitions ---
type ImageStatus = 'compressing' | 'done' | 'error';
type SizeUnit = 'KB' | 'MB';

interface ImageFileState {
    id: number;
    originalFile: File;
    originalUrl: string;
    compressedFile: File | null;
    compressedUrl: string | null;
    status: ImageStatus;
    targetSize: number;
    targetUnit: SizeUnit;
}

// --- Global Declarations for CDN scripts ---
declare const imageCompression: any;
declare const JSZip: any;

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const getElem = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

    const fileInput = getElem<HTMLInputElement>('file-upload');
    const uploadZone = getElem('upload-zone');
    const uploadContainer = getElem('upload-container');
    const resultsContainer = getElem('results-container');
    const resultsList = getElem('results-list');
    const addMoreBtn = getElem<HTMLButtonElement>('add-more-btn');
    const downloadAllBtn = getElem<HTMLButtonElement>('download-all-btn');
    const clearAllBtn = getElem<HTMLButtonElement>('clear-all-btn');
    const downloadCountBadge = getElem('download-count-badge');
    const globalTargetSizeInput = getElem<HTMLInputElement>('global-target-size-input');
    const globalTargetUnitSelect = getElem<HTMLSelectElement>('global-target-unit-select');
    const applyToAllBtn = getElem<HTMLButtonElement>('apply-to-all-btn');
    const downloadAllDefault = getElem('download-all-default');
    const downloadAllZipping = getElem('download-all-zipping');

    // --- State Management ---
    let imageFilesState: ImageFileState[] = [];
    let nextId = 0;

    // --- Helper Functions ---
    const formatBytes = (bytes: number): string => {
        if (!+bytes) return '0.00 KB';
        const k = 1024;
        return `${(bytes / k).toFixed(2)} KB`;
    };

    const updateFileState = (id: number, updates: Partial<ImageFileState>) => {
        const index = imageFilesState.findIndex(f => f.id === id);
        if (index !== -1) {
            imageFilesState[index] = { ...imageFilesState[index], ...updates };
        }
    };

    // --- Core Application Logic ---
    const render = () => {
        const hasFiles = imageFilesState.length > 0;
        uploadContainer.style.display = hasFiles ? 'none' : 'block';
        resultsContainer.style.display = hasFiles ? 'block' : 'none';

        // More performant than innerHTML = '' for clearing
        resultsList.replaceChildren(...imageFilesState.map(createCardElement));
        updateGlobalUI();
    };
    
    const createCardElement = (file: ImageFileState): HTMLElement => {
        const card = document.createElement('article');
        card.className = 'result-card';
        card.dataset.id = String(file.id);
        
        const isCompressing = file.status === 'compressing';
        const isDone = file.status === 'done';
        const isError = file.status === 'error';

        let statusHTML = '';
        if (isCompressing) {
            statusHTML = `<div class="spinner" aria-label="Compressing"></div>`;
        } else if (isError) {
            statusHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Error compressing image" aria-label="Error"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        }

        let sizeDetailsHTML = `<span class="card-size-orig">${formatBytes(file.originalFile.size)}</span>`;
        if (isDone && file.compressedFile) {
            const savings = Math.round(100 - (file.compressedFile.size / file.originalFile.size) * 100);
            sizeDetailsHTML += `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px; color: var(--color-text-light);"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                <span class="card-size-new">${formatBytes(file.compressedFile.size)}</span>
                <span class="card-savings">- ${savings}%</span>
            `;
        }

        card.innerHTML = `
            <div class="card-file-info">
                <img src="${file.originalUrl}" alt="${file.originalFile.name}" class="card-thumbnail" />
                <div class="card-details">
                    <p class="card-filename" title="${file.originalFile.name}">${file.originalFile.name}</p>
                    <div class="card-size-details">${sizeDetailsHTML}</div>
                </div>
            </div>
            
            <div class="card-controls">
                ${!isError ? `
                <div class="card-target-controls">
                    <input type="number" id="target-size-${file.id}" class="target-size-input" value="${file.targetSize}" ${isCompressing ? 'disabled' : ''} aria-label="Target size">
                    <select id="target-unit-${file.id}" class="target-unit-select" ${isCompressing ? 'disabled' : ''} aria-label="Target unit">
                        <option value="KB" ${file.targetUnit === 'KB' ? 'selected' : ''}>KB</option>
                        <option value="MB" ${file.targetUnit === 'MB' ? 'selected' : ''}>MB</option>
                    </select>
                    <div class="target-controls-buttons">
                        <button class="btn btn-primary btn-small btn-apply" ${isCompressing ? 'disabled' : ''}>Apply</button>
                        <button class="btn-link btn-reset" ${isCompressing ? 'disabled' : ''}>Reset</button>
                    </div>
                </div>` : '<div></div>'}

                <div class="card-status-and-actions">
                    <div class="card-status" role="status">${statusHTML}</div>
                    <div class="card-actions">
                        ${isDone && file.compressedUrl ? `
                        <a href="${file.compressedUrl}" download="compressed-${file.originalFile.name}" class="btn-icon" title="Download compressed image" aria-label="Download compressed image">
                            <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        </a>` : ''}
                        <button class="btn-icon remove btn-remove" title="Remove image" aria-label="Remove image">
                           <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return card;
    };

    const updateGlobalUI = () => {
        const anyCompressing = imageFilesState.some(f => f.status === 'compressing');
        const anyDone = imageFilesState.some(f => f.status === 'done');
        downloadAllBtn.disabled = anyCompressing || !anyDone;
        applyToAllBtn.disabled = anyCompressing;
        clearAllBtn.disabled = anyCompressing;
        
        const readyToDownloadCount = imageFilesState.filter(f => f.status === 'done' && f.compressedFile).length;
        if (readyToDownloadCount > 0) {
            downloadCountBadge.textContent = String(readyToDownloadCount);
            downloadCountBadge.style.display = 'flex';
        } else {
            downloadCountBadge.style.display = 'none';
        }
    };
    
    const runCompressionForId = (id: number) => {
        const fileState = imageFilesState.find(f => f.id === id);
        if (!fileState) return;

        const multiplier = fileState.targetUnit === 'MB' ? 1024 * 1024 : 1024;
        const targetBytes = fileState.targetSize * multiplier;
        compressToTargetSize(id, targetBytes);
    };

    const processFiles = (files: FileList) => {
        const newFiles: ImageFileState[] = Array.from(files).map(file => ({
            id: nextId++,
            originalFile: file,
            originalUrl: URL.createObjectURL(file),
            compressedFile: null,
            compressedUrl: null,
            status: 'compressing',
            targetSize: 500,
            targetUnit: 'KB',
        }));

        imageFilesState.push(...newFiles);
        render();

        newFiles.forEach(file => runCompressionForId(file.id));
    };

    async function compressToTargetSize(id: number, targetSizeBytes: number, options: { suppressInitialRender?: boolean } = {}) {
        const fileState = imageFilesState.find(f => f.id === id);
        if (!fileState) return;
        
        if (!options.suppressInitialRender) {
            updateFileState(id, { status: 'compressing' });
            render();
        }

        try {
            const compressionOptions = {
                maxSizeMB: targetSizeBytes / 1024 / 1024,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            };

            const compressedFile = await imageCompression(fileState.originalFile, compressionOptions);

            updateFileState(id, {
                status: 'done',
                compressedFile: compressedFile,
                compressedUrl: URL.createObjectURL(compressedFile),
            });
        } catch (error) {
            console.error('Compression Error:', error);
            updateFileState(id, { status: 'error' });
        }
        render();
    }

    // --- Event Handlers ---
    const handleAddFilesClick = () => fileInput.click();
    const handleUploadZoneClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.id === 'upload-zone' || target.closest('#select-images-btn') || target.classList.contains('upload-hint')) {
             fileInput.click();
        }
    };

    const handleFileChange = (e: Event) => processFiles((e.target as HTMLInputElement).files!);

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('dragover');
    };
    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('dragover');
    };
    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('dragover');
        processFiles(e.dataTransfer!.files);
    };

    const handleRemoveImage = (id: number) => {
        const file = imageFilesState.find(f => f.id === id);
        if (file) {
            URL.revokeObjectURL(file.originalUrl);
            if (file.compressedUrl) {
                URL.revokeObjectURL(file.compressedUrl);
            }
        }
        imageFilesState = imageFilesState.filter(f => f.id !== id);
        render();
    };

    const handleTargetSizeApply = (id: number, newSize: number, newUnit: SizeUnit) => {
        updateFileState(id, { targetSize: newSize, targetUnit: newUnit });
        runCompressionForId(id);
    };

    const handleReset = (id: number) => {
        const fileState = imageFilesState.find(f => f.id === id);
        if(!fileState) return;

        if (fileState.compressedUrl) {
           URL.revokeObjectURL(fileState.compressedUrl);
        }

        updateFileState(id, {
            compressedFile: null,
            compressedUrl: null,
            targetSize: 500, // Reset to default
            targetUnit: 'KB'
        });
        
        runCompressionForId(id);
    };

    const handleApplyToAll = () => {
        const newSize = parseFloat(globalTargetSizeInput.value);
        const newUnit = globalTargetUnitSelect.value as SizeUnit;
        if (isNaN(newSize) || newSize <= 0) {
            globalTargetSizeInput.focus();
            return;
        }

        const filesToUpdate = imageFilesState.filter(f => f.status !== 'error');
        if (filesToUpdate.length === 0) return;

        // Batch update state for a single render
        filesToUpdate.forEach(file => {
            updateFileState(file.id, {
                targetSize: newSize,
                targetUnit: newUnit,
                status: 'compressing'
            });
        });
        render(); // Render all cards with spinners at once

        // Start compression jobs without causing more renders initially
        filesToUpdate.forEach(file => {
            const multiplier = newUnit === 'MB' ? 1024 * 1024 : 1024;
            const targetBytes = newSize * multiplier;
            compressToTargetSize(file.id, targetBytes, { suppressInitialRender: true });
        });
    };
    
    const handleClearAll = () => {
        imageFilesState.forEach(file => {
            URL.revokeObjectURL(file.originalUrl);
            if (file.compressedUrl) URL.revokeObjectURL(file.compressedUrl);
        });
        imageFilesState = [];
        nextId = 0;
        render();
    };

    const handleDownloadAll = async () => {
        const zip = new JSZip();
        downloadAllDefault.style.display = 'none';
        downloadAllZipping.style.display = 'inline-flex';
        downloadAllBtn.disabled = true;

        const filesToZip = imageFilesState.filter(f => f.status === 'done' && f.compressedFile);

        filesToZip.forEach(file => {
            zip.file(`compressed-${file.originalFile.name}`, file.compressedFile!);
        });
        
        try {
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = "compressed-images.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Error zipping files:", error);
            alert("There was an error creating the ZIP file.");
        } finally {
            downloadAllDefault.style.display = 'inline-flex';
            downloadAllZipping.style.display = 'none';
            downloadAllBtn.disabled = false;
        }
    };
    
    // --- Event Delegation for Result Cards ---
    resultsList.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const card = target.closest<HTMLElement>('.result-card');
        if (!card || !card.dataset.id) return;
        
        const id = parseInt(card.dataset.id, 10);

        if (target.closest('.btn-remove')) {
            handleRemoveImage(id);
        } else if (target.closest('.btn-apply')) {
            const sizeInput = card.querySelector<HTMLInputElement>(`#target-size-${id}`);
            const unitSelect = card.querySelector<HTMLSelectElement>(`#target-unit-${id}`);
            if (sizeInput && unitSelect) {
                handleTargetSizeApply(id, parseFloat(sizeInput.value), unitSelect.value as SizeUnit);
            }
        } else if (target.closest('.btn-reset')) {
            handleReset(id);
        }
    });

    // --- Initial Setup ---
    uploadZone.addEventListener('click', handleUploadZoneClick);
    fileInput.addEventListener('change', handleFileChange);
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    addMoreBtn.addEventListener('click', handleAddFilesClick);
    downloadAllBtn.addEventListener('click', handleDownloadAll);
    clearAllBtn.addEventListener('click', handleClearAll);
    applyToAllBtn.addEventListener('click', handleApplyToAll);
});
const uploadEndpoint = "/.netlify/functions/upload";
const listEndpoint = "/.netlify/functions/list";
const noteEndpoint = "/.netlify/functions/note";
const deleteEndpoint = "/.netlify/functions/delete";
const downloadEndpoint = "/.netlify/functions/download";

const sharedNoteInput = document.getElementById("sharednote");
const syncStatus = document.getElementById("sync-status");
const statusIndicator = document.getElementById("status-indicator");
const noteStats = document.getElementById("note-stats");
const fileCountBadge = document.getElementById("file-count-badge");
const saveBtn = document.getElementById("save-btn");

let isDirty = false;
let currentPreviewContent = "";

// Helper for POST requests
async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let message = "";
        try {
            const data = await response.json();
            message = data?.error || data?.message;
        } catch {
            message = await response.text();
        }
        throw new Error(message || "Request failed");
    }

    return response;
}

// Status indicator management
function setStatus(message, state = "idle") {
    if (syncStatus) {
        syncStatus.textContent = message;
    }
    if (statusIndicator) {
        statusIndicator.className = "status-indicator";
        if (state) {
            statusIndicator.classList.add(state);
        }
    }
}

// Note content helpers
function getSharedNoteValue() {
    return sharedNoteInput ? sharedNoteInput.value : "";
}

function setSharedNoteValue(value) {
    if (sharedNoteInput) {
        sharedNoteInput.value = value;
        updateNoteStats();
    }
}

function updateNoteStats() {
    if (!noteStats || !sharedNoteInput) return;
    const text = sharedNoteInput.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    noteStats.textContent = `${words} word${words === 1 ? '' : 's'} • ${chars} char${chars === 1 ? '' : 's'}`;
}

// Load shared note
async function loadSharedNote(force = false) {
    setStatus("Fetching note...", "saving");

    try {
        const response = await fetch(noteEndpoint);

        if (!response.ok) {
            throw new Error("Could not load shared note");
        }

        const data = await response.json();
        const remoteValue = data.content || "";

        // If force is true or the local note is clean and unfocused
        if (sharedNoteInput) {
            const shouldSet = force || (!isDirty && document.activeElement !== sharedNoteInput);
            if (shouldSet) {
                setSharedNoteValue(remoteValue);
            }
        }

        isDirty = false;
        const timeStr = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
        setStatus(`Synced (${timeStr})`, "synced");
    } catch (error) {
        setStatus(error.message || "Failed to load note", "error");
    }
}

// Save shared note (Manual save only)
async function saveSharedNote() {
    const content = getSharedNoteValue();
    setStatus("Saving note...", "saving");
    if (saveBtn) saveBtn.disabled = true;

    try {
        const response = await postJson(noteEndpoint, { content });
        const data = await response.json();

        isDirty = false;
        const timeStr = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
        setStatus(`Saved at ${timeStr}`, "synced");
        showToast("Note saved to vault", "success");
    } catch (error) {
        setStatus(error.message || "Save failed", "error");
        showToast(error.message || "Save failed", "error");
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// Manual Refresh
function refreshSharedNote() {
    setStatus("Refreshing...", "saving");
    loadSharedNote(true)
        .then(() => {
            showToast("Note refreshed", "info");
        })
        .catch((error) => {
            showToast(error.message || "Refresh failed", "error");
        });
}

// Clear note
function clearSharedNote() {
    if (!sharedNoteInput || !sharedNoteInput.value) return;
    if (confirm("Are you sure you want to clear the note? Remember to click 'Save now' to commit the change.")) {
        sharedNoteInput.value = "";
        updateNoteStats();
        isDirty = true;
        setStatus("Unsaved changes (cleared)", "dirty");
        sharedNoteInput.focus();
    }
}

// Copy note to clipboard
async function copySharedNote() {
    const text = getSharedNoteValue();

    if (!text) {
        showToast("Nothing to copy", "info");
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        showToast("Note copied to clipboard", "success");
    } catch {
        showToast("Failed to copy", "error");
    }
}

// Handle note typing
if (sharedNoteInput) {
    sharedNoteInput.addEventListener("input", () => {
        isDirty = true;
        updateNoteStats();
        setStatus("Unsaved changes", "dirty");
    });

    // Keyboard shortcut: Ctrl+Enter / Cmd+Enter to save
    sharedNoteInput.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            saveSharedNote();
        }
    });

    loadSharedNote();
}

// File category icons
function getCategoryIcon(type) {
    switch (type) {
        case "image": return "🖼️";
        case "video": return "🎬";
        case "audio": return "🎵";
        case "pdf": return "📄";
        case "text": return "📝";
        case "archive": return "📦";
        case "doc": return "📑";
        default: return "📁";
    }
}

// Load Files List
async function loadFiles() {
    const list = document.getElementById("files");
    if (!list) return;

    list.innerHTML = "";
    const loadingItem = document.createElement("li");
    loadingItem.className = "muted-item";
    loadingItem.textContent = "Loading vault files...";
    list.appendChild(loadingItem);

    try {
        const response = await fetch(listEndpoint);
        if (!response.ok) {
            throw new Error("Could not load files");
        }

        const files = await response.json();
        list.innerHTML = "";

        if (fileCountBadge) {
            fileCountBadge.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;
        }

        if (!files.length) {
            const emptyItem = document.createElement("li");
            emptyItem.className = "muted-item";
            emptyItem.textContent = "No files uploaded yet. Drop files above to transfer.";
            list.appendChild(emptyItem);
            return;
        }

        files.forEach((file) => {
            const li = document.createElement("li");
            li.className = "file-row";

            const infoGroup = document.createElement("div");
            infoGroup.className = "file-info-group";

            const icon = document.createElement("span");
            icon.className = "file-type-icon";
            icon.textContent = getCategoryIcon(file.type);
            infoGroup.appendChild(icon);

            const details = document.createElement("div");
            details.className = "file-details";

            const name = document.createElement("span");
            name.className = "file-name";
            name.textContent = file.name;
            name.title = file.name;
            details.appendChild(name);

            const meta = document.createElement("span");
            meta.className = "file-meta";
            meta.textContent = `${file.formattedSize || 'Unknown size'} • ${(file.type || 'file').toUpperCase()}`;
            details.appendChild(meta);

            infoGroup.appendChild(details);
            li.appendChild(infoGroup);

            // Actions group
            const actions = document.createElement("div");
            actions.className = "file-actions";

            // Preview Button
            const previewBtn = document.createElement("button");
            previewBtn.type = "button";
            previewBtn.className = "button button--secondary button--sm";
            previewBtn.textContent = "Preview";
            previewBtn.onclick = () => openPreviewModal(file);
            actions.appendChild(previewBtn);

            // Download Link
            const downloadLink = document.createElement("a");
            downloadLink.href = `${downloadEndpoint}?path=${encodeURIComponent(file.path)}&mode=download`;
            downloadLink.download = file.name;
            downloadLink.className = "button button--secondary button--sm";
            downloadLink.textContent = "Download";
            actions.appendChild(downloadLink);

            // Delete Button
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "button button--danger-ghost button--sm";
            deleteBtn.textContent = "Delete";
            deleteBtn.onclick = () => deleteFile(file.name);
            actions.appendChild(deleteBtn);

            li.appendChild(actions);
            list.appendChild(li);
        });
    } catch (error) {
        list.innerHTML = "";
        const errorItem = document.createElement("li");
        errorItem.className = "muted-item";
        errorItem.textContent = error.message || "Failed to load files";
        list.appendChild(errorItem);
    }
}

// Delete file
async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}" from the vault?`)) {
        return;
    }

    showToast(`Deleting ${filename}...`, "info");

    try {
        await postJson(deleteEndpoint, { filename });
        showToast(`Deleted ${filename}`, "success");
        await loadFiles();
    } catch (error) {
        showToast(error.message || "Delete failed", "error");
    }
}

// Staged Files Queue Management
let stagedFiles = [];

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileTypeFromName(filename) {
    const ext = (filename.split(".").pop() || "").toLowerCase();
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"];
    const videoExts = ["mp4", "webm", "ogg", "mov", "mkv", "avi"];
    const audioExts = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
    const pdfExts = ["pdf"];
    const textExts = ["txt", "md", "csv", "log", "json", "xml", "yaml", "yml", "js", "ts", "html", "css", "py", "sh", "sql", "c", "cpp", "java", "rs", "go"];
    const archiveExts = ["zip", "rar", "tar", "gz", "7z", "bz2"];
    const docExts = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

    if (imageExts.includes(ext)) return "image";
    if (videoExts.includes(ext)) return "video";
    if (audioExts.includes(ext)) return "audio";
    if (pdfExts.includes(ext)) return "pdf";
    if (textExts.includes(ext)) return "text";
    if (archiveExts.includes(ext)) return "archive";
    if (docExts.includes(ext)) return "doc";
    return "other";
}

function stageFiles(filesToAdd) {
    if (!filesToAdd || !filesToAdd.length) return;

    const MAX_FILE_BYTES = 5.5 * 1024 * 1024; // 5.5MB limit
    let addedCount = 0;
    let oversizedCount = 0;

    const fileMap = new Map();
    stagedFiles.forEach(f => fileMap.set(f.name, f));

    Array.from(filesToAdd).forEach(file => {
        if (file.size > MAX_FILE_BYTES) {
            oversizedCount++;
            return;
        }
        if (!fileMap.has(file.name)) {
            fileMap.set(file.name, file);
            addedCount++;
        }
    });

    stagedFiles = Array.from(fileMap.values());
    renderStagedFiles();

    if (oversizedCount > 0) {
        showToast(`${oversizedCount} file(s) skipped (exceeds 5.5MB limit)`, "error", 4000);
    }
    if (addedCount > 0) {
        showToast(`${addedCount} file(s) staged for upload`, "info");
    }
}

function removeStagedFile(index) {
    if (index >= 0 && index < stagedFiles.length) {
        stagedFiles.splice(index, 1);
        renderStagedFiles();
    }
}

function clearStagedFiles() {
    stagedFiles = [];
    const fileInput = document.getElementById("file");
    if (fileInput) fileInput.value = "";
    renderStagedFiles();
}

function renderStagedFiles() {
    const stagedTray = document.getElementById("staged-tray");
    const stagedSummary = document.getElementById("staged-summary");
    const stagedList = document.getElementById("staged-list");
    const uploadBtnText = document.getElementById("upload-button-text");
    const fileInput = document.getElementById("file");

    if (!stagedTray || !stagedList) return;

    if (stagedFiles.length === 0) {
        stagedTray.classList.add("hidden");
        if (fileInput) fileInput.value = "";
        return;
    }

    stagedTray.classList.remove("hidden");

    const totalBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    const count = stagedFiles.length;
    if (stagedSummary) {
        stagedSummary.textContent = `${count} file${count === 1 ? '' : 's'} staged (${formatBytes(totalBytes)} total)`;
    }

    if (uploadBtnText) {
        uploadBtnText.textContent = `Upload ${count} file${count === 1 ? '' : 's'}`;
    }

    stagedList.innerHTML = "";
    stagedFiles.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "staged-item";

        const info = document.createElement("div");
        info.className = "staged-item-info";

        const icon = document.createElement("span");
        icon.className = "file-type-icon";
        icon.style.fontSize = "1rem";
        icon.textContent = getCategoryIcon(getFileTypeFromName(file.name));
        info.appendChild(icon);

        const name = document.createElement("span");
        name.className = "staged-item-name";
        name.textContent = file.name;
        name.title = file.name;
        info.appendChild(name);

        const size = document.createElement("span");
        size.className = "staged-item-size";
        size.textContent = formatBytes(file.size);
        info.appendChild(size);

        item.appendChild(info);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "staged-item-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = "Remove from queue";
        removeBtn.onclick = () => removeStagedFile(index);
        item.appendChild(removeBtn);

        stagedList.appendChild(item);
    });
}

// Upload all staged files
async function uploadStagedFiles() {
    if (!stagedFiles.length) {
        showToast("No files staged to upload", "info");
        return;
    }

    const uploadBtn = document.getElementById("upload-button");
    const spinner = document.getElementById("upload-spinner");
    const btnText = document.getElementById("upload-button-text");

    if (uploadBtn) uploadBtn.disabled = true;
    if (spinner) spinner.classList.remove("hidden");

    const total = stagedFiles.length;
    let successCount = 0;

    try {
        for (let i = 0; i < total; i++) {
            const file = stagedFiles[i];
            if (btnText) btnText.textContent = `Uploading (${i + 1}/${total})...`;
            await uploadFileFromFile(file);
            successCount++;
        }

        clearStagedFiles();
        showToast(`Uploaded ${successCount} file${successCount === 1 ? '' : 's'} to vault`, "success");
        await loadFiles();
    } catch (error) {
        showToast(error?.message || "Upload failed", "error");
    } finally {
        if (uploadBtn) uploadBtn.disabled = false;
        if (spinner) spinner.classList.add("hidden");
        if (btnText) btnText.textContent = "Upload files";
    }
}

async function uploadFileFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64 = reader.result.split(",")[1];
                await postJson(uploadEndpoint, {
                    filename: file.name,
                    content: base64
                });
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
        reader.readAsDataURL(file);
    });
}

// Drag & Drop handlers
const dropZone = document.getElementById("drop-zone");
if (dropZone) {
    const fileInput = document.getElementById("file");

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length) {
                stageFiles(fileInput.files);
            }
        });
    }

    dropZone.addEventListener("click", (e) => {
        if (e.target.closest(".button")) return;
        if (fileInput) fileInput.click();
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        const dt = e.dataTransfer;
        if (!dt || !dt.files || !dt.files.length) return;
        stageFiles(dt.files);
    });
}

// In-Browser Preview Modal Logic
const previewModal = document.getElementById("preview-modal");
const modalTitle = document.getElementById("modal-title");
const modalTypeBadge = document.getElementById("modal-type-badge");
const modalSizeBadge = document.getElementById("modal-size-badge");
const modalBody = document.getElementById("modal-body");
const modalCopyBtn = document.getElementById("modal-copy-btn");
const modalDownloadLink = document.getElementById("modal-download-link");

async function openPreviewModal(file) {
    if (!previewModal || !modalBody) return;

    modalTitle.textContent = file.name;
    modalTypeBadge.textContent = (file.type || "file").toUpperCase();
    modalSizeBadge.textContent = file.formattedSize || "";
    modalBody.innerHTML = '<div class="preview-generic"><div class="spinner"></div><p>Loading preview...</p></div>';
    
    if (modalCopyBtn) modalCopyBtn.classList.add("hidden");
    currentPreviewContent = "";

    const viewUrl = `${downloadEndpoint}?path=${encodeURIComponent(file.path)}&mode=view`;
    const downloadUrl = `${downloadEndpoint}?path=${encodeURIComponent(file.path)}&mode=download`;

    if (modalDownloadLink) {
        modalDownloadLink.href = downloadUrl;
        modalDownloadLink.download = file.name;
    }

    previewModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    try {
        switch (file.type) {
            case "image": {
                const img = document.createElement("img");
                img.className = "preview-img";
                img.src = viewUrl;
                img.alt = file.name;
                img.onload = () => {
                    modalBody.innerHTML = "";
                    modalBody.appendChild(img);
                };
                img.onerror = () => {
                    modalBody.innerHTML = '<div class="preview-generic"><div class="preview-generic-icon">⚠️</div><p>Unable to load image preview.</p></div>';
                };
                break;
            }
            case "pdf": {
                const iframe = document.createElement("iframe");
                iframe.className = "preview-pdf";
                iframe.src = viewUrl;
                modalBody.innerHTML = "";
                modalBody.appendChild(iframe);
                break;
            }
            case "audio": {
                const audio = document.createElement("audio");
                audio.className = "preview-audio";
                audio.controls = true;
                audio.autoplay = true;
                audio.src = viewUrl;
                modalBody.innerHTML = "";
                modalBody.appendChild(audio);
                break;
            }
            case "video": {
                const video = document.createElement("video");
                video.className = "preview-video";
                video.controls = true;
                video.autoplay = true;
                video.src = viewUrl;
                modalBody.innerHTML = "";
                modalBody.appendChild(video);
                break;
            }
            case "text": {
                const resp = await fetch(viewUrl);
                if (!resp.ok) throw new Error("Could not fetch file text");
                const text = await resp.text();
                currentPreviewContent = text;

                const pre = document.createElement("pre");
                pre.className = "preview-text";
                pre.textContent = text;

                modalBody.innerHTML = "";
                modalBody.appendChild(pre);

                if (modalCopyBtn) modalCopyBtn.classList.remove("hidden");
                break;
            }
            default: {
                modalBody.innerHTML = `
                    <div class="preview-generic">
                        <div class="preview-generic-icon">${getCategoryIcon(file.type)}</div>
                        <p>Direct in-browser preview is not supported for this file type.</p>
                        <p style="font-size:0.85rem; color:var(--text-dim);">Use the Download button below to open it locally.</p>
                    </div>
                `;
                break;
            }
        }
    } catch (err) {
        modalBody.innerHTML = `<div class="preview-generic"><div class="preview-generic-icon">⚠️</div><p>${err.message || 'Failed to preview file'}</p></div>`;
    }
}

function closePreviewModal() {
    if (!previewModal) return;
    previewModal.classList.add("hidden");
    document.body.style.overflow = "";
    if (modalBody) modalBody.innerHTML = "";
}

function handleModalBackdropClick(event) {
    if (event.target === previewModal) {
        closePreviewModal();
    }
}

// Copy preview text
async function copyPreviewContent() {
    if (!currentPreviewContent) return;
    try {
        await navigator.clipboard.writeText(currentPreviewContent);
        showToast("File content copied to clipboard", "success");
    } catch {
        showToast("Failed to copy", "error");
    }
}

// Keyboard shortcuts for modal
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && previewModal && !previewModal.classList.contains("hidden")) {
        closePreviewModal();
    }
});

// Toast notification helper
function showToast(message, type = "info", timeout = 3000) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("toast--show"));

    setTimeout(() => {
        toast.classList.remove("toast--show");
        setTimeout(() => toast.remove(), 250);
    }, timeout);
}

// Initial file load
loadFiles();

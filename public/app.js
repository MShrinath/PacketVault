const uploadEndpoint = "/.netlify/functions/upload";
const listEndpoint = "/.netlify/functions/list";
const noteEndpoint = "/.netlify/functions/note";

const sharedNoteInput = document.getElementById("sharednote");
const syncStatus = document.getElementById("sync-status");

let isDirty = false;

async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
    }

    return response;
}

function setStatus(message) {
    if (syncStatus) {
        syncStatus.textContent = message;
    }
}

function getSharedNoteValue() {
    return sharedNoteInput ? sharedNoteInput.value : "";
}

function setSharedNoteValue(value) {
    if (sharedNoteInput) {
        sharedNoteInput.value = value;
    }
}

async function loadSharedNote(force = false) {
    const response = await fetch(noteEndpoint);

    if (!response.ok) {
        throw new Error("Could not load shared note");
    }

    const data = await response.json();
    const remoteValue = data.content || "";

    // If force is true, overwrite the local field even if dirty.
    if (sharedNoteInput) {
        const shouldSet = force || (!isDirty && document.activeElement !== sharedNoteInput && remoteValue !== getSharedNoteValue());
        if (shouldSet) {
            setSharedNoteValue(remoteValue);
        }
    }

    setStatus(data.updatedAt ? `Synced ${new Date(data.updatedAt).toLocaleString()}` : "Synced");
}

async function saveSharedNote() {
    const content = getSharedNoteValue();

    setStatus("Saving...");

    try {
        const response = await postJson(noteEndpoint, { content });
        const data = await response.json();

        isDirty = false;
        setStatus(data.updatedAt ? `Saved ${new Date(data.updatedAt).toLocaleString()}` : "Saved");
    } catch (error) {
        setStatus(error.message);
    }
}

function refreshSharedNote() {
    setStatus('Refreshing...');
    loadSharedNote(true).then(() => {
        setStatus('Refreshed');
        setTimeout(() => {
            setStatus(isDirty ? 'Unsaved changes' : '');
        }, 1000);
    }).catch((error) => {
        setStatus(error.message);
    });
}

async function copySharedNote() {
    const text = getSharedNoteValue();

    if (!text) {
        setStatus('Nothing to copy');
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }

        const prev = syncStatus ? syncStatus.textContent : '';
        setStatus('Copied to clipboard');
        window.setTimeout(() => {
            setStatus(prev || (isDirty ? 'Unsaved changes' : ''));
        }, 1800);
    } catch (err) {
        setStatus('Copy failed');
    }
}

function scheduleSharedSave() {
    // Mark the note dirty but do not auto-save.
    // Saving will occur only when the user clicks "Save now".
    isDirty = true;
    setStatus("Unsaved changes");
}

async function uploadFile() {
    const fileInput = document.getElementById("file");
    const files = fileInput.files && fileInput.files.length ? Array.from(fileInput.files) : [];

    if (!files.length) {
        showToast("Choose a file first.", 'info');
        return;
    }

    try {
        for (const file of files) {
            await uploadFileFromFile(file);
        }
        fileInput.value = "";
        showToast('Uploaded', 'success');
        await loadFiles();
    } catch (error) {
        showToast(error?.message || 'Upload failed', 'error');
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
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(file);
        });
    }


async function loadFiles() {
    const list = document.getElementById("files");
    list.innerHTML = "";
    const loadingItem = document.createElement("li");
    loadingItem.className = "muted";
    loadingItem.textContent = "Loading...";
    list.appendChild(loadingItem);

    try {
        const response = await fetch(listEndpoint);
        if (!response.ok) {
            throw new Error("Could not load files");
        }

        const files = await response.json();
        list.innerHTML = "";

        if (!files.length) {
            const emptyItem = document.createElement("li");
            emptyItem.className = "muted";
            emptyItem.textContent = "No files yet.";
            list.appendChild(emptyItem);
            return;
        }

        files.forEach((file) => {
            const li = document.createElement("li");
            const link = document.createElement("a");
            // Use Netlify download proxy so files are served from Netlify instead of direct GitHub URLs
            link.href = '/.netlify/functions/download?path=' + encodeURIComponent(file.path);
            link.setAttribute('download', file.name);
            link.target = "_blank";
            link.rel = "noreferrer";
            link.textContent = file.name;
            li.appendChild(link);
            list.appendChild(li);
        });
    } catch (error) {
        list.innerHTML = "";
        const errorItem = document.createElement("li");
        errorItem.className = "muted";
        errorItem.textContent = error.message;
        list.appendChild(errorItem);
    }
}

if (sharedNoteInput) {
    sharedNoteInput.addEventListener("input", scheduleSharedSave);

    loadSharedNote().catch((error) => {
        setStatus(error.message);
    });

    window.setInterval(() => {
        if (!isDirty) {
            refreshSharedNote();
        }
    }, 4000);
}

loadFiles();

// Drag & drop handlers for file uploads
const dropZone = document.getElementById('drop-zone');
if (dropZone) {
    const fileInput = document.getElementById('file');
    const dropHint = document.getElementById('drop-hint');

    // Update hint when files are selected via picker
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const list = fileInput.files && fileInput.files.length ? Array.from(fileInput.files).map(f => f.name).join(', ') : '';
            dropHint.textContent = list || 'Drag & drop files here, or click to choose';
        });
    }

    // Click on the drop zone (not the Upload button) opens the file picker
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('.button')) return; // clicked the upload button
        if (fileInput) fileInput.click();
    });
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const dt = e.dataTransfer;
        if (!dt) return;
        const files = Array.from(dt.files || []);
        if (!files.length) return;
        // Put dropped files into the file input so the user can review and
        // click "Upload" to submit them explicitly.
        if (fileInput) {
            try {
                // Merge existing staged files with newly dropped files, de-duplicate by name
                const existing = fileInput.files && fileInput.files.length ? Array.from(fileInput.files) : [];
                const map = new Map();
                existing.forEach(f => map.set(f.name, f));
                files.forEach(f => {
                    if (!map.has(f.name)) map.set(f.name, f);
                });

                const data = new DataTransfer();
                Array.from(map.values()).forEach(f => data.items.add(f));
                fileInput.files = data.files;

                const names = Array.from(map.keys()).join(', ');
                dropHint.textContent = names || 'Drag & drop files here, or click to choose';
                showToast('Files staged — click Upload to send', 'info');
            } catch (err) {
                showToast(err?.message || 'Unable to prepare files', 'error');
            }
        }
    });
}

    // Toast helper
    function showToast(message, type = 'info', timeout = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // allow CSS transition
        requestAnimationFrame(() => toast.classList.add('toast--show'));

        setTimeout(() => {
            toast.classList.remove('toast--show');
            setTimeout(() => toast.remove(), 200);
        }, timeout);
    }

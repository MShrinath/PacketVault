const uploadEndpoint = "/.netlify/functions/upload";
const listEndpoint = "/.netlify/functions/list";
const noteEndpoint = "/.netlify/functions/note";

const sharedNoteInput = document.getElementById("sharednote");
const syncStatus = document.getElementById("sync-status");

let saveTimer = null;
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

async function loadSharedNote() {
    const response = await fetch(noteEndpoint);

    if (!response.ok) {
        throw new Error("Could not load shared note");
    }

    const data = await response.json();
    const remoteValue = data.content || "";

    if (sharedNoteInput && !isDirty && document.activeElement !== sharedNoteInput && remoteValue !== getSharedNoteValue()) {
        setSharedNoteValue(remoteValue);
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
    loadSharedNote().catch((error) => {
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
    isDirty = true;
    setStatus("Unsaved changes");

    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        saveSharedNote();
    }, 700);
}

async function uploadFile() {
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!file) {
        alert("Choose a file first.");
        return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
        try {
            const base64 = reader.result.split(",")[1];
            await postJson(uploadEndpoint, {
                filename: file.name,
                content: base64
            });
            fileInput.value = "";
            alert("Uploaded");
            await loadFiles();
        } catch (error) {
            alert(error.message);
        }
    };

    reader.readAsDataURL(file);
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
            link.href = file.download_url;
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
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const branch = process.env.GITHUB_BRANCH;
const uploadsDir = (process.env.UPLOADS_DIR || "uploads").replace(/^\/+|\/+$/g, "");
const notePath = (process.env.NOTE_PATH || `${uploadsDir}/.sharednote.txt`).replace(/^\/+/g, "");
const noteFilename = notePath.split("/").pop();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function normalizeFilename(filename) {
  const cleaned = String(filename || "").trim().replace(/\\/g, "/").split("/").pop();
  return cleaned;
}

async function getFileSha(path) {
  const query = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || "Failed to locate file");
  }

  return payload?.sha || null;
}

exports.handler = async (event) => {
  if (!owner || !repo || !token) {
    return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
  }

  if (event.httpMethod !== "POST" && event.httpMethod !== "DELETE") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON payload" });
  }

  const filename = normalizeFilename(payload.filename || payload.name || payload.path);
  if (!filename) {
    return json(400, { error: "Filename is required" });
  }

  // Prevent deleting hidden files, traversing directories, or deleting the shared note via file delete
  if (filename.startsWith(".") || filename.includes("..") || filename === noteFilename) {
    return json(400, { error: "Invalid filename" });
  }

  try {
    const filePath = `${uploadsDir}/${filename}`;
    const sha = await getFileSha(filePath);

    if (!sha) {
      return json(404, { error: "File not found" });
    }

    const deleteUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
    const bodyData = {
      message: `Delete ${filename} via PacketVault`,
      sha: sha
    };
    if (branch) {
      bodyData.branch = branch;
    }

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyData)
    });

    const responseBody = await response.json();

    if (!response.ok) {
      return json(response.status, {
        error: responseBody?.message || "Failed to delete file",
        details: responseBody
      });
    }

    return json(200, {
      success: true,
      message: `Deleted ${filename}`,
      name: filename
    });
  } catch (error) {
    return json(500, { error: error.message || "Failed to delete file" });
  }
};

const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const branch = process.env.GITHUB_BRANCH;
const uploadsDir = (process.env.UPLOADS_DIR || "uploads").replace(/^\/+|\/+$/g, "");

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

function getPathParts(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function getMimeType(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mimeTypes = {
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    avif: "image/avif",
    // Documents
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    json: "application/json; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    html: "text/plain; charset=utf-8", // text/plain to avoid XSS execution in downloads
    css: "text/css; charset=utf-8",
    js: "text/plain; charset=utf-8",
    // Media
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    // Archives
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
    "7z": "application/x-7z-compressed"
  };

  return mimeTypes[ext] || "application/octet-stream";
}

exports.handler = async (event) => {
  if (!owner || !repo || !token) {
    return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
  }

  const qs = event.queryStringParameters || {};
  let path = qs.path || qs.name || null;
  const mode = String(qs.mode || "download").toLowerCase();

  if (!path) return json(400, { error: "Missing path or name query parameter" });

  path = path.replace(/^\/+/g, "");
  if (!path.startsWith(`${uploadsDir}/`)) {
    path = `${uploadsDir}/${path}`;
  }

  if (path.includes("..")) {
    return json(400, { error: "Invalid path" });
  }

  if (!["view", "download"].includes(mode)) return json(400, { error: "Invalid mode" });

  try {
    const ghPath = getPathParts(path);
    const query = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${ghPath}${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw"
      }
    });

    if (ghResp.status === 404) return json(404, { error: "Not found" });
    if (!ghResp.ok) {
      const data = await ghResp.json().catch(() => ({}));
      return json(ghResp.status || 500, { error: data.message || "GitHub error" });
    }

    const arrayBuf = await ghResp.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const filename = decodeURIComponent(path.split("/").pop() || "download");
    const disposition = mode === "view" ? "inline" : "attachment";
    const contentType = getMimeType(filename);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "public, max-age=300"
      },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};

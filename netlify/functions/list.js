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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileType(filename) {
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

exports.handler = async (event) => {
  if (!owner || !repo || !token) {
    return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const query = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(uploadsDir)}${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (response.status === 404) {
      return json(200, []);
    }

    const payload = await response.json();

    if (!response.ok) {
      return json(response.status, { error: payload?.message || "Failed to load files" });
    }

    const files = Array.isArray(payload)
      ? payload
          .filter((item) => item.type === "file")
          // Exclude hidden files (e.g. .sharednote.txt, .gitkeep) and the configured shared note file
          .filter((item) => !item.name.startsWith(".") && item.name !== noteFilename)
          .map((item) => ({
            name: item.name,
            path: item.path,
            size: item.size,
            formattedSize: formatBytes(item.size),
            type: getFileType(item.name),
            sha: item.sha,
            download_url: item.download_url
          }))
          .reverse() // Newest uploads first
      : [];

    return json(200, files);
  } catch (error) {
    return json(500, { error: error.message || "Failed to load files" });
  }
};
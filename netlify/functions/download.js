const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;

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

function getDisposition(mode) {
  return mode === "view" ? "inline" : "attachment";
}

exports.handler = async (event) => {
  if (!owner || !repo || !token) {
    return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
  }

  const qs = event.queryStringParameters || {};
  const path = qs.path || (qs.name ? `uploads/${qs.name}` : null);
  const mode = String(qs.mode || "download").toLowerCase();

  if (!path) return json(400, { error: "Missing path or name query parameter" });
  if (!path.startsWith("uploads/")) return json(400, { error: "Invalid path" });
  if (!["view", "download"].includes(mode)) return json(400, { error: "Invalid mode" });

  try {
    const ghPath = getPathParts(path);
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${ghPath}`, {
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
    const contentType = ghResp.headers.get("content-type") || "application/octet-stream";
    const filename = decodeURIComponent(path.split("/").pop() || "download");
    const disposition = getDisposition(mode);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store"
      },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};

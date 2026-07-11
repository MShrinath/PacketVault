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

exports.handler = async (event) => {
  if (!owner || !repo || !token) {
    return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
  }

  const qs = event.queryStringParameters || {};
  const path = qs.path || (qs.name ? `uploads/${qs.name}` : null);

  if (!path) return json(400, { error: "Missing path or name query parameter" });
  if (!path.startsWith('uploads/')) return json(400, { error: "Invalid path" });

  try {
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
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
    const filename = path.split('/').pop();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "no-store"
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};

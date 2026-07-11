const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const notePath = "sharednote.txt";

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

async function readCurrentNote() {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${notePath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (response.status === 404) {
    return { content: "", sha: null, updatedAt: null };
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to read note");
  }

  return {
    content: Buffer.from(data.content || "", "base64").toString("utf8"),
    sha: data.sha,
    updatedAt: null
  };
}

exports.handler = async (event) => {
  if (!owner || !repo || !token) {
    return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
  }

  try {
    if (event.httpMethod === "GET") {
      const note = await readCurrentNote();
      return json(200, note);
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    let payload;

    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON payload" });
    }

    const content = typeof payload.content === "string" ? payload.content : "";

    const current = await readCurrentNote();
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${notePath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Update shared note",
        content: Buffer.from(content, "utf8").toString("base64"),
        sha: current.sha || undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return json(response.status, {
        error: data?.message || "Failed to save note",
        details: data
      });
    }

    return json(200, {
      content,
      updatedAt: data?.commit?.committer?.date || data?.content?.updated_at || null
    });
  } catch (error) {
    return json(500, { error: error.message || "Unexpected error" });
  }
};
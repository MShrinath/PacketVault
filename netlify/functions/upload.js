const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const uploadsDir = "uploads";

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

async function getExistingSha(path) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
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
        throw new Error(payload?.message || "Failed to check existing file");
    }

    return payload?.sha || null;
}

exports.handler = async (event) => {
    if (!owner || !repo || !token) {
        return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
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

    const { filename, content } = payload;
    const safeFilename = normalizeFilename(filename);

    if (!safeFilename || !content) {
        return json(400, { error: "filename and content are required" });
    }

    try {
        const filePath = `${uploadsDir}/${safeFilename}`;
        const sha = await getExistingSha(filePath);
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Upload ${safeFilename}`,
                content,
                sha: sha || undefined
            })
        });

        const responseBody = await response.json();

        if (!response.ok) {
            return json(response.status, {
                error: responseBody?.message || "Upload failed",
                details: responseBody
            });
        }

        return json(200, {
            name: safeFilename,
            path: filePath,
            url: responseBody?.content?.download_url || null
        });
    } catch (error) {
        return json(500, { error: error.message || "Upload failed" });
    }
};
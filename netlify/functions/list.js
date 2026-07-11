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

exports.handler = async (event) => {
    if (!owner || !repo || !token) {
        return json(500, { error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN" });
    }

    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed" });
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${uploadsDir}`, {
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
                .map((item) => ({
                    name: item.name,
                    path: item.path,
                    size: item.size,
                    download_url: item.download_url
                }))
            : [];

        return json(200, files);
    } catch (error) {
        return json(500, { error: error.message || "Failed to load files" });
    }
};
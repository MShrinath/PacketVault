# PacketVault

PacketVault is a modern, lightweight phone-to-laptop and laptop-to-phone cross-device handoff app with zero database overhead.

It provides:
- **Shared Scratchpad**: Persistent note shared across all your devices with manual save (`Save now` or `Ctrl+Enter`) and instant `Refresh`.
- **In-Browser Previews**: Built-in modal viewer for images, PDFs, videos, audio, and text/code files with one-click clipboard copy.
- **File Transfer & Management**: Drag-and-drop multi-file staging tray with formatted file sizes, categories, direct download links, and instant deletion.
- **Git History Purge Workflow**: Automated GitHub Action that cleans old uploads and resets branch history to a configurable `BASE_COMMIT_HASH` to keep your repo completely clean of binary blob bloat.
- **Sleek Dark Theme**: Obsidian aesthetic with glassmorphism, responsive mobile layouts, and smooth micro-interactions.

---

## How It Works

- **Frontend**: Static client in [`public/`](file:///public) ([`index.html`](file:///public/index.html), [`app.js`](file:///public/app.js), [`style.css`](file:///public/style.css))
- **Backend**: Serverless functions in [`netlify/functions/`](file:///netlify/functions)
  - `note.js`: Reads and updates the shared note via GitHub Contents API.
  - `upload.js`: Uploads files directly into the configured uploads directory.
  - `list.js`: Lists repository uploads with sizes, types, and download links.
  - `download.js`: Streams files with proper MIME types for viewing or downloading.
  - `delete.js`: Deletes files from the vault via the GitHub API.
- **Storage**: GitHub repository contents API.

---

## Environment Variables

Configure these in your Netlify site settings (**Site configuration > Environment variables**):

### Required
- `GITHUB_OWNER`: Your GitHub username or organization name.
- `GITHUB_REPO`: The repository name used for storage.
- `GITHUB_TOKEN`: A GitHub Personal Access Token (classic token with `repo` scope, or fine-grained token with `Contents: Read and Write` permissions).

### Optional / Custom Paths
- `UPLOADS_DIR`: Directory where uploads are stored in the repo (default: `uploads`).
- `NOTE_PATH`: Path to the note file in the repo (default: `uploads/.sharednote.txt` or `${UPLOADS_DIR}/.sharednote.txt`).
- `GITHUB_BRANCH`: Target branch in the repo (default: repository default branch / `main`).

See [`.env.example`](file:///./.env.example) for reference.

---

## Deploy to Netlify

1. Push this project to a GitHub repository.
2. Import the repository into Netlify.
3. Add the required environment variables (`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`) in Netlify.
4. Deploy the site.

---

## Usage

1. Open your Netlify URL on both your phone and laptop.
2. **Notes**: Type in the scratchpad and click **Save now** (or press `Ctrl+Enter` / `Cmd+Enter`). On your other device, click **Refresh** to pull the latest note.
3. **Files**: Drag and drop or browse files. Review the staged files in the tray, then click **Upload**.
4. **Preview & Download**: Click **Preview** to view images, videos, audio, PDFs, or code/text files directly in the browser modal.
5. **Delete**: Click **Delete** to remove a file from the repository.

---

## Git History Purge & Cleanup Workflow

GitHub Actions workflow at [`.github/workflows/cleanup-uploads.yml`](file:///.github/workflows/cleanup-uploads.yml) runs daily (or manually on-demand via **Actions > Run workflow**).

### Preventing Repository Bloat with `BASE_COMMIT_HASH`

When binary files are committed via the GitHub API, Git stores the blobs in its history even after files are deleted.

To keep your repository size near 0 MB forever:
1. In your GitHub repository, go to **Settings > Secrets and variables > Actions > Variables** (or Secrets).
2. Add a variable named `BASE_COMMIT_HASH` set to your initial commit hash (e.g. the hash of your first commit).
3. When the cleanup action runs, it will soft-reset the branch back to `BASE_COMMIT_HASH`, delete temporary files from `UPLOADS_DIR`, preserve `NOTE_PATH`, and force-push a single clean commit.
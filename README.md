# PacketVault

PacketVault is a lightweight phone-to-laptop and laptop-to-phone handoff app.

It provides:
- A shared text note that auto-syncs between devices.
- Photo/file upload to a GitHub repo folder.
- A file list with direct download links.

## How it works

- Frontend: static site in `public/`
- Backend: Netlify Functions in `netlify/functions/`
- Storage: GitHub repository contents API

Shared text is stored as `uploads/shared-note.txt`.
Uploads are stored in `uploads/`.

## Environment variables

Set these in Netlify site settings:

- `GITHUB_OWNER`: GitHub username or org
- `GITHUB_REPO`: repository name used for storage
- `GITHUB_TOKEN`: GitHub token with `repo` scope

Use `.env.example` as reference.

## Deploy

1. Push this project to GitHub.
2. Connect the repo to Netlify.
3. Add the three environment variables in Netlify.
4. Deploy.

## Usage

1. Open your Netlify URL on your phone and your laptop.
2. Type in the shared textbox and wait for auto-save (or press Save now).
3. Upload photos/files from either device.
4. Open files from the list on either device.

## Notes

- Uploading a file with the same name replaces the existing one.
- The file list reads only from the `uploads/` folder.
- Keep your GitHub token private and never expose it in client-side code.

## Automatic cleanup (24 hours)

This repo includes a GitHub Actions workflow at `.github/workflows/cleanup-uploads.yml` that runs hourly and deletes files in `uploads/` older than 24 hours. It uses the built-in `GITHUB_TOKEN` and requires the workflow to have `contents: write` permissions (configured in the workflow file).

If you prefer a different approach you can:

- Use a Netlify scheduled function (requires Netlify cron support) with the same deletion logic.
- Store expiry metadata at upload time and run a lightweight cleanup that reads those timestamps instead of looking at commit history.

Be careful: deletions are permanent (they are committed to the repo). If you need recoverability, consider moving expired files to an `archive/` folder instead of deleting.
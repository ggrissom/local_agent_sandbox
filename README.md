# Local Agent Sandbox

A local-first web presentation showing how deterministic Python automations can work across approved local folders, GitHub, Google Drive / Workspace, and mobile file uploads.

## What works in this sandbox

- Real local folder selection through the browser File System Access API
- Mobile and unsupported-browser file picker fallback
- Local file inventory and deterministic folder health check
- Responsive automation dashboard
- Honest previews of GitHub, Google Drive, document, repository, and website workflows
- No AI model, account credential, or backend required

## Important architecture boundary

A hosted website cannot silently access arbitrary folders. Local access requires one of these:

1. An explicit browser folder/file picker, or
2. A separately installed local Python helper with narrowly granted folders.

The hosted dashboard can connect to cloud services using OAuth. A phone browser can select files, but persistent background folder access generally requires a native companion app.

## Run locally

```powershell
python -m http.server 5000
```

Then open `http://localhost:5000/`.

## Deploy

The project is static and deploys directly to Vercel from the GitHub repository.

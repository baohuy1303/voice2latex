# StemFlow Frontend

This directory contains the Next.js frontend for StemFlow.

## What Lives Here

- `app/page.tsx`
  - main StemFlow workspace UI
  - editor state, session selection, autosave status, chat state
- `app/components/`
  - PDF panel, editor, preview, chat bubble, selection tools
- `app/lib/api.ts`
  - frontend calls to the FastAPI backend
- `app/api/compile/route.ts`
  - local proxy route for PDF compilation

## Local Development

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Backend Dependency

The frontend expects the backend to already be running locally.

Current local assumptions in code:

- API base URL: `http://localhost:8000/api`
- Compile proxy target: `http://127.0.0.1:8000/api/compile`

If the backend is not running, the UI will load but chat, session, voice, PDF upload, and compile actions will fail.

See the root [README.md](../README.md) for the full StemFlow setup, Google Cloud auth notes, and troubleshooting steps.

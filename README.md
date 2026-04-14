# StemFlow

StemFlow is a local-first STEM writing workspace for turning rough math, voice notes, and PDF snippets into editable LaTeX. The app combines a Next.js frontend with a FastAPI backend, Gemini on Vertex AI for AI-assisted editing, filesystem-backed sessions, and PDF compilation through LaTeXLite.

## What StemFlow Does

- Edit LaTeX in a live editor with a rendered preview
- Ask the AI to rewrite, solve, explain, or format math
- Upload a PDF and send selected text to the AI as context
- Record voice commands and transcribe them into editing actions
- Save document state and chat history into backend sessions
- Compile the current LaTeX document into a PDF

## Architecture

### Frontend

- Location: `frontend/`
- Stack: Next.js App Router, React, TypeScript, Framer Motion
- Main page: `frontend/app/page.tsx`
- API helper: `frontend/app/lib/api.ts`
- Compile proxy route: `frontend/app/api/compile/route.ts`

The frontend runs on `http://localhost:3000`.

### Backend

- Location: `backend/`
- Stack: FastAPI, Python, Google GenAI SDK, SymPy
- Entry point: `backend/main.py`
- AI logic: `backend/services/vertex_ai.py`
- Google auth handling: `backend/services/google_auth.py`
- Session persistence: `backend/services/session_store.py`
- PDF compilation: `backend/services/latex_compiler.py`

The backend runs on `http://127.0.0.1:8000` and exposes API routes under `/api`.

### How They Communicate

- The frontend calls the backend directly for chat, voice, session, and PDF upload endpoints using `frontend/app/lib/api.ts`
- The compile flow uses a Next.js route at `frontend/app/api/compile/route.ts`, which forwards requests to `http://127.0.0.1:8000/api/compile`
- CORS in `backend/main.py` currently allows `http://localhost:3000`

## Repository Structure

```text
.
|- backend/
|  |- main.py
|  |- requirements.txt
|  |- routers/
|  |- services/
|  `- sessions/
|- frontend/
|  |- app/
|  |- package.json
|  `- README.md
|- agentic_tools.md
`- README.md
```

## Prerequisites

Before running StemFlow locally, install:

- Node.js 20+ and npm
- Python 3.11+
- A Google Cloud project with billing enabled
- Access to Vertex AI and, if you want voice features, Speech-related Google services
- One of the supported Google auth methods:
  - Application Default Credentials via `gcloud auth application-default login`
  - `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account JSON file

Optional but useful:

- Google Cloud CLI (`gcloud`) for local ADC setup

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/baohuy1303/voice2latex.git
cd voice2latex
```

### 2. Set Up the Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

- Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
- Windows Command Prompt: `.venv\Scripts\activate.bat`
- macOS/Linux: `source .venv/bin/activate`

Install dependencies:

```bash
pip install -r requirements.txt
pip install python-multipart
```

Create `backend/.env`:

```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your-service-account.json
LATEXLITE_API_KEY=your-latexlite-api-key
```

Notes:

- `LATEXLITE_API_KEY` is required for the PDF compile feature
- `GOOGLE_APPLICATION_CREDENTIALS` is optional if you use local ADC instead
- `backend/main.py` loads `backend/.env` automatically on startup

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

Sanity check:

- Open [http://127.0.0.1:8000/ping](http://127.0.0.1:8000/ping)
- Expected response: `{"status":"ok"}`

### 3. Set Up the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment and Config

### Backend `.env`

StemFlow currently reads backend configuration from `backend/.env`.

Supported variables used by the codebase:

- `GCP_PROJECT_ID`
  - Used by the Gemini/Vertex client in `backend/services/vertex_ai.py`
- `GCP_LOCATION`
  - Defaults to `us-central1` if omitted
- `GEMINI_MODEL`
  - Used by Gemini calls in chat and voice flows
- `GOOGLE_APPLICATION_CREDENTIALS`
  - Optional if using ADC
  - Should be the full path to a service account JSON file
- `LATEXLITE_API_KEY`
  - Required for `POST /api/compile`

### Frontend Config

The frontend does not currently use a checked-in `.env.local` file for backend URLs.

Current hardcoded local endpoints:

- `frontend/app/lib/api.ts` uses `http://localhost:8000/api`
- `frontend/app/api/compile/route.ts` forwards to `http://127.0.0.1:8000/api/compile`

That means local development assumes:

- frontend on port `3000`
- backend on port `8000`

## Google Cloud / Vertex / Gemini Setup

StemFlow uses Gemini through Vertex AI. The backend checks for Google credentials using the standard ADC flow.

### Important: `gcloud auth login` Is Not Enough

`gcloud auth login` authenticates the CLI user session. It does not create Application Default Credentials for local code.

For local development with ADC, use:

```bash
gcloud auth application-default login
```

### Supported Local Auth Options

Option 1: ADC with `gcloud`

```bash
gcloud auth application-default login
```

Option 2: Service account JSON

Set `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env`:

```env
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

### Vertex Setup Checklist

Make sure the selected Google Cloud project:

- has billing enabled
- has Vertex AI API enabled
- has any other required APIs enabled for the features you use
- grants the authenticated user or service account permission to call Vertex AI

## Common Troubleshooting

### Google Cloud credentials are not configured

Typical message:

```text
Google Cloud credentials are not configured. Run `gcloud auth application-default login` for local development or set `GOOGLE_APPLICATION_CREDENTIALS`...
```

What to do:

- If using ADC, run `gcloud auth application-default login`
- If using a service account key, verify `GOOGLE_APPLICATION_CREDENTIALS` points to the JSON file, not to the directory and not to values copied from inside the JSON
- Restart the backend after changing credentials

### `gcloud` is not recognized

Google Cloud CLI is not installed or not on your PATH.

Options:

- Install Google Cloud CLI, then run `gcloud auth application-default login`
- Or skip `gcloud` and use `GOOGLE_APPLICATION_CREDENTIALS` with a service account JSON file

### `403 PERMISSION_DENIED` / Vertex AI API disabled

Typical meaning:

- credentials are loading
- but the project does not have Vertex AI enabled, billing enabled, or correct permissions

Check:

- the project in `GCP_PROJECT_ID`
- Vertex AI API is enabled
- billing is enabled
- the user or service account has access to the project

### Backend not reachable from the frontend

Symptoms:

- chat requests fail immediately
- session requests fail
- frontend loads but AI actions do not work

Check:

- backend is running on port `8000`
- [http://127.0.0.1:8000/ping](http://127.0.0.1:8000/ping) returns a healthy response
- frontend is running on `http://localhost:3000`
- you did not change the backend port without also updating frontend URLs

### PDF compile fails

Compile requests depend on `LATEXLITE_API_KEY`.

If compile fails:

- verify `LATEXLITE_API_KEY` is set in `backend/.env`
- restart the backend
- check the backend compile route in `backend/routers/compile.py`
- remember that compile uses the external LaTeXLite service through `backend/services/latex_compiler.py`

### Voice features do not work

Voice transcription still depends on Google auth and backend availability.

Check:

- Google credentials are configured
- the backend is running
- the browser has microphone permission

## Developer Notes

### Key Frontend Files

- `frontend/app/page.tsx`
  - main StemFlow UI
  - session loading, autosave state, editor state, chat state
- `frontend/app/lib/api.ts`
  - browser-side API calls to the backend
- `frontend/app/components/`
  - editor, preview, PDF viewer, floating chat/voice UI
- `frontend/app/hooks/useMicrophone.ts`
  - microphone recording logic
- `frontend/app/api/compile/route.ts`
  - proxy route for PDF compilation

### Key Backend Files

- `backend/main.py`
  - FastAPI startup, CORS, router registration, startup auth warning
- `backend/routers/chat.py`
  - main non-streaming AI chat endpoint
- `backend/routers/chat_stream.py`
  - streaming chat endpoint
- `backend/routers/voice.py`
  - voice transcription endpoint
- `backend/routers/session.py`
  - session CRUD and PDF upload endpoints
- `backend/routers/compile.py`
  - PDF compile endpoint

### Session Handling

- Session storage lives in `backend/services/session_store.py`
- Session data is stored on disk under `backend/sessions/`
- The frontend persists:
  - current document
  - chat history
  - uploaded session PDF reference

### AI and Chat Logic

- Gemini client creation and auth handling live in:
  - `backend/services/vertex_ai.py`
  - `backend/services/google_auth.py`
- Prompting and tool use are centered in `backend/services/vertex_ai.py`
- Symbolic math helpers live in `backend/services/sympy_solver.py`

## Additional Docs

- [frontend/README.md](./frontend/README.md) for frontend-specific notes
- [agentic_tools.md](./agentic_tools.md) for the AI/tooling design background

## Known Gaps In The Repo

These docs reflect the current codebase, but a few things are still implicit in the implementation:

- frontend and compile backend URLs are hardcoded instead of being environment-driven
- the README cannot document the exact LaTeXLite account setup beyond `LATEXLITE_API_KEY`, because that integration is external
- there is no backend-specific README with deeper API or service notes yet

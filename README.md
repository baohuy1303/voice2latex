# Voice2LaTeX

Voice2LaTeX is an AI-assisted math workspace for creating, editing, and refining LaTeX through both chat and voice. Instead of treating AI as a one-off prompt box, the product is built around a live working document: users write or paste raw LaTeX, preview the rendered output immediately, and use AI to propose edits in context.

The workspace is designed for fast local demos and practical math workflows. Users can reference PDFs while working, send text or voice instructions to the assistant, review pending document changes before applying them, undo edits, and compile the current document into a downloadable PDF. The result is a focused environment for iterative math authoring rather than a generic chatbot experience.

## What It Does

Voice2LaTeX allows users to:

- Edit a raw LaTeX document directly
- Preview rendered math live
- Use chat commands to transform or explain the document
- Use voice input to issue math-editing instructions
- Upload and reference PDFs while working
- Send selected PDF text as context for AI requests
- Review proposed document changes before applying them
- Undo changes during an editing session
- Compile and download the current LaTeX document as a PDF

## Core User Experience

### PDF Viewer

The left panel displays an uploaded PDF so users can reference source material such as notes, worksheets, or problem statements while editing their document.

### LaTeX Editor

The center editor is the main working area. Users can type or paste raw LaTeX directly, making the document the source of truth for the workspace.

### Live Preview

The preview panel renders the current LaTeX output so users can immediately see formatted math as they edit or apply AI-generated changes.

### Chat Assistant

The assistant accepts typed instructions such as:

- `simplify this`
- `solve this`
- `rewrite this in align format`
- `explain this step`

Requests are sent with the current document and optional context, allowing the backend to generate document-aware responses and updates.

### Voice Assistant

Users can speak math instructions through the microphone. Audio is transcribed by the backend and routed through the same editing flow as chat requests, making voice a natural input method for document changes.

## Current Feature Set

- Editable raw LaTeX document
- Live rendered preview
- Chat-based document editing
- Voice-based document editing through the backend
- Pending-change review flow before applying AI edits
- Undo support
- Session creation, loading, and clearing
- PDF upload and PDF viewer
- PDF text selection and context support for AI requests
- Streaming chat responses in the frontend
- FastAPI backend routes for chat, streaming chat, voice, sessions, and PDF handling
- Gemini / Vertex AI integration for document updates
- SymPy-powered math tool support in the backend
- LaTeX sanitization before rendering
- Compile and download the LaTeX document as a PDF

## Architecture Overview

### Frontend

The frontend is built with Next.js, React, and TypeScript. It provides the multi-panel workspace, Monaco-based editing, live KaTeX preview, session controls, PDF viewing, and chat/voice interaction UI.

### Backend

The backend is built with FastAPI and handles chat requests, streaming responses, voice transcription, session state, PDF workflows, and AI orchestration. It integrates with Gemini / Vertex AI for document updates and Google Cloud Speech-to-Text for voice input. SymPy-backed tooling supports math-aware backend behavior, and LaTeX output is sanitized before rendering.

## Project Structure

```text
voice2latex/
├─ frontend/                     # Next.js frontend
├─ backend/                      # FastAPI backend
├─ idea-overview.md              # product vision
├─ implementation_plan.md        # high-level build plan
└─ detailed_implementation_plan.md
```

## Prerequisites

Before running locally, make sure you have:

- Node.js 20 or newer
- npm
- Python 3.11 or newer
- A Google Cloud project with the required APIs enabled
- A valid Google service account JSON key with appropriate permissions

You will also need working Google Cloud configuration for AI and voice features.

## Backend Setup

Open a terminal in the backend directory:

```cmd
cd /d "C:\path\to\voice2latex\backend"
```

Create a virtual environment:

```cmd
python -m venv .venv
```

Activate it.

For Command Prompt:

```cmd
.venv\Scripts\activate.bat
```

For PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```cmd
pip install -r requirements.txt
```

If needed, install multipart support explicitly:

```cmd
pip install python-multipart
```

Create or update `backend/.env` with values like:

```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your-service-account.json
```

Important notes:

- `GOOGLE_APPLICATION_CREDENTIALS` must point to a real JSON key file
- Using an absolute Windows path is the safest option
- `GCP_PROJECT_ID` must match the Google Cloud project that owns the enabled services and credentials

Start the backend:

```cmd
python -m uvicorn main:app --reload --port 8000
```

If startup succeeds, you should see output similar to:

```text
Uvicorn running on http://127.0.0.1:8000
```

Quick health check:

```text
http://127.0.0.1:8000/ping
```

## Frontend Setup

Open a second terminal in the frontend directory:

```cmd
cd /d "C:\path\to\voice2latex\frontend"
```

Install dependencies:

```cmd
npm install
```

Start the frontend development server:

```cmd
npm run dev
```

If startup succeeds, you should see output similar to:

```text
Local: http://localhost:3000
Ready in ...
```

Then open:

```text
http://localhost:3000
```

## Proper Local Run Flow

To run the project correctly, keep both backend and frontend running at the same time.

### Terminal 1: Backend

```cmd
cd /d "C:\path\to\voice2latex\backend"
.venv\Scripts\activate.bat
python -m uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend

```cmd
cd /d "C:\path\to\voice2latex\frontend"
npm install
npm run dev
```

Then open:

- `http://localhost:3000`
- Optional backend check: `http://127.0.0.1:8000/ping`

## How to Test the App

### Chat Flow

1. Start both backend and frontend.
2. Open `http://localhost:3000`.
3. Type or paste LaTeX into the editor.
4. Send a command such as:
   - `simplify this`
   - `rewrite this in align format`
   - `solve this`
5. Check whether the preview updates.
6. If the backend proposes a document change, review it and accept it.

### Voice Flow

1. Make sure the backend is running and Google credentials are valid.
2. Open the app.
3. Allow microphone access in the browser.
4. Tap the mic button.
5. Speak a math instruction.
6. Wait for transcription and AI processing.
7. Verify that the document and preview update.

### PDF Flow

1. Upload a PDF in the viewer panel.
2. Select relevant text if needed.
3. Send a related request through chat so the backend can use that context while updating the document.

### Compile Flow

1. Enter or generate a LaTeX document.
2. Use the compile/download action in the UI.
3. Confirm that a PDF is generated and downloaded successfully.

## Common Setup Issues

### `uvicorn` is not recognized

Use:

```cmd
python -m uvicorn main:app --reload --port 8000
```

instead of relying on `uvicorn` directly.

### PowerShell blocks virtual environment activation

Run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### `python-multipart` is missing

Install it:

```cmd
pip install python-multipart
```

### `403 PERMISSION_DENIED`

This usually means one of the following:

- Wrong Google Cloud project
- Missing Vertex AI permissions
- Wrong service account
- Required API not enabled
- Billing not enabled

Check:

- `GCP_PROJECT_ID`
- Service account IAM roles
- Vertex AI and speech-related APIs
- Billing status

### `429 RESOURCE_EXHAUSTED`

This usually points to:

- Quota exhaustion
- Model rate limits
- Billing or quota configuration issues

### `localhost:3000` cannot be reached

Usually means the frontend dev server is not actually running. Confirm the terminal shows:

- `Local: http://localhost:3000`
- `Ready`

### `127.0.0.1:8000/ping` cannot be reached

Usually means the backend is not running or failed during startup.

### Next.js workspace-root warning

A warning about multiple `package-lock.json` files is usually a configuration warning, not the main reason localhost fails.

## Product Philosophy

Voice2LaTeX is optimized for fast local demos and practical math workflows. It prioritizes document editing, visible state changes, and useful AI assistance over heavyweight architecture or broad feature sprawl.

It is not intended to be a full theorem prover, a full computer algebra system, or a production-grade collaborative editor. Its strength is providing a clear, interactive math authoring workflow that is easy to demonstrate and easy to understand.

## Why It Works Well for Demos

Voice2LaTeX works well in hackathon and showcase settings because it combines:

- AI-assisted LaTeX editing
- Voice interaction
- Live rendered preview
- Reviewable document updates
- PDF-based context
- A clear end-to-end local workflow

That combination gives the project both technical depth and a strong, easy-to-follow user story for judges, teammates, and recruiters.

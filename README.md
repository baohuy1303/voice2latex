# Voice2LaTeX

Voice2LaTeX is a hackathon math workspace for creating and editing LaTeX with chat or voice. The frontend provides a split chat/editor/preview flow plus a voice mode, and the backend routes requests through FastAPI to Gemini/Vertex AI for document-aware edits.

## Current Features

- Chat mode with:
  - conversational AI command input
  - editable raw LaTeX document
  - live KaTeX preview
- Voice mode with:
  - microphone capture
  - speech transcription through the backend
  - AI-driven document updates
- Preset starter documents for demo flows
- Undo support
- Backend AI editing pipeline with:
  - FastAPI routes for chat and voice
  - Gemini/Vertex AI integration
  - SymPy-based math tooling
  - LaTeX sanitization utilities

## Repo Structure

- `frontend/`: Next.js app
- `backend/`: FastAPI API server
- `idea-overview.md`: product vision
- `implementation_plan.md`: high-level build plan
- `detailed_implementation_plan.md`: implementation details

## Prerequisites

- Node.js 20+
- Python 3.11+
- A Google Cloud project with Vertex AI and Speech-to-Text enabled

## Backend Setup

From `backend/`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a `.env` file in `backend/` with values like:

```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

Start the API:

```powershell
uvicorn main:app --reload --port 8000
```

Quick health check:

```powershell
curl http://localhost:8000/ping
```

## Frontend Setup

From `frontend/`:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Flow

### Chat Mode

1. Start with a preset or paste your own LaTeX into the editor.
2. In the chat panel, enter a command like:
   - `simplify this`
   - `solve this`
   - `rewrite this in align format`
3. Watch the editor update and the KaTeX preview refresh.
4. Use `Undo` if needed.

### Voice Mode

1. Switch to `Voice`.
2. Tap the mic button and speak a math instruction.
3. The app sends audio to the backend for transcription.
4. The transcript is forwarded into the AI editing flow.
5. The document updates and the preview rerenders.

## Notes

- The frontend expects the backend at `http://localhost:8000`.
- If the backend is unavailable, AI chat and voice processing will fail.
- Voice mode depends on browser microphone permission.
- Google Cloud credentials are required for the backend AI and speech flows.

## Hackathon Focus

This project is optimized for a strong local demo:

- fast iteration
- document editing over perfect architecture
- math-focused AI interactions
- minimal persistence and no auth

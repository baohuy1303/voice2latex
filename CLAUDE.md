# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (from `backend/`)
```bash
# Activate venv (Windows PowerShell)
source venv/Scripts/Activate

# Install dependencies
pip install -r requirements.txt

# Run dev server
uvicorn main:app --reload --port 8000

# Health check
curl http://localhost:8000/ping
```

### Frontend (from `frontend/`)
```bash
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

## Architecture

This is a hackathon math workspace: a Next.js 16 frontend + FastAPI backend where the user writes LaTeX, chats with or speaks to an AI assistant, and the AI edits the document in place.

### Frontend (`frontend/app/`)

- **`page.tsx`** — root client component; owns all state (document, history, sessions, context snippets, panel widths, mode). Renders the 3-panel draggable layout and floating `SiriBubble`.
- **Three panels**: `PdfPanel` (PDF viewer + text selection) | `EditorPanel` (Monaco, shows diff when `pendingDocument` is set) | `LatexPreview` (KaTeX live render)
- **`SiriBubble`** — floating chat + mic UI; lives outside the panel layout via absolute positioning
- **`ContextTray`** — bar showing text snippets the user has selected from PDF, editor, or preview; passed as `context` to the AI
- **`lib/api.ts`** — all fetch calls to `http://localhost:8000/api`; includes both `sendChatMessage` (non-streaming `/api/chat`) and `streamChat` (SSE `/api/chat/stream`)
- **`hooks/useMicrophone.ts`** — MediaRecorder wrapper; `hooks/useStreamingChat.ts` — SSE consumer
- **AI response cycle**: user sends → `pendingDocument` is set → user accepts/rejects diff in `EditorPanel`

### Backend (`backend/`)

- **`main.py`** — FastAPI app; CORS locked to `localhost:3000`; routers mounted under `/api`
- **Routers**: `chat.py` (sync `/api/chat`), `chat_stream.py` (SSE `/api/chat/stream`), `voice.py` (`/api/voice/transcribe`), `session.py` (CRUD + PDF upload)
- **`services/vertex_ai.py`** — all Gemini calls via `google-genai` SDK:
  - `call_gemini` — edit mode with SymPy tool loop (up to 3 iterations), then JSON parse + LaTeX sanitize; retry with structured output if bad KaTeX patterns detected
  - `call_gemini_stream` — streaming variant; accumulates chunks, parses JSON at end
  - `call_gemini_with_audio` — sends raw audio bytes + document to Gemini for combined transcription + edit
- **`services/sympy_solver.py`** — `TOOL_FUNCTIONS` dict (`solve_equation`, `simplify_expression`, `differentiate`, `integrate`); each callable by Gemini via function calling
- **`services/latex_sanitizer.py`** — post-processing to ensure KaTeX compatibility
- **`services/session_store.py`** — JSON file persistence in `backend/sessions/<id>/`
- **`schemas/agent_response.py`** — Pydantic `ChatRequest` and `AgentResponse`; `AgentResponse` actions: `replace_all`, `insert`, `replace_snippet`, `no_change`

### AI Response Schema

Every Gemini call returns JSON:
```json
{"action": "replace_all|no_change", "new_document": "...", "reply": "...", "explanation": "..."}
```
Edit mode uses SymPy function calling before returning. Tutor mode always returns `action: no_change`.

### Environment

Backend requires `backend/.env`:
```
GCP_PROJECT_ID=...
GCP_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

### Next.js Version Note

This project uses Next.js **16** (not 14/15). Refer to `node_modules/next/dist/docs/` for up-to-date API conventions if needed.

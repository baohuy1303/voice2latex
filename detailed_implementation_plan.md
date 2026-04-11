# Voice-to-LaTeX AI Editor — Detailed Implementation Plan

## Context
This is a 20-hour hackathon project: a multi-modal AI math workspace where users speak or chat with a LaTeX document. The frontend (Next.js 16 + Tailwind 4) is initialized with boilerplate; the backend directory is empty. GCP project exists. Goal: maximize functionality for a compelling local demo; deployment is a stretch goal.

---

## GCP APIs to Enable (Pre-requisite)
- `aiplatform.googleapis.com` (Vertex AI)
- `speech.googleapis.com` (Speech-to-Text)

Create a service account with **Vertex AI User** + **Speech-to-Text User** roles. Download JSON key to `backend/credentials/` (gitignored). Set `GOOGLE_APPLICATION_CREDENTIALS` env var.

---

## Critical Path
`FastAPI scaffold → Frontend-backend HTTP wiring → Vertex AI structured JSON output → KaTeX rendering`

Everything else layers on top. Get this chain working first.

---

## Phase 1: Foundation, Editor & Frontend Setup (Hours 1–3)

### 1.1 — GCP Credentials & Environment (15 min)
- Enable APIs in GCP console
- Download service account key to `backend/credentials/`
- Create `backend/.env` with `GOOGLE_APPLICATION_CREDENTIALS` and `GCP_PROJECT_ID`
- Add `credentials/` and `.env` to `.gitignore`

### 1.2 — FastAPI Backend Scaffold (30 min)
- Create `backend/requirements.txt`: `fastapi`, `uvicorn[standard]`, `python-dotenv`, `pydantic`
- Create venv at `backend/.venv/`
- File structure: `main.py`, `routers/`, `services/`, `schemas/`
- `main.py`: FastAPI app, CORS (allow `localhost:3000`), `/ping` endpoint
- **Decision:** Flat structure, no database, no auth
- **Done:** `curl localhost:8000/ping` returns 200

### 1.3 — Frontend Layout Shell & Mode Toggle (45 min)
- Replace `app/page.tsx` with client component holding `mode: "voice" | "chat"` state
- Top bar with project name + mode toggle button
- Chat Mode: 3-column layout (chat panel 30% | textarea 35% | KaTeX preview 35%)
- Voice Mode: full-screen document preview + mic indicator placeholder
- `document` state initialized to sample LaTeX
- **Decision:** Use `textarea` for raw editor (not Monaco — swap in Phase 5 if time)
- **Done:** Both modes render and toggle correctly

### 1.4 — KaTeX Live Preview (30 min)
- Install `katex`, `react-katex`, `@types/katex`
- Create `app/components/LatexPreview.tsx` using `katex.renderToString()`
- Handle parse errors gracefully (show error text, keep last valid render)
- Import KaTeX CSS
- Wire to `document` state — textarea edits update preview in real time
- **Done:** Typing LaTeX in textarea updates KaTeX preview live

### 1.5 — Chat Panel UI (30 min)
- Create `app/components/ChatPanel.tsx`: scrollable message list + input + send button
- Messages as `Array<{ role: "user" | "assistant", content: string }>`
- On send: add user message to list, placeholder response
- **Done:** Messages appear in chat, no backend wiring yet

### 1.6 — Frontend-Backend HTTP Wiring (30 min)
- Create `app/lib/api.ts`: `sendChatMessage(message, document) → AgentResponse`
- Calls `POST /api/chat` with `{ message, document }`
- Backend `routers/chat.py`: accepts request, returns hardcoded echo response
- Wire chat panel: send → fetch → display reply + update document
- **Decision:** REST (not WebSocket) for chat. SSE for streaming later if needed
- **Done:** Chat round-trips to backend, document state updates

### Phase 1 Checkpoint
- FastAPI on :8000, Next.js on :3000
- Chat Mode: 3-panel with chat, textarea, live KaTeX preview
- Voice Mode: full-screen preview placeholder
- Chat messages round-trip to backend

---

## Phase 2: Vertex AI Agent & Document Manipulation (Hours 4–7)

### 2.1 — Vertex AI SDK & Basic Call (45 min)
- Add `google-cloud-aiplatform` (or `google-genai`) to requirements
- Create `backend/services/vertex_ai.py`: `call_gemini(system_prompt, user_message, document) → dict`
- Use `gemini-2.0-flash` (fast, structured output + tool calling support)
- **Decision:** `google-genai` SDK if available (cleaner API), else `google-cloud-aiplatform`
- **Done:** Test call returns Gemini response

### 2.2 — Structured JSON Output Schema (30 min)
- Create `backend/schemas/agent_response.py` with Pydantic model:
  - `action`: enum (`replace_all`, `insert`, `replace_snippet`, `no_change`)
  - `new_document`: full updated LaTeX string
  - `reply`: natural language chat response
  - `explanation`: optional (for solve results)
- Configure Gemini: `response_mime_type="application/json"`, `response_schema=AgentResponse`
- **Decision:** Always return full document (not diffs). Simpler, no merge conflicts, docs are small
- **Done:** Gemini returns valid JSON matching schema

### 2.3 — System Prompt Engineering (45 min)
- Create `backend/prompts/system_prompt.txt`
- Covers: role, input/output format, LaTeX conventions, context-awareness (references like "question 1"), error handling
- Test with 5+ commands: "write the quadratic formula", "change bounds to 0 and pi", "add section Question 2", etc.
- **Done:** Reliable LaTeX edits for representative commands

### 2.4 — Wire Vertex AI into Chat Endpoint (30 min)
- Replace hardcoded echo in `/api/chat` with real Gemini call
- Parse structured JSON into `AgentResponse`, return to frontend
- Error handling: invalid JSON → fallback `no_change` response
- **Done:** "Add e=mc^2" in chat → KaTeX preview updates

### 2.5 — Document History & Undo (30 min)
- Maintain `documentHistory: string[]` in frontend state
- Push old value on every update; Undo button pops last state
- Cap at 50 entries
- **Done:** Undo reverts AI edits

### 2.6 — Conversation History / Multi-Turn Context (30 min)
- Store conversation history in-memory on backend (keyed by session ID from frontend)
- Send last 10 messages to Gemini as multi-turn `contents` array
- **Done:** Follow-up commands work ("now change that to pi")

### Phase 2 Checkpoint
- **Core product loop working:** type natural language → AI edits LaTeX → live preview
- Multi-turn context, undo support
- This is the minimum viable demo

---

## Phase 3: Google Speech-to-Text Integration (Hours 8–11)

### 3.1 — Browser Microphone Capture (45 min)
- Create `app/hooks/useMicrophone.ts` using `navigator.mediaDevices.getUserMedia`
- Record as WebM/Opus (browser native — avoids PCM conversion)
- Push-to-talk pattern: toggle button starts/stops recording
- **Decision:** Push-to-talk, not continuous. Continuous requires VAD (out of scope)
- **Done:** Audio blob available in JS after recording

### 3.2 — Speech-to-Text Backend Endpoint (45 min)
- Add `google-cloud-speech` to requirements
- Create `backend/services/speech.py`: `transcribe_audio(audio_bytes) → str`
- Use synchronous `recognize()` (simpler, sufficient for push-to-talk)
- Config: `encoding=WEBM_OPUS`, `sample_rate_hertz=48000`, `language_code="en-US"`, auto-punctuation
- Create `POST /api/voice/transcribe` (file upload → transcript)
- **Done:** Audio blob → transcript string

### 3.3 — Voice-to-Chat Pipeline (30 min)
- On recording stop: send blob to `/api/voice/transcribe` → get transcript
- Display transcript in chat as user message
- Send transcript to `/api/chat` (reuses entire Phase 2 pipeline)
- **Done:** Speaking "add x squared" → transcript in chat → AI edits → preview updates

### 3.4 — Voice Mode UI (45 min)
- Voice Mode: full-screen KaTeX preview + floating mic button (bottom center)
- Recording indicator (pulsing circle/red dot)
- Flash transcript text briefly after processing
- **Done:** Clean full-screen voice experience

### 3.5 — Voice Refinements (30 min)
- Floating command history (last 3–5 commands) in Voice Mode
- Undo button accessible in Voice Mode
- Add STT correction hints to system prompt ("user is speaking math; correct likely errors")
- **Done:** 5 consecutive voice commands work without breaking

### Phase 3 Checkpoint
- Both Chat Mode and Voice Mode fully functional
- Demo-ready product at this point

---

## Phase 4: Tool Calling & Math Solver (Hours 12–16)

### 4.1 — SymPy Service Layer (45 min)
- Add `sympy` to requirements
- Create `backend/services/sympy_solver.py`:
  - `solve_equation(equation_latex, variable)` → solution LaTeX
  - `simplify_expression(expression_latex)` → simplified LaTeX
  - `differentiate(expression_latex, variable)` → derivative LaTeX
  - `integrate(expression_latex, variable, lower, upper)` → result LaTeX
- Use `sympy.parsing.latex.parse_latex()` with `sympify()` fallback
- Use `sympy.latex()` for output
- **Done:** Each function works for 3+ test inputs

### 4.2 — Register Tools with Vertex AI (1 hour)
- Define `FunctionDeclaration` for each SymPy tool in `vertex_ai.py`
- Include `sympy_expression` as fallback parameter (bypass `parse_latex` fragility)
- Pass tool declarations via `tools` parameter in Gemini call
- Update system prompt: "Use tools for math — do not solve in your head"
- **Done:** "Solve x^2 - 4 = 0" → Gemini returns a tool call request

### 4.3 — Multi-Turn Tool Execution Loop (1 hour)
- Modify `call_gemini` to handle tool call lifecycle:
  1. Detect `function_call` in response
  2. Route to appropriate SymPy function
  3. Send `function_response` back to Gemini
  4. Gemini produces final `AgentResponse` JSON
- Error handling: SymPy failures sent back to Gemini gracefully
- Cap at 3 tool call iterations
- **Done:** "Integrate x^2 from 0 to 1" → SymPy computes 1/3 → Gemini inserts solution

### 4.4 — Solution Display & Document Insertion (45 min)
- When response has `explanation`, render it in chat with inline KaTeX
- Detect `$...$` and `$$...$$` in chat messages, render via KaTeX
- `new_document` contains solution at appropriate location
- **Done:** Chat shows step-by-step math, preview shows updated document

### 4.5 — LaTeX Validation Tool (30 min) — LOW PRIORITY
- `validate_and_fix_latex(latex)` — brace matching, common error fixes
- Register as Vertex AI tool
- **Skip if behind schedule** — Gemini produces mostly valid LaTeX

### 4.6 — End-to-End Testing (45 min)
- Test flows: solve quadratic, simplify fraction, differentiate, integrate, multi-step ("write equation then solve it")
- Fix system prompt based on failure patterns
- **Done:** 5 test flows pass correctly

### Phase 4 Checkpoint
- SymPy-backed math solving via Vertex AI tool calling
- The "wow" demo: speak equation → speak "solve this" → step-by-step solution appears

---

## Phase 5: Polish & Stretch Goals (Hours 17–20)

### 5.1 — UI Polish (1.5 hours)
- Dark theme, consistent color scheme in `globals.css`
- Chat: loading indicators, smooth scroll, timestamps
- KaTeX preview: paper-like background, padding, shadow
- Voice Mode: gradient background, larger animated mic button
- **Done:** Looks professional on screen share

### 5.2 — Error Handling & Resilience (45 min)
- Loading states for all async ops
- Error toasts on API failures
- Disable send/mic while request in flight
- Backend: catch exceptions, 30s Gemini timeout, 10s SymPy timeout
- **Done:** No unhandled errors visible in UI

### 5.3 — Demo Dataset & Presets (30 min)
- 2–3 starter documents (calculus, linear algebra, empty)
- Dropdown to load starter documents
- Cheat sheet of reliable demo commands

### 5.4 — Monaco Editor (45 min) — STRETCH
- Install `@monaco-editor/react`, replace textarea
- LaTeX mode, dark theme, word wrap, no minimap
- Only if Phases 1–4 are solid

### 5.5 — Highlight-to-Reference (45 min) — STRETCH
- Detect text selection in editor
- Include selected text in API payload
- System prompt: "selection refers to this specific part"

### 5.6 — Demo Rehearsal (30 min)
- Run through demo 3 times, aim for 3–5 minutes
- Identify and fix or route around flaky behaviors

---

## Scope Cutting Guide

| Situation | What to cut |
|-----------|------------|
| Behind 1–2 hrs | Skip Task 3.5 (voice refinements), Task 2.6 (conversation history) |
| Behind 3–4 hrs | Reduce SymPy to solve + simplify only. Skip Task 4.5. Shorten Phase 5 to polish + rehearsal |
| Behind 5+ hrs | Skip Voice Mode (Phase 3) and tool calling (Phase 4). Ship chat-based AI LaTeX editor |

---

## Key Files to Create/Modify

| File | Purpose |
|------|---------|
| `frontend/app/page.tsx` | Main layout, state, mode toggle |
| `frontend/app/components/LatexPreview.tsx` | KaTeX rendering component |
| `frontend/app/components/ChatPanel.tsx` | Chat UI |
| `frontend/app/hooks/useMicrophone.ts` | Browser mic capture |
| `frontend/app/lib/api.ts` | HTTP client for backend |
| `backend/main.py` | FastAPI entry point, CORS |
| `backend/routers/chat.py` | Chat endpoint |
| `backend/routers/voice.py` | Voice transcription endpoint |
| `backend/services/vertex_ai.py` | Gemini integration, tool calling loop |
| `backend/services/speech.py` | Google STT wrapper |
| `backend/services/sympy_solver.py` | SymPy math functions |
| `backend/schemas/agent_response.py` | Pydantic response models |
| `backend/prompts/system_prompt.txt` | Gemini system prompt |

---

## Verification

After each phase, verify by running both servers (`uvicorn` on :8000, `npm run dev` on :3000) and testing:
- **Phase 1:** Textarea edits update KaTeX preview; chat echoes via backend
- **Phase 2:** Chat commands produce AI-edited LaTeX; undo works
- **Phase 3:** Voice recording transcribes and triggers AI edits
- **Phase 4:** "Solve x^2-4=0" returns SymPy result with steps
- **Phase 5:** Demo flow runs smoothly 3 times in a row

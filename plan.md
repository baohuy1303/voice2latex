# Voice-to-LaTeX AI Editor — Full Redesign Plan

## Context
The core backend is complete (Gemini + tool calling, STT, SymPy, LaTeX sanitizer). This plan overhauls the UI into a 3-panel layout (PDF Viewer | Monaco Diff Editor | KaTeX Preview), replaces the chat/voice modes with a floating "Siri Bubble", adds SSE streaming, and adds session persistence.

---

## What We Keep (no changes needed)
- `backend/services/vertex_ai.py` — Gemini integration + tool calling loop
- `backend/services/speech.py` — Google Cloud STT
- `backend/services/sympy_solver.py` — SymPy math tools
- `backend/services/latex_sanitizer.py` — KaTeX sanitizer
- `backend/prompts/system_prompt.txt` — system prompt (minor additions for PDF context)
- `frontend/app/components/LatexPreview.tsx` — KaTeX renderer (reuse as right panel)
- `frontend/app/hooks/useMicrophone.ts` — mic capture hook

---

## Phase 1: Session Persistence + 3-Panel Layout + Monaco (5–6 hrs)

### 1.1 — Session Backend (45 min)
- Create `backend/services/session_store.py` — filesystem CRUD on `backend/sessions/{uuid}/`
- Create `backend/routers/session.py`:
  - `POST /api/session` → create session dir + `state.json`
  - `GET /api/session/{id}` → read state
  - `PUT /api/session/{id}` → save document + history
  - `POST /api/session/{id}/upload` → save PDF to session dir
- Register in `main.py`, add `sessions/` to `.gitignore`
- Add `session_id: Optional[str]` to `ChatRequest` schema
- Modify `chat.py`: if `session_id` present, load/save history from session file
- **Done:** curl CRUD on sessions works, PDF upload lands on disk

### 1.2 — Install Frontend Packages (15 min)
- `npm install @monaco-editor/react react-pdf pdfjs-dist`
- Verify Monaco renders with `dynamic(() => import(...), { ssr: false })`
- **Done:** Both packages render in throwaway test components

### 1.3 — 3-Panel Layout Rewrite (2 hrs)
- Create `frontend/app/components/PdfPanel.tsx`
  - Upload dropzone (drag & drop or click)
  - Renders PDF pages scrollably via react-pdf `<Document>` + `<Page>`
  - Placeholder when no PDF loaded
- Create `frontend/app/components/EditorPanel.tsx`
  - Wraps Monaco Editor (dynamic import, ssr: false)
  - Config: `language: "latex"`, `theme: "vs-dark"`, `minimap: false`, `wordWrap: "on"`
  - Props: `value`, `onChange`, `proposedValue` (for diff in Phase 2)
- Rewrite `frontend/app/page.tsx`
  - Layout: Left 25% (PDF) | Middle 40% (Monaco) | Right 35% (KaTeX Preview)
  - Temporary bottom chat input bar (functional until Siri bubble in Phase 4)
  - State: `document`, `messages`, `isLoading`, `sessionId`, `pdfFile`
  - On mount: load session from localStorage or create new
  - After each AI response: save session
- **Done:** 3 panels render. Monaco + live KaTeX preview. PDF upload + viewing. Session persists.

### 1.4 — API Client Updates (30 min)
- Add to `api.ts`: `createSession()`, `getSession()`, `saveSession()`, `uploadPdf()`
- Modify `sendChatMessage()` to accept optional `sessionId`
- **Done:** Frontend talks to session endpoints

### Phase 1 Checkpoint
App renders 3 panels. Monaco editor + live KaTeX preview. PDF upload + viewing. Session persists across reload. Temporary chat bar sends commands to Gemini.

---

## Phase 2: SSE Streaming + Monaco Diff Flow (4–5 hrs)

### 2.1 — SSE Streaming Backend (1.5 hrs)
- Add `call_gemini_stream()` async generator to `vertex_ai.py`
  - Uses `generate_content_stream()` instead of `generate_content()`
  - Preserves tool-calling loop (detect function_call in stream, execute, resume)
  - Yields dicts: `{"type": "reply", "chunk": "..."}`, `{"type": "document", ...}`, `{"type": "done"}`
- Create `backend/routers/chat_stream.py`
  - `POST /api/chat/stream` → returns `StreamingResponse(media_type="text/event-stream")`
  - SSE events: `event: reply`, `event: tool_call`, `event: document`, `event: done`
- Register in `main.py`
- **Done:** `curl -N POST /api/chat/stream` shows SSE events arriving incrementally

### 2.2 — SSE Frontend Client + Hook (1 hr)
- Add `streamChat()` to `api.ts` — fetch-based SSE reader (POST + ReadableStream)
- Create `frontend/app/hooks/useStreamingChat.ts`
  - State: `isStreaming`, `streamedReply`, `pendingDocument`, `error`
  - Parses SSE events, routes reply chunks to text, document to pending state
- Replace `sendChatMessage` calls in `page.tsx` with streaming hook
- **Done:** Replies stream word-by-word into the UI

### 2.3 — Monaco Diff Mode (1.5 hrs)
- Modify `EditorPanel.tsx`:
  - When `proposedDocument` is set → switch to `<DiffEditor>` (from `@monaco-editor/react`)
  - Props: `original={currentDocument}`, `modified={proposedDocument}`
  - Overlay "Accept" (green) and "Reject" (red) buttons
  - Accept: apply change, save session, return to normal editor
  - Reject: discard, return to normal editor
  - Use inline diff mode (`renderSideBySide: false`) for compact view
- **Done:** AI changes appear as color-coded diffs. Accept/Reject controls work.

### Phase 2 Checkpoint
AI replies stream in real-time. Document changes appear as diffs in Monaco. User accepts/rejects before changes apply.

---

## Phase 3: PDF Context Engine (3–4 hrs)

### 3.1 — PDF Text Extraction Backend (45 min)
- `pip install PyMuPDF` (imports as `fitz`)
- Create `backend/routers/pdf.py`
  - `POST /api/session/{id}/pdf/text` → extract all text from uploaded PDF (by page)
- Add `context: Optional[str]` to `ChatRequest` schema
- Modify chat endpoints: prepend PDF context to user prompt when provided
- Add PDF context instructions to system prompt
- **Done:** PDF text extraction works, context flows into Gemini prompts

### 3.2 — PDF Text Selection UI (1.5 hrs)
- Enhance `PdfPanel.tsx`:
  - Enable `renderTextLayer={true}` for native browser text selection
  - Detect text selection via `mouseup` / `selectionchange`
  - Show floating "Send to AI" button when text is selected
  - Callback: `onTextSelected(text)` → sets `pdfContext` in page state
- In `page.tsx`: show context badge in chat area, include in API calls, clear after send
- **Done:** Select PDF text → "Send to AI" → context attached to next command

### Phase 3 Checkpoint
Upload PDF → select text → "convert this to LaTeX" → AI uses selection as context → produces LaTeX in diff viewer.

---

## Phase 4: Siri Bubble UI (4–5 hrs)

### 4.1 — Bubble Component (2.5 hrs)
- Extract `renderInlineKatex` from `ChatPanel.tsx` to `frontend/app/lib/katex-utils.ts`
- Create `frontend/app/components/SiriBubble.tsx`:
  - **Collapsed:** 60px circle, mic icon, glowing border animation
  - **Expanded:** ~350x400px card with scrollable message history, text input, mic button
  - Click collapsed → start voice recording. Click again → stop, transcribe, send.
  - Long-press or click expand icon → show text input + history
  - Uses `useMicrophone` hook internally
  - Props: `messages`, `streamedReply`, `isStreaming`, `pdfContext`, callbacks
- Remove temporary chat input bar from `page.tsx`
- Remove old mode toggle entirely
- Mount `SiriBubble` as fixed-position overlay outside the 3-panel flex
- **Done:** Floating bubble works for voice + text. Old chat/voice UI fully removed.

### 4.2 — Bubble CSS Animations (30 min)
- Glowing border animation (blue/violet gradient `box-shadow`)
- Recording pulse (extend `.mic-recording` in `globals.css`)
- Expand/collapse: CSS transition `300ms ease-out` on height/width/opacity
- Streaming: bouncing dots indicator
- **Done:** Smooth visual transitions between all bubble states

### Phase 4 Checkpoint
Floating bubble at bottom center. Tap to voice record. Expand to type. Streamed replies appear in bubble. PDF context shown. Three panels unobstructed.

---

## Phase 5: Framer Motion + Demo Prep (2–3 hrs)

### 5.1 — Framer Motion Animations (1.5 hrs)
- `npm install framer-motion`
- Bubble expand/collapse: spring physics via `motion.div` + `AnimatePresence`
- Diff accept/reject buttons: slide-in animation
- PDF context badge: scale-in effect
- Message bubbles in Siri bubble: slide-up + fade-in
- **Done:** All animations smooth with spring physics

### 5.2 — Demo Prep (1 hr)
- Test full flow: upload PDF → select text → voice command → review diff → accept
- Error state testing (backend down, mic denied, corrupt PDF)
- Session persistence across page reload
- Prepare sample math PDF for demo
- **Done:** Full demo flow runs 3x smoothly with no console errors

---

## Scope Cutting Guide

| Situation | What to cut |
|-----------|------------|
| Behind 2 hrs | Drop Phase 5 entirely. CSS transitions are fine for demo. |
| Behind 4 hrs | Simplify Phase 3: auto-extract all PDF text on upload, skip selection UI |
| Behind 6 hrs | Skip SSE streaming (Phase 2.1-2.2). Keep request/response. Still build diff viewer. |
| Behind 8 hrs | Skip PDF viewer entirely. Keep Monaco diff + Siri bubble as key differentiators. |

**Never cut:** The 3-panel layout and the Siri bubble — they define the redesign.

---

## Key Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/app/page.tsx` | REWRITE | 3-panel layout, session management |
| `frontend/app/components/PdfPanel.tsx` | CREATE | PDF viewer + upload + text selection |
| `frontend/app/components/EditorPanel.tsx` | CREATE | Monaco editor + diff mode |
| `frontend/app/components/SiriBubble.tsx` | CREATE | Floating voice/chat bubble |
| `frontend/app/hooks/useStreamingChat.ts` | CREATE | SSE streaming hook |
| `frontend/app/lib/api.ts` | MODIFY | Add SSE, session, PDF functions |
| `frontend/app/lib/katex-utils.ts` | CREATE | Shared KaTeX rendering |
| `frontend/app/globals.css` | MODIFY | Bubble animations, polish |
| `backend/routers/session.py` | CREATE | Session CRUD endpoints |
| `backend/routers/chat_stream.py` | CREATE | SSE streaming endpoint |
| `backend/routers/pdf.py` | CREATE | PDF text extraction |
| `backend/services/session_store.py` | CREATE | Filesystem session store |
| `backend/services/vertex_ai.py` | MODIFY | Add `call_gemini_stream()` |
| `backend/schemas/agent_response.py` | MODIFY | Add session_id, context fields |
| `backend/main.py` | MODIFY | Register new routers |

---

## Verification Checkpoints

- **Phase 1:** Monaco edits update KaTeX preview. PDF uploads and renders. Session survives reload.
- **Phase 2:** Chat responses stream. Diff viewer shows accept/reject.
- **Phase 3:** PDF text selection → AI uses as context.
- **Phase 4:** Siri bubble works for voice + text. Old UI fully removed.
- **Phase 5:** Smooth animations. Full demo flow 3x without issues.

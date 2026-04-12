# Voice-to-LaTeX AI Editor — Refined Implementation Plan

This document outlines the finalized and updated phase-by-phase implementation plan based on your latest requirements including Response Streaming, Universal Review, the 3-Panel Layout, Bubble UI, and Session Management.

## Tech Stack & Architecture (Google Stack Focus)

- **Frontend:** Next.js (React), Tailwind CSS, Framer Motion.
- **UI Components:** 
  - **Left Panel:** PDF Viewer / Assignment Viewer (react-pdf or standard iframe block).
  - **Middle Panel:** Code/Text Editor (handling raw LaTeX).
  - **Right Panel:** Live KaTeX/MathJax preview.
  - **Floating Interface:** Bottom-middle action bubble containing the default "Glowing Siri-style" Voice button and an optional Chat toggle.
- **Backend:** FastAPI (Python) orchestrating the workflow.
- **AI/Reasoning:** Vertex AI (Gemini 2.0 Flash) with **Response Streaming** mapping out edits and chat tokens.
- **Voice (STT):** Google Cloud Speech-to-Text.
- **State/Session Management:** Database or persistent file-storage backend (e.g., SQLite/JSON local files for MVP natively tracking Session ID -> Documents & Chat History).

---

## 🛠 Model Design & Universal Review System

### 1. Document Modification Lifecycle (Universal Review)
*Every* change suggested by the AI—whether from an intent command ("Make this a fraction") or a tool call (SymPy)—triggers the Universal Review Flow:
1. User provides input (Voice or Chat).
2. Vertex AI identifies the intent and streams the text response / planned edits back to the frontend.
3. The frontend displays the proposed changes as a **Pending Diff/Suggestion Review** overlaid on the Middle Panel or Right Panel.
4. The user accepts or rejects the change before it fundamentally modifies the central document state.

### 2. Response Streaming
- FastAPI will leverage async generators (`yield`) to stream Vertex AI's text responses and JSON structural modifications on-the-fly.
- Server-Sent Events (SSE) or WebSockets will deliver the chunks to Next.js for a lightning-fast responsive feel.

### 3. Session & File Persistence
- Instead of static presets, the app will support **Sessions**.
- A session encompasses:
  1. The uploaded assignment PDF.
  2. The current LaTeX document state.
  3. The Chat history.
- Local JSON storage or an SQLite DB is required in the backend to save/load these sessions across page reloads.

---

## Phase 1: Foundation, 3-Panel Layout & Bubble UI (Hours 1-4)
**Goal:** Setup Next.js, FastAPI, and the full UI shell.
- Create the 3-Panel Grid layout (PDF Dropzone | LaTeX Editor | KaTeX Preview).
- Build the **Bottom-Middle Bubble Component**: Focus heavily on Tailwind/Framer Motion to make a glowing Siri-style voice button as the centerpiece, with an expandable/flyout chat interface embedded within the bubble.
- Scaffold FastAPI, set up SQLite/Local file Session Management (Save/Load document state and PDF blobs).

## Phase 2: Vertex AI Agent, Streaming & Universal Review (Hours 5-9)
**Goal:** Hook up the agent to stream suggestions and enforce the Code-Review flow for ALL edits.
- Integrate Vertex AI SDK with streaming capabilities in FastAPI (SSE endpoints).
- Define the `AgentResponse` streaming schema (streaming chat text alongside JSON diff logic).
- Wire the frontend so that any AI edit produces a "Review Suggestion" UI block (Accept/Reject) over the editor.
- Connect the Chat section of the bubble to display streamed conversational responses.

## Phase 3: Google Speech-to-Text & Voice-First Loop (Hours 10-13)
**Goal:** Bring the Siri-style button to life with STT.
- Integrate Google Cloud Speech-to-Text. 
- Map the microphone capture to the glowing Voice button.
- Route transcribed text instantly into the Phase 2 Agent logic.
- Ensure the user can simply click, speak, and see the Review UI pop up.

## Phase 4: Explicit Tool Calling & SymPy Math Solver (Hours 14-17)
**Goal:** Add heavy deterministic math capabilities.
- Register explicit Python tools (SymPy operations) with Vertex AI.
- Define multi-turn execution (Gemini -> SymPy -> Gemini -> Streamed Output -> Universal Review).
- This operates seamlessly inside the existing Phase 2 Review flow.

## Phase 5: PDF Integration & Polish (Hours 18-20)
**Goal:** Finalize drag-and-drop, state persistence, and aesthetics.
- Implement the Left Panel PDF Dropzone properly (reading/rendering PDFs natively within the UI).
- Ensure saving a session serializes the PDF state, LaTeX doc, and chat history.
- Refine animations.

---

## 🔍 Unimplemented Items Checklist
_Based on your earlier `detailed_implementation_plan.md` and current codebase:_
- [ ] Requirements.txt is initiated with GCP dependencies, but we need `python-multipart` (for file uploads/PDFs), and `SQLAlchemy`/`sqlite3` (for Session management).
- [ ] No database/persistence layer has been built yet.
- [ ] Frontend currently has NO code; the 3-panel UI and action bubble need to be built entirely from scratch.
- [ ] SSE / WebSocket streaming infrastructure needs to be bootstrapped in FastAPI.
- [ ] The "Diff/Review Block" UI for reviewing raw strings needs a library (like `diff-match-patch` or a Monaco Diff Editor integration).

---

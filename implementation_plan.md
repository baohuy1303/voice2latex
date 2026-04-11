# Voice-to-LaTeX AI Editor Implementation Plan

This document outlines the finalized phase-by-phase implementation plan for building the Voice-to-LaTeX AI Editor (Agentic Math Workspace) as a 20-hour hackathon project, built fundamentally on Google Cloud infrastructure.

## Proposed Tech Stack (Google Ecosystem Focus)

- **Frontend:** Next.js (React), **Tailwind CSS** for styling, Framer Motion for smooth transitions between Voice/Chat modes.
- **Editor:** A fully functional code/text editor (e.g., Monaco Editor or a standard `textarea`) allowing basic typing, copy-pasting, and raw manual editing alongside the AI functionality.
- **LaTeX Rendering:** KaTeX (faster, great for React) or MathJax.
- **Backend Orchestration:** FastAPI (Python) for execution, WebSocket support, and Python ecosystem integration.
- **AI/Reasoning Machine:** **Google Vertex AI**.
  - **Vertex AI Agent Layer:** Used to govern the overall control flow and logic.
  - **Structured JSON Output:** Guaranteeing safe, deterministic edits (e.g., returning `{ "intent": "edit", "new_latex": "..."}`).
  - **Tool Calling System:** Explicitly defined functions (e.g., `solve_sympy`, `format_latex`) registered with Vertex AI.
- **Voice (STT):** **Google Cloud Speech-to-Text** to ensure high-fidelity math/speech transcription and deep GCP integration.
- **Math Solver:** Dual-engine. Gemini acts as the main reasoning brain, natively invoking **SymPy (Python)** via explicit Tool Calling to verify and solve equations deterministically.
- **Deployment (Stretch Goal):** Google Cloud Run (for the FastAPI backend server) and Firebase Hosting or Google Cloud Run (for the Next.js frontend).

---

## 🛠 Model Design & State Management

### The Document State & Structured Output
The system uses a **Single Long LaTeX String** but utilizes **Gemini's Structured JSON Output** to ensure the edits are perfectly stable.
1. Frontend holds the entire document as one string.
2. User asks the agent to modify the document.
3. FastAPI backend prompts Vertex AI, enforcing a JSON Schema response.
4. Vertex AI replies deterministically (e.g., `{ "action": "replace", "original_snippet": "x+1", "new_snippet": "\\int (x+1) dx", "full_document": "..." }`).
5. Frontend diffs the changes into the editor panes.

### SymPy Math Tool Call Lifecycle
1. User provides a command like: "Solve this equation".
2. Vertex AI identifies the intent and invokes the explicit `solve_equation_sympy` tool via the **Tool Calling System**.
3. SymPy tool computes the step-by-step LaTeX solution on the backend.
4. Vertex AI gathers the output, frames it elegantly into Structured JSON, and flags it as a "suggestion".
5. Frontend displays a diff/preview. User confirms insertion, and the doc updates.

---

## Phase 1: Foundation, Editor, & Frontend Setup (Hours 1-3)
**Goal:** Setup the Next.js/Tailwind frontend, the manual editor pane, and the backend.
- Initialize Next.js frontend with Tailwind CSS.
- Setup FastAPI backend with CORS and basic `/ping` endpoints.
- Build the core **Split-view interface** (Chat UI | Raw Editor Pane | Live KaTeX Display).
- Setup the Google Cloud Project and create service account credentials for local development.

## Phase 2: Vertex AI Agent & Document Manipulation (Hours 4-7)
**Goal:** Hook up the agent so that typing commands manipulates the LaTeX string securely via JSON.
- Integrate the `google-cloud-aiplatform` (Vertex AI SDK) into the FastAPI backend.
- Define the Pydantic schema for Gemini's **Structured JSON Output** (e.g., `UpdateDocumentResponse`).
- Implement the baseline agent logic that inputs the user command + full document and outputs the exact JSON modification.
- Hook up chat interface to dynamically update the text editor pane.

## Phase 3: Google Speech-to-Text Integration (Hours 8-11)
**Goal:** Add high-fidelity STT to drive AI manipulations.
- Integrate **Google Cloud Speech-to-Text API** (streaming or synchronous depending on requirements).
- Setup microphone capture in the Next.js app and route audio to the FastAPI backend for transcription via GCP.
- Develop the "Full Screen Document" Voice Mode with minimalist UI.
- Pass transcribed output immediately into the Phase 2 Vertex AI pipeline.

## Phase 4: Explicit Tool Calling & Math Solver (Hours 12-16)
**Goal:** Register function declarations and build the SymPy integration.
- Build explicit Python tools (e.g., `def run_sympy_solve(...)`) and register them within the Vertex AI Tool Calling framework.
- Handle multi-turn tool execution logic in FastAPI (Gemini requests tool -> FastAPI runs it -> FastAPI returns result to Gemini).
- Build the frontend UI diff block for reviewing pending SymPy suggestions.

## Phase 5: GCP Deployment & Hackathon Polish (Hours 17-20)
**Goal:** Final feature refinement and deploying the stack.
- Containerize the FastAPI backend with Docker and deploy to **Google Cloud Run**.
- Deploy Next.js frontend (Vercel or Google Cloud Run).
- Refine Framer Motion aesthetic transitions and fix edge-case bugs.
- Prepare demo dataset and rehearse demo flows.

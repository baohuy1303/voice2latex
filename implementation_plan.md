# Voice-to-LaTeX AI Editor Implementation Plan

This document outlines the finalized phase-by-phase implementation plan for building the Voice-to-LaTeX AI Editor (Agentic Math Workspace) as a 20-hour hackathon project.

## Proposed Tech Stack

- **Frontend:** Next.js (React), **Tailwind CSS** for styling, Framer Motion for smooth transitions between Voice/Chat modes.
- **Editor:** A fully functional code/text editor (e.g., Monaco Editor or a powerful standard `textarea`) allowing basic typing, copy-pasting, and raw manual editing alongside the AI functionality.
- **LaTeX Rendering:** KaTeX (faster, great for React) or MathJax.
- **Backend:** FastAPI (Python) for fast execution, WebSocket support, and Python ecosystem integration.
- **AI/Reasoning:** Google Gemini API for heavy lifting (intent classification, raw latex document modification, math reasoning).
- **Voice (STT):** Fast Web Speech API or Deepgram transcriptions to act as the primary voice interaction layer.
- **Math Solver:** A dual-engine approach. Gemini acts as the main reasoning brain, optionally calling **SymPy (Python)** to verify and solve equations deterministically, presenting them as a preview for user approval (similar to IDE code review).

---

## 🛠 Model Design & State Management

### The Document State
Instead of maintaining a complex JSON structure of blocks, the system will use a **Single Long LaTeX String**.
- The frontend holds the entire document as one string.
- When the user asks the agent to modify the document (e.g., "Change question 1 to an integral"), the frontend sends the *entire string* (and selection offsets if applicable) to the backend. 
- The Gemini agent rewrites/targets the replacement and returns the updated document, which diffs smoothly back into the editor.

### SymPy Math Tool Call Lifecycle
1. User provides a command like: "Solve this equation".
2. Gemini receives the command, identifies the intent, and activates the `solve_equation_sympy` tool.
3. The SymPy tool computes the step-by-step LaTeX solution on the backend.
4. Gemini gathers the output, frames it elegantly, and sends it to the frontend as a **Pending Suggestion Mode**.
5. The frontend displays the suggested math block (IDE style diff/highlight preview).
6. User confirms the insertion, and the document state updates.

---

## Phase 1: Foundation, Editor, & Frontend Setup (Hours 1-3)
**Goal:** Setup the Next.js/Tailwind frontend, the manual editor pane, and the backend.
- Initialize Next.js frontend with Tailwind CSS.
- Setup FastAPI backend with CORS and basic `/ping` endpoints.
- Build the core **Split-view interface**: 
  - Left panel: Chat UI.
  - Middle: Raw text editor pane (standard typing, copy/paste capabilities).
  - Right: Live KaTeX document display.

## Phase 2: Core AI Document Manipulation (Hours 4-7)
**Goal:** Hook up the agent so that typing commands into the chat can correctly manipulate the central LaTeX string.
- Implement Gemini API integration in the API backend.
- Build prompts to instruct Gemini to take the input commands and the *entire LaTeX document string*, make reasoning choices, and return the modified LaTeX.
- Hook up the frontend chat panel to these endpoints and demonstrate basic modification.

## Phase 3: Voice / STT Integration (Hours 8-11)
**Goal:** Add Speech-to-Text to drive AI manipulations without typing.
- Setup microphone capture in the Next.js app using Web Speech API (or Deepgram).
- Develop the "Full Screen Document" Voice Mode with minimalist, clean UI.
- Wire the transcribed sentences into the Phase 2 AI modifier.

## Phase 4: Math Solver & "Code Review" Tooling (Hours 12-16)
**Goal:** Give the agent SymPy access and build the UI layer for accepting/rejecting solutions.
- Expose a SymPy Tool to the Gemini Agent in FastAPI.
- Modify the API response to distinguish between "Direct Modificaton" vs "Suggestion/Solution Request".
- When a suggestion is returned, render an inline Code-Review-like Diff in the UI, requiring user approval before embedding it into the main state string.

## Phase 5: Polish & Hackathon Demo (Hours 17-20)
**Goal:** Final feature refinement, animations, and bug fixes.
- Refine Framer Motion aesthetic transitions between pure Editor/Chat and minimalist Voice Mode.
- Perfect highlighting interactions (capturing substring indexes in the editor and showing context to AI).
- Freeze UI, rehearse demo flows, test edge cases (invalid LaTeX).

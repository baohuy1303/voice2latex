# Agentic AI Capabilities

This document outlines the specific "Agentic" capabilities and tools powered by Google Gemini and the related verification/tool-execution pipeline in the StemFlow backend.

## 1. Symbolic Math Engine (via SymPy)

In **Edit Mode**, the AI can proactively pause its text generation to execute real Python mathematical functions via SymPy before responding:
- **`solve_equation`**: Used for finding roots or meeting structural constraints in equations (e.g., "solve for x").
- **`simplify_expression`**: Handles algebraic simplification, expanding polynomials, and reducing trigonometric identities.
- **`differentiate`**: Calculates exact symbolic derivatives for any given mathematical expression.
- **`integrate`**: Computes both definite and indefinite integrals symbolically.

## 2. Multi-Modal Vision & Parsing

- **Context Snippet Awareness**: The AI digests physical snippets of text selected from the PDF panel or the KaTeX Preview panel. It treats these as "ground truth" reference materials to fulfill requests or modify the document contextually.
- **Image Understanding (Vision)**: The backend routes Base64-encoded images (like screenshots or hand-drawn math diagrams) directly to Gemini, instructing it to synthesize the structural formatting into valid LaTeX code.

## 3. Voice Intent Extraction

- **Transcription + Intelligent Action**: Instead of simply stringing together Voice-to-Text and a generic prompt, the `call_gemini_with_audio` controller allows the native multimodal LLM to listen to the user's voice and map it mathematically to a document action (e.g., "undo that change", "add a 3x3 matrix here") in a single, coherent reasoning step.

## 4. Automatic LaTeX "Self-Correction" (Sanitization)

- The backend runs an invisible **Sanitization Agent** (`latex_sanitizer.py`) that acts as a guardrail. If the primary generative AI hallucinates invalid LaTeX blocks (e.g., mixing `\[` with nested `\begin{align}`) or uses tags that break the KaTeX parser (such as `\vspace`), the sanitizer intercepts, corrects the syntax, and ensures stable rendering before it hits the frontend.

## 5. Socratic Teaching Agent

- In **Tutor Mode**, the AI agent abandons document mutation and switches its system prompts entirely. It acts as a pedagogical guide—parsing student mistakes and guiding them through Socratic questioning rather than just outputting the bare math answers.

## 6. PDF Extraction & Normalization

- **Math Context Normalization**: When extracting text directly from a PDF, mathematical symbols often get garbled (e.g., $x^2$ becomes $x2$). A sub-agent in the chat router automatically intercepts this raw PDF text and reconstructs structurally sound LaTeX *before* sending it to the main LLM for processing, significantly increasing the accuracy of referencing.

# StemFlow

## Inspiration
Students in STEM do not just struggle with solving problems, they struggle with submitting them. They work in PDFs or on paper, then waste time translating everything into LaTeX or code. For professors and researchers, it is the reverse: turning rough STEM work into clean, structured documents.

## What it does
StemFlow is a STEM workspace that combines voice transcription, PDF context extraction, AI-powered reasoning, and LaTeX editing into one seamless flow. It acts as an agentic workspace engineered for how STEM work actually happens, reducing the friction between analytical thought and structured digital documentation.

## How we built it
StemFlow features a Next.js (TypeScript) frontend coupled with a FastAPI backend. We utilized Google Gemini (Vertex AI) to power the core agentic reasoning loops. A multi-modal architecture was designed to parse text, images, and speech (Google Cloud Speech-to-Text). The backend leverages Python's SymPy library as an isolated deterministic solver, ensuring the AI can definitively evaluate complex mathematics before generating final LaTeX structures.

## Challenges we ran into
Integrating multiple modalities presented several hurdles:
- Structuring consistent and correct LaTeX formatting from unpredictable AI outputs.
- Calibrating Vertex AI prompts to maintain structural integrity without hallucinating syntax.
- Handling real-time voice transcription accurately in the context of advanced math terminology.
- Building a robust, fully supported LaTeX editor capable of live differential updates.
- Normalizing garbled text extraction from embedded PDF preview layers.

## Accomplishments that we're proud of
StemFlow was fully conceptualized, engineered, and deployed in 24 hours during a hackathon at WashU. We successfully delivered a functional tool that tangibly solves a widespread academic pain point for students and researchers alike.

## What we learned
We gained critical experience orchestrating complex AI agent pipelines and connecting deterministic logic (SymPy) with non-deterministic LLMs. On the infrastructure side, we learned the importance of tight resource management and having backup cloud credits, as scaling multimodal AI operations is highly resource-intensive.

## What's next for StemFlow
- Broader integration of underlying structural models.
- Dedicated cloud deployment for accessible remote hosting.
- Direct integrations into popular Learning Management Systems (LMS).

---

## Workspace Features

StemFlow provides a focused environment for iterative math authoring. Instead of treating AI as a one-off prompt box, the product is built around a live working document.

- **LaTeX Editor & Live Preview**: Write or paste raw LaTeX and immediately see formatted math as you edit.
- **Multimodal AI Assistant**: Use text or voice input to instruct the AI (e.g., "simplify this", "solve this", "format as a matrix").
- **PDF Context Retrieval**: Upload PDFs side-by-side with your editor. Select text from the PDF to feed direct context to the AI.
- **Agentic Diff Review**: The assistant proposes changes directly in a code difference viewer, allowing you to accept or reject edits intelligently.
- **PDF Compilation**: Compile your workspace into a distributable `.pdf` binary effortlessly.
- **Session Persistence**: Auto-save your workspaces and seamlessly reload old documents and PDFs.

## Prerequisites

Before running locally, make sure you have:
- Node.js 20+ and npm
- Python 3.11+
- A Google Cloud Project (Vertex AI and Speech API enabled)
- A valid Google Service Account JSON key

## Local Setup

To run the project locally, you must run both the backend and frontend simultaneously.

### 1. Backend Setup

Open a terminal and navigate to the `backend` directory:
```cmd
cd backend
python -m venv .venv
```

Activate the virtual environment:
* Windows Command Prompt: `.venv\Scripts\activate.bat`
* Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
* Mac/Linux: `source .venv/bin/activate`

Install dependencies:
```cmd
pip install -r requirements.txt
pip install python-multipart
```

Create a `.env` file in the `backend` folder:
```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your-service-account.json
```

Start the API:
```cmd
python -m uvicorn main:app --reload --port 8000
```
*You can verify the backend is running by visiting `http://127.0.0.1:8000/ping`*

### 2. Frontend Setup

Open a second terminal and navigate to the `frontend` directory:
```cmd
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:3000` in your browser.

## Architecture

For a detailed breakdown of the agentic AI pipeline, data flows, tool integrations, and Mermaid.js system diagrams, see **[agentic_tools.md](./agentic_tools.md)**.

## Contributors
- Huy B. Huynh - https://github.com/baohuy1303
- Amen Bush - https://github.com/amen2x

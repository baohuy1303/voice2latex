# StemFlow — Agentic Architecture

This document describes the full system architecture of StemFlow: the AI agent pipeline, data flows, tool integrations, and agentic capabilities powered by Google Gemini and SymPy.

---

## System Overview

```mermaid
graph TB
    subgraph Browser["🌐 Browser — Next.js 16 / React"]
        UI["3-Panel Layout\nPDF · Editor · Preview"]
        SB["SiriBubble\nVoice + Chat UI"]
        CT["ContextTray\nSelected Snippets"]
        EP["EditorPanel\nMonaco + Diff Viewer"]
        LP["LatexPreview\nKaTeX Live Render"]
        PP["PdfPanel\nreact-pdf viewer"]
    end

    subgraph API["⚡ Next.js API Routes"]
        PROXY["/api/compile\nServer-side proxy"]
    end

    subgraph Backend["🐍 FastAPI Backend — port 8000"]
        CHAT["/api/chat\nSync chat"]
        STREAM["/api/chat/stream\nSSE streaming"]
        VOICE["/api/voice/transcribe\nAudio → text"]
        SESSION["/api/session\nCRUD + PDF upload/serve"]
        COMPILE_R["/api/compile\nLaTeXLite proxy"]
        PDF_NORM["normalize_pdf_context()\nPDF math cleanup"]
    end

    subgraph Agent["🤖 Gemini Agent Pipeline"]
        direction TB
        G_EDIT["call_gemini()\nEdit Mode"]
        G_TUTOR["call_gemini()\nTutor Mode"]
        G_NORM["normalize_pdf_context()\nFast cleanup pass"]
        G_VOICE["_transcribe_with_gemini()\nAudio transcription"]
        TOOLS["SymPy Tool Loop\nsolve · simplify\ndifferentiate · integrate"]
        SANITIZE["latex_sanitizer.py\nKaTeX guardrail"]
    end

    subgraph External["☁️ External Services"]
        GEMINI["Google Gemini\ngemini-2.5-flash\nVertex AI"]
        LATEXLITE["LaTeXLite API\nPDF compilation"]
    end

    subgraph Storage["💾 Persistence"]
        FS["backend/sessions/id/\nstate.json\ndocument.pdf"]
        LS_STORE["localStorage\ncurrent session ID"]
    end

    %% User → Frontend
    UI -->|"drop PDF"| SESSION
    SB -->|"text + optional images"| CHAT
    SB -->|"audio blob (webm)"| VOICE
    CT -->|"context snippets"| CHAT
    UI -->|"compile request"| PROXY
    PROXY --> COMPILE_R

    %% Session persistence
    SESSION <--> FS
    LS_STORE -->|"restore on load"| SESSION
    SESSION -->|"fetchSessionPdf()"| PP

    %% Chat routing
    CHAT -->|"if context present"| PDF_NORM
    PDF_NORM -->|"clean context"| G_EDIT
    CHAT -->|"edit mode"| G_EDIT
    CHAT -->|"tutor mode"| G_TUTOR

    %% Agent pipeline
    G_EDIT <-->|"all function calls\none response per call"| TOOLS
    G_EDIT --> SANITIZE
    G_TUTOR --> SANITIZE

    %% Gemini calls
    G_EDIT <--> GEMINI
    G_TUTOR <--> GEMINI
    G_NORM <--> GEMINI
    G_VOICE <--> GEMINI

    %% Compile
    COMPILE_R --> LATEXLITE

    %% Responses back to UI
    CHAT -->|"AgentResponse JSON"| SB
    CHAT -->|"new_document → pendingDocument"| EP
    EP -->|"Accept diff"| UI
    EP -->|"Reject diff"| UI
```

---

## Voice → Document Flow

```mermaid
sequenceDiagram
    actor User
    participant Orb as SiriBubble
    participant FE as Frontend
    participant Voice as /voice/transcribe
    participant Chat as /chat
    participant Gemini as Gemini (Vertex AI)

    User->>Orb: Tap mic → record
    Note over Orb: 🔴 Recording (red pulse)
    User->>Orb: Tap mic → stop
    Orb->>FE: audio blob (webm)
    Note over Orb: 🟡 Transcribing (amber + waveform)
    FE->>Voice: POST audio/webm
    Voice->>Gemini: audio + math-aware transcription prompt
    Note over Gemini: Strips filler words\nPreserves math terminology
    Gemini-->>Voice: clean transcript string
    Voice-->>FE: { transcript }
    Note over Orb: 🔵 Thinking (blue bounce)
    FE->>Chat: POST { message, document, context, mode }
    Chat->>Gemini: agent prompt + tools
    Gemini-->>Chat: AgentResponse JSON
    Chat-->>FE: { action, new_document, reply }
    FE->>FE: setPendingDocument()
    Note over Orb: 🟣 Idle (purple glow)
    FE-->>User: Diff shown in editor\n→ Accept or Reject
```

---

## PDF Context Pipeline

```mermaid
flowchart LR
    A["User selects text\nin PDF viewer"] -->|"raw PDF.js extraction\n(may be garbled)"| B["ContextTray\nstores raw snippet"]
    B -->|"on chat send"| C["normalize_pdf_context()\nGemini fast-pass\nx2→x^2 · xn→x^n\nα→\\alpha · a/b→\\frac{a}{b}"]
    C -->|"clean LaTeX string"| D["Prepended to\nuser message as\nReference material"]
    D --> E["call_gemini()\nEdit Mode"]
    E <-->|"if math ops needed"| F["SymPy tools"]
    F --> E
    E -->|"AgentResponse"| G["Diff shown\nin EditorPanel"]
```

---

## Image Transcription Flow

```mermaid
flowchart TD
    A["User attaches image\n+ optional text"] --> B{Message contains\nsolve / calculate\nfind / evaluate?}
    B -->|"No — default"| C["Transcription-only prompt\n'Extract exactly what\nis visibly written as LaTeX'"]
    B -->|"Yes — explicit"| D["Standard edit prompt\n+ SymPy tools available"]
    C --> E["Gemini reads image\ntranscribes notation only\nno solving"]
    D --> F["Gemini solves\nusing SymPy tools\nwrites inline in doc"]
    E --> G["Content appended\nto document"]
    F --> G
```

---

## Gemini Tool Calling Loop

```mermaid
flowchart TD
    A["Build contents array\nhistory + images + prompt"] --> B["POST to Gemini\nwith SymPy tools enabled\nmax 3 iterations"]
    B --> C{Response contains\nfunction calls?}
    C -->|"Yes"| D["Collect ALL function calls\nfrom this turn\n(may be multiple)"]
    D --> E["Execute each tool:\nsolve_equation\nsimplify_expression\ndifferentiate\nintegrate"]
    E --> F["Build one FunctionResponse\npart per call\n(count must match exactly)"]
    F --> G["Append model turn +\nall responses in\none user turn"]
    G --> B
    C -->|"No"| H["Parse JSON response\nfrom final text"]
    H --> I["latex_sanitizer.py\nstrip banned commands\nfix delimiters"]
    I --> J{Bad KaTeX\npatterns remain?}
    J -->|"Yes"| K["Retry once with\nstructured output schema\n(no tools)"]
    J -->|"No"| L["Return AgentResponse\n{ action · new_document\nreply · explanation }"]
    K --> L
```

---

## Session Persistence

```mermaid
flowchart LR
    subgraph FE["Frontend"]
        LS2["localStorage\nvoice2latex_session"]
        RS["React state\ndocument · messages\npdfFile · history"]
    end

    subgraph BE["backend/sessions/id/"]
        JSON["state.json\ndocument · history\ncreated_at · updated_at"]
        PDFFILE["document.pdf\n(optional)"]
    end

    LS2 -->|"session ID on page load"| BE
    BE -->|"GET /session/:id → state.json"| RS
    BE -->|"GET /session/:id/pdf\nfetchSessionPdf()"| RS
    RS -->|"PUT /session/:id\nafter every AI response"| JSON
    RS -->|"POST /session/:id/upload\non PDF drop"| PDFFILE
```

---

## Agentic Capabilities Summary

| Capability | Mode | Implementation |
|---|---|---|
| Symbolic equation solving | Edit | `solve_equation` via SymPy tool call |
| Expression simplification | Edit | `simplify_expression` via SymPy tool call |
| Symbolic differentiation | Edit | `differentiate` via SymPy tool call |
| Symbolic integration | Edit | `integrate` via SymPy tool call |
| Math-aware voice transcription | Both | Gemini multimodal audio, filler-word removal |
| Image → LaTeX transcription | Edit | Gemini vision, transcription-only by default |
| PDF math reconstruction | Edit | `normalize_pdf_context()` pre-pass before main call |
| Socratic tutoring | Tutor | Separate system instruction, no document mutation |
| LaTeX self-correction | Both | `latex_sanitizer.py` + structured-output retry |
| Agentic diff review | Edit | `pendingDocument` state → Monaco DiffEditor → Accept/Reject |
| PDF compilation | Both | LaTeXLite API via server-side proxy |
| Session persistence | Both | JSON + PDF stored per session on disk |

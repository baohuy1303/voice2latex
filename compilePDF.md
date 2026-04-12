# compilePDF.md — Plan: LaTeX → PDF Compilation via latex.online

## Context

The current preview uses KaTeX which only renders math. The editor holds raw LaTeX source (math-focused, no document preamble). This plan adds a "Compile PDF" feature: the backend wraps the editor content in a full LaTeX document skeleton and calls the **latex.online** API to compile it, then streams the PDF back to the frontend.

**No local LaTeX installation required.** No MiKTeX, no TeX Live.
Only addition to requirements: `httpx` (async HTTP client).

The public instance lives at `https://latex.online`. It is also self-hostable via Docker if the public instance is unavailable or rate-limited in the future.

---

## How latex.online Works

```
GET https://latex.online/compile?text=<url-encoded .tex source>&command=pdflatex
```

- Returns `HTTP 200` + PDF bytes on success
- Returns `HTTP 4xx` + plain-text error log on failure
- `command=` accepts `pdflatex`, `xelatex`, `lualatex`
- `force=true` bypasses cache
- Built-in memcached caching — identical source returns instantly on repeat

**URL length note:** GET requests with very large `?text=` params can exceed server limits (~8 KB). The backend should fall back to a POST with the source in the request body if the encoded source is large. The latex.online source accepts POST as well.

**Self-hosting (future):**
```bash
docker pull aslushnikov/latex-online
docker run -d -p 2700:2700 -t aslushnikov/latex-online
```
Swap the base URL in the service from `https://latex.online` to `http://localhost:2700`.

---

## Files to Change

| File | Change |
|---|---|
| `backend/requirements.txt` | Add `httpx` |
| `backend/services/latex_compiler.py` | New service: calls latex.online API |
| `backend/routers/compile.py` | New router — `/api/compile` endpoint |
| `backend/main.py` | Register new router |
| `frontend/app/lib/api.ts` | Add `compileToPdf()` fetch function |
| `frontend/app/page.tsx` | Add compile button + state, wire up PDF display |

---

## Backend

### 1. `backend/requirements.txt`

Add one line:
```
httpx
```

---

### 2. `backend/services/latex_compiler.py` (new file)

```python
import urllib.parse
import httpx
from pathlib import Path

LATEX_ONLINE_URL = "https://latex.online/compile"

DOCUMENT_SKELETON = r"""
\documentclass{{article}}
\usepackage{{amsmath, amssymb, amsfonts, mathtools}}
\usepackage{{geometry}}
\geometry{{margin=1in}}
\usepackage{{parskip}}
\begin{{document}}
{content}
\end{{document}}
"""

def _normalize(source: str) -> str:
    """Convert $$...$$ to \[...\] for pdflatex compatibility."""
    parts = source.split("$$")
    result = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            result.append(r"\[" + part + r"\]")
        else:
            result.append(part)
    return "".join(result) if len(parts) > 1 else source


async def compile_latex(source: str) -> bytes:
    """
    Wrap source in a document skeleton, compile via latex.online, return PDF bytes.
    Raises RuntimeError with the compiler error log on failure.
    """
    normalized = _normalize(source)
    full_source = DOCUMENT_SKELETON.format(content=normalized)

    params = {"command": "pdflatex"}
    encoded = urllib.parse.urlencode({"text": full_source})

    async with httpx.AsyncClient(timeout=40.0) as client:
        # Use GET for small docs, POST for large ones (URL length limit ~8KB)
        if len(encoded) < 7000:
            response = await client.get(
                LATEX_ONLINE_URL,
                params={**params, "text": full_source},
            )
        else:
            response = await client.post(
                LATEX_ONLINE_URL,
                params=params,
                content=full_source.encode("utf-8"),
                headers={"Content-Type": "application/x-tex"},
            )

    if response.status_code != 200:
        raise RuntimeError(response.text[:1000])

    return response.content
```

**Key decisions:**
- `httpx.AsyncClient` integrates cleanly with FastAPI's async model — no thread executor needed
- GET for small docs, POST for large ones to avoid URL length limits
- 40s timeout gives the remote compiler room to breathe
- `_normalize` converts `$$...$$` → `\[...\]` since the AI outputs the former

---

### 3. `backend/routers/compile.py` (new file)

```python
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from services.latex_compiler import compile_latex

router = APIRouter()

class CompileRequest(BaseModel):
    source: str

@router.post("/compile")
async def compile_pdf(request: CompileRequest):
    try:
        pdf_bytes = await compile_latex(request.source)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=document.pdf"},
        )
    except RuntimeError as e:
        return Response(
            content=str(e).encode(),
            status_code=422,
            media_type="text/plain",
        )
    except Exception as e:
        return Response(
            content=f"Compile service unavailable: {str(e)[:200]}".encode(),
            status_code=502,
            media_type="text/plain",
        )
```

Note: no `asyncio.wait_for` wrapper needed — `httpx` timeout handles it directly.

---

### 4. `backend/main.py`

```python
from routers import chat, chat_stream, voice, session, compile

app.include_router(compile.router, prefix="/api")
```

---

## Frontend

### 5. `frontend/app/lib/api.ts`

```typescript
export async function compileToPdf(source: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Compile error: ${res.status}`);
  }
  return res.blob();
}
```

---

### 6. `frontend/app/page.tsx`

**New state:**
```typescript
const [isCompiling, setIsCompiling] = useState(false);
const [compileError, setCompileError] = useState<string | null>(null);
```

**New handler:**
```typescript
const handleCompile = useCallback(async () => {
  setIsCompiling(true);
  setCompileError(null);
  try {
    const blob = await compileToPdf(document);
    const file = new File([blob], "compiled.pdf", { type: "application/pdf" });
    setPdfFile(file); // display in PdfPanel

    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "document.pdf";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    setCompileError(err instanceof Error ? err.message : "Compile failed");
  } finally {
    setIsCompiling(false);
  }
}, [document]);
```

Both things happen on one click: the PDF appears in the left panel **and** the browser immediately downloads it. `URL.createObjectURL` / `revokeObjectURL` is the standard pattern — no extra library needed.

**UI — add to header button row (next to Undo):**
```tsx
<button
  onClick={handleCompile}
  disabled={isCompiling || !document.trim()}
  className="px-3 py-1.5 text-xs rounded-md bg-indigo-700 hover:bg-indigo-600 disabled:opacity-30 transition-colors border border-indigo-600/50 text-zinc-200"
>
  {isCompiling ? "Compiling..." : "Compile & Download"}
</button>
```

**Compile error display — below header:**
```tsx
{compileError && (
  <div className="px-4 py-2 text-xs text-red-400 font-mono bg-red-950/30 border-b border-red-900/30 shrink-0">
    {compileError}
  </div>
)}
```

The compiled PDF is fed into `setPdfFile` which already drives `PdfPanel` — no changes needed to the viewer itself.

---

## Document Skeleton

```latex
\documentclass{article}
\usepackage{amsmath, amssymb, amsfonts, mathtools}
\usepackage{geometry}
\geometry{margin=1in}
\usepackage{parskip}
\begin{document}
  <editor content>
\end{document}
```

Covers everything the AI generates: `align`, `equation`, `cases`, `matrix`, `\mathbb`, `\mathcal`, Greek letters, operators, fractions, integrals.

---

## What Compiles Cleanly

| Content | Compiles? | Notes |
|---|---|---|
| `$$\frac{x}{y}$$` | ✓ | Normalized to `\[...\]` |
| `$$\begin{align}...$$` | ✓ | amsmath |
| `$$\begin{cases}...$$` | ✓ | amsmath |
| `$$\begin{matrix}...$$` | ✓ | amsmath |
| `\textbf{...}` | ✓ | Native text mode |
| `\section{...}` | ✓ | article class |
| `\begin{itemize}` | ✓ | article class |
| `\begin{equation}` without `$$` | ✓ | amsmath |
| `\begin{align}` without `$$` | ✓ | amsmath |

---

## Error Handling

latex.online returns the raw compiler log on failure. Common errors:
- `! Undefined control sequence` — unknown command (not in skeleton packages)
- `! Missing $ inserted` — math command used outside math mode
- `! LaTeX Error: \begin{align} ended by \end{document}` — unclosed environment

These are displayed as-is in the red monospace error block in the UI.

---

## Verification

1. Start backend: `uvicorn main:app --reload --port 8000`
2. Quick API test:
   ```bash
   curl -X POST http://localhost:8000/api/compile \
     -H "Content-Type: application/json" \
     -d '{"source": "Hello $x^2$"}' \
     --output test.pdf
   ```
3. Open `test.pdf` — should show "Hello x²"
4. In the UI: type LaTeX → click "Compile PDF" → PDF appears in the left panel
5. Test error: type `\badcommand` → compile → red error message appears
6. Test AI flow: ask AI to write quadratic formula → accept → compile → verify PDF

---

## Out of Scope

- Live/auto-compile on keystroke (network RTT makes this impractical)
- Separate standalone download button (download is triggered automatically on compile)
- Custom `\usepackage` support
- `\newcommand` persistence across compilations (stateless per request)

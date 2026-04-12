import os
import httpx

LATEXLITE_URL = "https://latexlite.com/v1/renders-sync"

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
    Wrap source in a document skeleton, compile via LaTeXLite, return PDF bytes.
    Raises RuntimeError with the compiler error log on failure.
    """
    api_key = os.environ.get("LATEXLITE_API_KEY")
    if not api_key:
        raise RuntimeError("LATEXLITE_API_KEY not set in environment")

    normalized = _normalize(source)
    full_source = DOCUMENT_SKELETON.format(content=normalized)

    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(
            LATEXLITE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"template": full_source},
        )

    if response.status_code not in (200, 201):
        raise RuntimeError(response.text[:1000])

    return response.content

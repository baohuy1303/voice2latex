import os
import json
import re
from pathlib import Path
from google import genai
from google.genai.types import GenerateContentConfig
from services.latex_sanitizer import sanitize_latex

SYSTEM_PROMPT = (Path(__file__).parent.parent / "prompts" / "system_prompt.txt").read_text()

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "action": {
            "type": "STRING",
            "enum": ["replace_all", "insert", "replace_snippet", "no_change"],
        },
        "new_document": {"type": "STRING"},
        "reply": {"type": "STRING"},
        "explanation": {"type": "STRING"},
    },
    "required": ["action", "new_document", "reply"],
}

# Known bad patterns that indicate KaTeX will fail
BAD_PATTERNS = [
    r'\\\[(?!\s*\\begin)',  # \[ as display math (not \[\begin)
    r'\\vspace',
    r'\\hspace\{',
    r'\\newpage',
    r'\\begin\{equation\}',
    r'\\begin\{align\}',
    r'\\begin\{gather\}',
    r'\\begin\{multline\}',
    r'\\\[\d+(\.\d+)?\s*em\]',  # \[1em] spacing hacks
]

_client = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            vertexai=True,
            project=os.getenv("GCP_PROJECT_ID", "washu-devfest"),
            location=os.getenv("GCP_LOCATION", "us-central1"),
        )
    return _client


def _has_bad_latex(latex: str) -> str | None:
    """Check if LaTeX contains known KaTeX-incompatible patterns.
    Returns the first bad pattern found, or None if clean."""
    for pattern in BAD_PATTERNS:
        match = re.search(pattern, latex)
        if match:
            return match.group(0)
    return None


def _call_gemini_raw(
    contents: list,
    config: GenerateContentConfig,
    model: str,
) -> dict:
    """Make a single Gemini API call and parse the JSON response."""
    client = get_client()
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )
    return json.loads(response.text)


def call_gemini(
    user_message: str,
    document: str,
    history: list[dict] | None = None,
) -> dict:
    """Call Gemini with structured JSON output for document editing.

    Pipeline:
    1. Send request to Gemini
    2. Sanitize the LaTeX output (fix common issues)
    3. If still has bad patterns, retry once with fix instructions
    """
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Build the conversation contents
    contents = []

    if history:
        for msg in history:
            contents.append(
                genai.types.Content(
                    role=msg["role"],
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )

    user_prompt = f"""Current document:
```latex
{document}
```

User command: {user_message}"""

    contents.append(
        genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_prompt)],
        )
    )

    config = GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        temperature=0.2,
    )

    # First attempt
    result = _call_gemini_raw(contents, config, model)

    # Sanitize the output
    if "new_document" in result:
        result["new_document"] = sanitize_latex(result["new_document"])

        # Check if sanitized output still has issues
        bad = _has_bad_latex(result["new_document"])
        if bad:
            # Retry once: ask Gemini to fix its own output
            fix_contents = [
                genai.types.Content(
                    role="user",
                    parts=[genai.types.Part(text=(
                        f"Your previous LaTeX output contains `{bad}` which is NOT supported by KaTeX. "
                        f"Fix this document to use ONLY KaTeX-compatible LaTeX. "
                        f"Use $$ for display math, never \\[...\\]. No \\vspace, \\hspace, or environments like align/equation.\n\n"
                        f"Document to fix:\n```latex\n{result['new_document']}\n```"
                    ))],
                )
            ]
            try:
                fixed = _call_gemini_raw(fix_contents, config, model)
                if "new_document" in fixed:
                    fixed["new_document"] = sanitize_latex(fixed["new_document"])
                    result["new_document"] = fixed["new_document"]
            except Exception:
                pass  # Keep the sanitized first attempt

    return result

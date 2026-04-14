import os
import json
import re
from pathlib import Path
from google import genai
from google.genai.types import GenerateContentConfig, Tool, FunctionDeclaration
from services.google_auth import load_google_auth
from services.latex_sanitizer import sanitize_latex
from services.sympy_solver import TOOL_FUNCTIONS

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

# SymPy tool declarations for Vertex AI
MATH_TOOLS = Tool(
    function_declarations=[
        FunctionDeclaration(
            name="solve_equation",
            description="Solve a mathematical equation for a given variable using SymPy. Use this for finding roots, solutions to equations, systems of equations.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "equation_latex": {
                        "type": "STRING",
                        "description": "The equation in LaTeX format (e.g., 'x^2 - 4 = 0')",
                    },
                    "variable": {
                        "type": "STRING",
                        "description": "The variable to solve for (default: 'x')",
                    },
                    "sympy_expression": {
                        "type": "STRING",
                        "description": "The equation as a SymPy-parseable string (e.g., 'x**2 - 4'). Fallback if LaTeX parsing fails.",
                    },
                },
                "required": ["equation_latex", "sympy_expression"],
            },
        ),
        FunctionDeclaration(
            name="simplify_expression",
            description="Simplify a mathematical expression using SymPy. Use for algebraic simplification, trigonometric identities, etc.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "expression_latex": {
                        "type": "STRING",
                        "description": "The expression in LaTeX format",
                    },
                    "sympy_expression": {
                        "type": "STRING",
                        "description": "The expression as a SymPy-parseable string. Fallback if LaTeX parsing fails.",
                    },
                },
                "required": ["expression_latex", "sympy_expression"],
            },
        ),
        FunctionDeclaration(
            name="differentiate",
            description="Compute the derivative of an expression with respect to a variable using SymPy.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "expression_latex": {
                        "type": "STRING",
                        "description": "The expression in LaTeX format",
                    },
                    "variable": {
                        "type": "STRING",
                        "description": "The variable to differentiate with respect to (default: 'x')",
                    },
                    "sympy_expression": {
                        "type": "STRING",
                        "description": "The expression as a SymPy-parseable string. Fallback if LaTeX parsing fails.",
                    },
                },
                "required": ["expression_latex", "sympy_expression"],
            },
        ),
        FunctionDeclaration(
            name="integrate",
            description="Compute the integral of an expression using SymPy. Supports both definite (with bounds) and indefinite integrals.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "expression_latex": {
                        "type": "STRING",
                        "description": "The expression in LaTeX format",
                    },
                    "variable": {
                        "type": "STRING",
                        "description": "The variable to integrate with respect to (default: 'x')",
                    },
                    "lower_bound": {
                        "type": "STRING",
                        "description": "Lower bound for definite integral (e.g., '0'). Omit for indefinite.",
                    },
                    "upper_bound": {
                        "type": "STRING",
                        "description": "Upper bound for definite integral (e.g., '1'). Omit for indefinite.",
                    },
                    "sympy_expression": {
                        "type": "STRING",
                        "description": "The expression as a SymPy-parseable string. Fallback if LaTeX parsing fails.",
                    },
                },
                "required": ["expression_latex", "sympy_expression"],
            },
        ),
    ]
)

# Known bad patterns that indicate KaTeX will fail
BAD_PATTERNS = [
    r'\\\[(?!\s*\\begin)',
    r'\\vspace',
    r'\\hspace\{',
    r'\\newpage',
    r'\\begin\{equation\}',
    r'\\begin\{align\}',
    r'\\begin\{gather\}',
    r'\\begin\{multline\}',
    r'\\\[\d+(\.\d+)?\s*em\]',
]

_client = None
MAX_TOOL_ITERATIONS = 3


def get_client() -> genai.Client:
    global _client
    if _client is None:
        credentials, discovered_project = load_google_auth()

        _client = genai.Client(
            vertexai=True,
            project=os.getenv("GCP_PROJECT_ID") or discovered_project or "washu-devfest",
            location=os.getenv("GCP_LOCATION", "us-central1"),
            credentials=credentials,
        )
    return _client


def _has_bad_latex(latex: str) -> str | None:
    for pattern in BAD_PATTERNS:
        match = re.search(pattern, latex)
        if match:
            return match.group(0)
    return None


def _execute_tool(function_name: str, args: dict) -> dict:
    """Execute a SymPy tool function by name with a 10s timeout."""
    import signal
    import threading

    func = TOOL_FUNCTIONS.get(function_name)
    if not func:
        return {"success": False, "error": f"Unknown tool: {function_name}"}

    result = {"success": False, "error": "Computation timed out (10s)"}

    def run():
        nonlocal result
        try:
            result = func(**args)
        except Exception as e:
            result = {"success": False, "error": str(e)}

    thread = threading.Thread(target=run)
    thread.start()
    thread.join(timeout=10)

    return result


def normalize_pdf_context(raw_context: str) -> str:
    """Run a fast, focused Gemini call to fix garbled PDF text extraction into clean LaTeX."""
    client = get_client()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    prompt = (
        "You are a LaTeX transcription specialist. The text below was extracted from a PDF using a text layer parser. "
        "PDF extraction frequently corrupts math: superscripts become adjacent characters (x2 → x^2), "
        "subscripts look the same (x1 → x_1), fractions appear as a/b, unicode Greek letters appear raw, "
        "and spacing around operators is lost.\n\n"
        "Your job:\n"
        "- Reconstruct the mathematically correct LaTeX for any math content.\n"
        "- Leave plain English text unchanged.\n"
        "- Return ONLY the corrected text — no explanation, no preamble, no markdown fences.\n\n"
        f"Raw PDF extraction:\n{raw_context}"
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=[genai.types.Content(role="user", parts=[genai.types.Part(text=prompt)])],
            config=GenerateContentConfig(temperature=0.1),
        )
        normalized = (response.text or "").strip()
        return normalized if normalized else raw_context
    except Exception:
        return raw_context


def call_gemini(
    user_message: str,
    document: str,
    history: list[dict] | None = None,
    mode: str = "edit",
    images: list[str] | None = None,
) -> dict:
    """Call Gemini with tool calling support and structured JSON output.

    Pipeline:
    1. Send request to Gemini with tools enabled (no response schema — tools + schema conflict)
    2. If Gemini requests a tool call, execute it and return the result
    3. Loop until Gemini produces a final text response (max 3 iterations)
    4. Parse the final response as JSON, sanitize LaTeX
    5. If bad patterns remain, retry once
    """
    client = get_client()
    model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

    # Build contents
    contents = []

    if history:
        for msg in history:
            contents.append(
                genai.types.Content(
                    role=msg["role"],
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )

    if images:
        import base64
        image_parts = []
        for img_b64 in images:
            try:
                # We assume image/jpeg for broad base64 blob support
                image_parts.append(genai.types.Part.from_bytes(data=base64.b64decode(img_b64), mime_type="image/jpeg"))
            except Exception:
                pass
        if image_parts:
            contents.append(genai.types.Content(role="user", parts=image_parts))

    # --- TUTOR MODE: pure conversation, no editing ---
    if mode == "tutor":
        tutor_prompt = f"""The student's current LaTeX document for reference (DO NOT modify it):
```latex
{document}
```

Student's question: {user_message}"""

        contents.append(
            genai.types.Content(
                role="user",
                parts=[genai.types.Part(text=tutor_prompt)],
            )
        )

        tutor_instruction = (
            "You are a concise math tutor. The student is working on a LaTeX document. "
            "You can see their document, any uploaded images, and any highlighted PDF text they shared.\n\n"
            "RULES:\n"
            "- Give clear, focused explanations. Be concise — 2-4 sentences per concept is ideal.\n"
            "- Point out mistakes and explain briefly why they're wrong.\n"
            "- Reference specific equations in their document when relevant.\n"
            "- Use $...$ for inline math and $$...$$ for display math.\n"
            "- You may use markdown: **bold**, *italic*, short bullet lists.\n\n"
            "RESPONSE FORMAT:\n"
            "Respond with JSON: {\"action\": \"no_change\", \"new_document\": \"<same document unchanged>\", \"reply\": \"<your concise teaching response>\"}"
        )

        config = GenerateContentConfig(
            system_instruction=tutor_instruction,
            temperature=0.4,
        )

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

        final_text = response.text or ""
        try:
            result = json.loads(final_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[\s\S]*\}', final_text)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    result = {"action": "no_change", "new_document": document, "reply": final_text}
            else:
                result = {"action": "no_change", "new_document": document, "reply": final_text or "I'm here to help!"}

        # Force no document changes in tutor mode
        result["action"] = "no_change"
        result["new_document"] = document
        return result

    # --- EDIT MODE: full pipeline with tools ---
    _explicit_solve = any(kw in user_message.lower() for kw in ("solve", "simplify", "differentiate", "integrate", "calculate", "compute", "find", "evaluate", "answer"))

    if images and not _explicit_solve:
        user_prompt = f"""Current document:
```latex
{document}
```

TASK: The user has attached an image. Your ONLY job is to read the image and transcribe what is visibly written into LaTeX — do NOT solve, simplify, answer, or add anything beyond what is literally shown in the image. Append the transcribed LaTeX to the document.

User message: {user_message}

Respond as JSON:
{{"action": "replace_all", "new_document": "<document with transcribed content appended>", "reply": "<one sentence confirming what you transcribed>"}}"""
    else:
        user_prompt = f"""Current document:
```latex
{document}
```

User command: {user_message}

If the user asks to solve, simplify, differentiate, or integrate, use the appropriate math tool. Then produce your final response as JSON with this exact schema:
{{"action": "replace_all"|"no_change", "new_document": "<full updated document>", "reply": "<short confirmation>", "explanation": "<optional step-by-step>"}}\""""

    contents.append(
        genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_prompt)],
        )
    )

    # First try: with tools (no response_schema, since tools + schema can conflict)
    config_with_tools = GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[MATH_TOOLS],
        temperature=0.2,
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config_with_tools,
    )

    # Tool calling loop — must respond to ALL function calls in a turn (Gemini requirement)
    for _ in range(MAX_TOOL_ITERATIONS):
        candidate = response.candidates[0]
        parts = candidate.content.parts

        # Collect every function call in this response turn
        function_calls = [p.function_call for p in parts if p.function_call]

        if not function_calls:
            break  # No tool calls — Gemini produced a final text response

        # Execute all tool calls and build one response part per call
        response_parts = []
        for fc in function_calls:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}
            print(f"Tool call: {tool_name}({tool_args})")
            tool_result = _execute_tool(tool_name, tool_args)
            print(f"Tool result: {tool_result}")
            response_parts.append(
                genai.types.Part(
                    function_response=genai.types.FunctionResponse(
                        name=tool_name,
                        response=tool_result,
                    )
                )
            )

        # Append the model turn then ALL function responses in a single user turn
        contents.append(candidate.content)
        contents.append(
            genai.types.Content(role="user", parts=response_parts)
        )

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config_with_tools,
        )

    # Extract final text response
    final_text = response.text or ""

    # Try to parse as JSON
    try:
        result = json.loads(final_text)
    except json.JSONDecodeError:
        # Gemini returned plain text — try to extract JSON from it
        json_match = re.search(r'\{[\s\S]*\}', final_text)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = {
                    "action": "no_change",
                    "new_document": document,
                    "reply": final_text[:500],
                }
        else:
            result = {
                "action": "no_change",
                "new_document": document,
                "reply": final_text[:500] if final_text else "I processed your request but couldn't generate a structured response.",
            }

    # Sanitize LaTeX output
    if "new_document" in result:
        result["new_document"] = sanitize_latex(result["new_document"])

        bad = _has_bad_latex(result["new_document"])
        if bad:
            # Retry once with structured output only (no tools)
            config_json = GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA,
                temperature=0.2,
            )
            fix_contents = [
                genai.types.Content(
                    role="user",
                    parts=[genai.types.Part(text=(
                        f"Fix this LaTeX to be KaTeX-compatible. Remove `{bad}` and use $$ for display math.\n\n"
                        f"Document:\n```latex\n{result['new_document']}\n```"
                    ))],
                )
            ]
            try:
                fixed = client.models.generate_content(
                    model=model, contents=fix_contents, config=config_json
                )
                fixed_result = json.loads(fixed.text)
                if "new_document" in fixed_result:
                    fixed_result["new_document"] = sanitize_latex(fixed_result["new_document"])
                    result["new_document"] = fixed_result["new_document"]
            except Exception:
                pass

    return result


def call_gemini_stream(
    user_message: str,
    document: str,
    history: list[dict] | None = None,
    context: str | None = None,
    mode: str = "edit",
    images: list[str] | None = None,
):
    """True streaming: streams raw Gemini text chunks, then parses JSON at the end.

    Yields SSE events:
    - {"type": "chunk", "text": "..."} — raw streamed text
    - {"type": "document", "action": "...", "new_document": "..."} — parsed result
    - {"type": "done"}
    """
    import time

    client = get_client()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    contents = []

    if history:
        for msg in history:
            contents.append(
                genai.types.Content(
                    role=msg["role"],
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )

    if images:
        import base64
        image_parts = []
        for img_b64 in images:
            try:
                image_parts.append(genai.types.Part.from_bytes(data=base64.b64decode(img_b64), mime_type="image/jpeg"))
            except Exception:
                pass
        if image_parts:
            contents.append(genai.types.Content(role="user", parts=image_parts))

    user_msg = user_message
    if context:
        user_msg = f"Reference material (from uploaded PDF):\n\"\"\"\n{context}\n\"\"\"\n\nUser command: {user_message}"

    user_prompt = f"""Current document:
```latex
{document}
```

User command: {user_msg}

Respond with JSON: {{"action": "replace_all"|"no_change", "new_document": "<full updated document>", "reply": "<short confirmation>"}}"""

    contents.append(
        genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_prompt)],
        )
    )

    sys_instruction = SYSTEM_PROMPT
    if mode == "tutor":
        sys_instruction = (
            "You are a concise math tutor. The student is working on a LaTeX document. "
            "You can see their document, any uploaded images, and any highlighted PDF text they shared.\n\n"
            "RULES:\n"
            "- Give clear, focused explanations. Be concise — 2-4 sentences per concept is ideal.\n"
            "- Point out mistakes and explain briefly why they're wrong.\n"
            "- Reference specific equations in their document when relevant.\n"
            "- Use $...$ for inline math and $$...$$ for display math.\n"
            "- You may use markdown: **bold**, *italic*, short bullet lists.\n\n"
            "RESPONSE FORMAT:\n"
            "Respond with JSON: {\"action\": \"no_change\", \"new_document\": \"<same document unchanged>\", \"reply\": \"<your concise teaching response>\"}"
        )

    config = GenerateContentConfig(
        system_instruction=sys_instruction,
        temperature=0.2,
    )

    # Stream the response
    full_text = ""
    try:
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=config,
        ):
            if chunk.text:
                full_text += chunk.text
                yield {"type": "chunk", "text": chunk.text}
    except Exception as e:
        yield {"type": "error", "message": str(e)[:200]}
        yield {"type": "done"}
        return

    # Parse the accumulated JSON
    try:
        result = json.loads(full_text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{[\s\S]*\}', full_text)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = {"action": "no_change", "new_document": document, "reply": full_text}
        else:
            result = {"action": "no_change", "new_document": document, "reply": full_text or "No response"}

    # Sanitize
    if "new_document" in result:
        result["new_document"] = sanitize_latex(result["new_document"])

    yield {
        "type": "document",
        "action": result.get("action", "no_change"),
        "new_document": result.get("new_document", document),
        "reply": result.get("reply", ""),
    }

    yield {"type": "done"}


def call_gemini_with_audio(
    audio_bytes: bytes,
    document: str,
    history: list[dict] | None = None,
    context: str | None = None,
) -> dict:
    """Send audio directly to Gemini — it transcribes, understands, and edits in one call.

    Returns the same dict format as call_gemini, plus a 'transcript' field.
    """
    client = get_client()
    model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

    contents = []

    if history:
        for msg in history:
            contents.append(
                genai.types.Content(
                    role=msg["role"],
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )

    # Build multi-part user message: audio + text context
    parts = [
        genai.types.Part.from_bytes(data=audio_bytes, mime_type="audio/webm"),
    ]

    context_text = f"""The audio above is a voice command from the user about their LaTeX document.

Current document:
```latex
{document}
```"""

    if context:
        context_text += f"""

Reference material (from uploaded PDF):
\"\"\"
{context}
\"\"\"
"""

    context_text += """

Instructions:
1. First, transcribe exactly what the user said.
2. Then, interpret their intent and modify the document accordingly.
3. Return JSON with this schema:
{"action": "replace_all"|"no_change", "new_document": "<full updated document>", "reply": "<what you did>", "explanation": "<optional steps>", "transcript": "<what the user said>"}

IMPORTANT: When the user says to "add", "write", or "put" something, you MUST modify the document and use action "replace_all". Only use "no_change" if the user is asking a question without requesting document changes."""

    parts.append(genai.types.Part(text=context_text))

    contents.append(
        genai.types.Content(role="user", parts=parts)
    )

    config = GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.2,
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    final_text = response.text or ""

    # Parse JSON from response
    try:
        result = json.loads(final_text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{[\s\S]*\}', final_text)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = {
                    "action": "no_change",
                    "new_document": document,
                    "reply": final_text[:500],
                    "transcript": "",
                }
        else:
            result = {
                "action": "no_change",
                "new_document": document,
                "reply": final_text[:500] if final_text else "Could not process audio.",
                "transcript": "",
            }

    # Sanitize LaTeX
    if "new_document" in result:
        result["new_document"] = sanitize_latex(result["new_document"])

    return result

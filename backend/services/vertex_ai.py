import os
import json
from pathlib import Path
from google import genai
from google.genai.types import GenerateContentConfig

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


def call_gemini(
    user_message: str,
    document: str,
    history: list[dict] | None = None,
) -> dict:
    """Call Gemini with structured JSON output for document editing."""
    client = get_client()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Build the conversation contents
    contents = []

    # Add conversation history if provided
    if history:
        for msg in history:
            contents.append(
                genai.types.Content(
                    role=msg["role"],
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )

    # Add current user message with document context
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

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    return json.loads(response.text)

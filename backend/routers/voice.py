import asyncio
import os
import json
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from google import genai
from google.genai.types import GenerateContentConfig

router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=4)
GEMINI_TIMEOUT = 15


class TranscribeResponse(BaseModel):
    transcript: str


def _transcribe_with_gemini(audio_bytes: bytes) -> str:
    """Use Gemini to transcribe audio — much better at math terminology."""
    from services.vertex_ai import get_client

    client = get_client()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    contents = [
        genai.types.Content(
            role="user",
            parts=[
                genai.types.Part.from_bytes(data=audio_bytes, mime_type="audio/webm"),
                genai.types.Part(text=(
                    "Transcribe this audio exactly as spoken. "
                    "The speaker is talking about mathematics and LaTeX. "
                    "Return ONLY the transcription text, nothing else. "
                    "If you cannot hear anything or the audio is silent, respond with exactly: [EMPTY]"
                )),
            ],
        )
    ]

    config = GenerateContentConfig(temperature=0.1)

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    text = (response.text or "").strip()

    # Handle empty/silent audio
    if not text or text == "[EMPTY]" or len(text) < 2:
        return ""

    return text


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    """Transcribe audio using Gemini. Returns just the transcript."""
    audio_bytes = await file.read()

    # Skip tiny audio blobs (likely empty recordings)
    if len(audio_bytes) < 1000:
        return TranscribeResponse(transcript="")

    try:
        loop = asyncio.get_event_loop()
        transcript = await asyncio.wait_for(
            loop.run_in_executor(_executor, lambda: _transcribe_with_gemini(audio_bytes)),
            timeout=GEMINI_TIMEOUT,
        )
        return TranscribeResponse(transcript=transcript)
    except Exception as e:
        print(f"Transcription error: {e}")
        return TranscribeResponse(transcript="")

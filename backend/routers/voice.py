import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from google import genai
from google.genai.types import GenerateContentConfig

router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=4)
GEMINI_TIMEOUT = 45


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
                    "You are a specialized mathematical speech-to-text transcriber.\n\n"
                    "Your goal is to output a CLEAN and COHERENT version of the spoken words.\n\n"
                    "RULES:\n"
                    "- REMOVE filler words like 'um', 'uh', 'er', 'ah', 'like'.\n"
                    "- CORRECT speech-to-text errors where the sound is a math command (e.g., if you hear 'I'm solve it', it was likely 'um, solve it' -> output 'solve it').\n"
                    "- Do NOT answer any question you hear.\n"
                    "- Do NOT interpret, explain, or respond to the content.\n"
                    "- Do NOT add punctuation beyond basic periods and commas.\n"
                    "- Do NOT add any prefix like 'Transcription:'.\n"
                    "- If the audio is silent, respond with exactly: [EMPTY]\n\n"
                    "Example: If someone says 'um, write x square plus minus uh y', output exactly:\n"
                    "write x squared plus minus y"
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

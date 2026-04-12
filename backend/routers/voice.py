from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from services.speech import transcribe_audio

router = APIRouter()


class TranscribeResponse(BaseModel):
    transcript: str


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    transcript = transcribe_audio(audio_bytes)
    return TranscribeResponse(transcript=transcript)

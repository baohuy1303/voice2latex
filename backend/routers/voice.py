import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional
from schemas.agent_response import AgentResponse, ActionType
from services.vertex_ai import call_gemini_with_audio
from services.session_store import get_session, save_session

router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=4)
MAX_HISTORY = 10
GEMINI_TIMEOUT = 30


@router.post("/voice/command", response_model=AgentResponse)
async def voice_command(
    file: UploadFile = File(...),
    document: str = Form(default=""),
    session_id: Optional[str] = Form(default=None),
    context: Optional[str] = Form(default=None),
):
    """Send audio directly to Gemini with document context.
    Gemini transcribes + understands + edits in a single call."""

    audio_bytes = await file.read()

    # Load history from session if available
    if session_id:
        session = get_session(session_id)
        history = (session.get("history", []) if session else [])[-MAX_HISTORY:]
    else:
        history = []

    try:
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(
                _executor,
                lambda: call_gemini_with_audio(
                    audio_bytes=audio_bytes,
                    document=document,
                    history=history,
                    context=context,
                ),
            ),
            timeout=GEMINI_TIMEOUT,
        )

        response = AgentResponse(
            action=result.get("action", "no_change"),
            new_document=result.get("new_document", document),
            reply=result.get("reply", "Done."),
            explanation=result.get("explanation"),
            transcript=result.get("transcript"),
        )

        # Save to session
        if session_id:
            transcript = result.get("transcript", "")
            new_history = history + [
                {"role": "user", "content": transcript or "(voice command)"},
                {"role": "model", "content": response.reply},
            ]
            doc_to_save = response.new_document if response.action != "no_change" else document
            save_session(session_id, doc_to_save, new_history)

    except asyncio.TimeoutError:
        response = AgentResponse(
            action=ActionType.no_change,
            new_document=document,
            reply="Voice request timed out. Please try again.",
        )
    except Exception as e:
        print(f"Voice Gemini error: {e}")
        response = AgentResponse(
            action=ActionType.no_change,
            new_document=document,
            reply=f"Sorry, I couldn't process your voice command: {str(e)[:150]}",
        )

    return response

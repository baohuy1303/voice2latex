import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from schemas.agent_response import ChatRequest
from services.vertex_ai import call_gemini_stream
from services.session_store import get_session, save_session

router = APIRouter()

MAX_HISTORY = 10


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    # Load history from session if available
    if request.session_id:
        session = get_session(request.session_id)
        history = (session.get("history", []) if session else [])[-MAX_HISTORY:]
    else:
        history = []

    def generate():
        last_document = request.document
        last_action = "no_change"
        reply_parts = []

        try:
            for event in call_gemini_stream(
                user_message=request.message,
                document=request.document,
                history=history,
                context=request.context,
            ):
                event_type = event.get("type", "")

                if event_type == "reply":
                    reply_parts.append(event["chunk"])

                if event_type == "document":
                    last_document = event.get("new_document", request.document)
                    last_action = event.get("action", "no_change")

                yield f"event: {event_type}\ndata: {json.dumps(event)}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)[:200]})}\n\n"
            yield f"event: done\ndata: {{}}\n\n"
            return

        # Save to session after streaming completes
        if request.session_id:
            full_reply = " ".join(reply_parts)
            updated_history = history + [
                {"role": "user", "content": request.message},
                {"role": "model", "content": full_reply},
            ]
            doc_to_save = last_document if last_action != "no_change" else request.document
            save_session(request.session_id, doc_to_save, updated_history)

    return StreamingResponse(generate(), media_type="text/event-stream")

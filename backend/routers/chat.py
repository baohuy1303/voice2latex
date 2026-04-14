import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter
from schemas.agent_response import ChatRequest, AgentResponse, ActionType
from services.google_auth import GoogleAuthConfigurationError
from services.vertex_ai import call_gemini, normalize_pdf_context
from services.session_store import get_session, save_session

router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=4)

# Fallback in-memory history when no session_id
_conversation_history: list[dict] = []
MAX_HISTORY = 10
GEMINI_TIMEOUT = 90


@router.post("/chat", response_model=AgentResponse)
async def chat(request: ChatRequest):
    global _conversation_history

    try:
        # Load history from session or fallback to in-memory
        if request.session_id:
            session = get_session(request.session_id)
            history = (session.get("history", []) if session else [])[-MAX_HISTORY:]
        else:
            history = _conversation_history[-MAX_HISTORY:]

        # Build user message with optional PDF context (normalize garbled math first)
        user_message = request.message
        if request.context:
            clean_context = normalize_pdf_context(request.context)
            user_message = f"Reference material (from uploaded PDF):\n\"\"\"\n{clean_context}\n\"\"\"\n\nUser command: {request.message}"

        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(
                _executor,
                lambda: call_gemini(
                    user_message=user_message,
                    document=request.document,
                    history=history,
                    mode=request.mode,
                    images=request.images,
                ),
            ),
            timeout=GEMINI_TIMEOUT,
        )

        response = AgentResponse(
            action=result.get("action", "no_change"),
            new_document=result.get("new_document", request.document),
            reply=result.get("reply", "Done."),
            explanation=result.get("explanation"),
        )

        # Save history
        new_entry_user = {"role": "user", "content": request.message}
        new_entry_model = {"role": "model", "content": response.reply}

        if request.session_id:
            updated_history = history + [new_entry_user, new_entry_model]
            doc_to_save = response.new_document if response.action != "no_change" else request.document
            save_session(request.session_id, doc_to_save, updated_history)
        else:
            _conversation_history.append(new_entry_user)
            _conversation_history.append(new_entry_model)

    except asyncio.TimeoutError:
        response = AgentResponse(
            action=ActionType.no_change,
            new_document=request.document,
            reply="Request timed out. Please try a simpler command.",
        )
    except GoogleAuthConfigurationError as e:
        print(f"Google auth configuration error: {e}")
        response = AgentResponse(
            action=ActionType.no_change,
            new_document=request.document,
            reply=str(e),
        )
    except Exception as e:
        print(f"Gemini error: {e}")
        response = AgentResponse(
            action=ActionType.no_change,
            new_document=request.document,
            reply=f"Sorry, I encountered an error: {str(e)[:200]}",
        )

    return response

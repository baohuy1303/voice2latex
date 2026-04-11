from fastapi import APIRouter
from schemas.agent_response import ChatRequest, AgentResponse, ActionType
from services.vertex_ai import call_gemini

router = APIRouter()

# In-memory conversation history (single-session for hackathon)
_conversation_history: list[dict] = []
MAX_HISTORY = 10


@router.post("/chat", response_model=AgentResponse)
async def chat(request: ChatRequest):
    global _conversation_history

    try:
        result = call_gemini(
            user_message=request.message,
            document=request.document,
            history=_conversation_history[-MAX_HISTORY:],
        )

        response = AgentResponse(
            action=result.get("action", "no_change"),
            new_document=result.get("new_document", request.document),
            reply=result.get("reply", "Done."),
            explanation=result.get("explanation"),
        )

        # Append to conversation history
        _conversation_history.append({"role": "user", "content": request.message})
        _conversation_history.append({"role": "model", "content": response.reply})

    except Exception as e:
        print(f"Gemini error: {e}")
        response = AgentResponse(
            action=ActionType.no_change,
            new_document=request.document,
            reply=f"Sorry, I encountered an error: {str(e)[:200]}",
        )

    return response

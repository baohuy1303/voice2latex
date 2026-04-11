from fastapi import APIRouter
from schemas.agent_response import ChatRequest, AgentResponse, ActionType

router = APIRouter()


@router.post("/chat", response_model=AgentResponse)
async def chat(request: ChatRequest):
    return AgentResponse(
        action=ActionType.no_change,
        new_document=request.document,
        reply=f"Echo: {request.message}",
    )

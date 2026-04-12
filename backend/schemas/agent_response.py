from pydantic import BaseModel
from enum import Enum
from typing import Optional


class ActionType(str, Enum):
    replace_all = "replace_all"
    insert = "insert"
    replace_snippet = "replace_snippet"
    no_change = "no_change"


class ChatRequest(BaseModel):
    message: str
    document: str
    session_id: Optional[str] = None
    context: Optional[str] = None
    mode: str = "edit"
    images: Optional[list[str]] = None


class AgentResponse(BaseModel):
    action: ActionType
    new_document: str
    reply: str
    explanation: Optional[str] = None
    transcript: Optional[str] = None

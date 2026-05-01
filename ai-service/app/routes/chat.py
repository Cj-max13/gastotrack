from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.agent import run_agent
from app.services.chat import chat  # fallback when no token

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    parts: list[str]


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    token: Optional[str] = None   # JWT from the mobile app


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list = []
    steps: int = 0


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(body: ChatRequest):
    """
    AI Agent endpoint.
    - If token is provided: uses the full agent with live tool access
    - If no token: falls back to basic chat (no data access)
    """
    history = [{"role": m.role, "parts": m.parts} for m in body.history]

    if body.token:
        result = run_agent(body.message, history, body.token)
        return result
    else:
        reply = chat(body.message, history)
        return {"reply": reply, "tool_calls": [], "steps": 0}

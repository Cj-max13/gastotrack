"""
Gemini AI client using the new google-genai SDK.
All services import get_client() from here.
"""
import os
from google import genai
from google.genai import types

_client = None
MODEL = "gemini-2.0-flash"


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Get a free key at https://aistudio.google.com/app/apikey "
                "and add it to ai-service/.env"
            )
        _client = genai.Client(api_key=api_key)
    return _client


def generate(prompt: str) -> str:
    """Single-turn generation — returns the text response."""
    client = get_client()
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text.strip()


def chat_turn(message: str, history: list[dict]) -> str:
    """
    Multi-turn chat.
    history: list of {"role": "user"|"model", "parts": [str]}
    """
    client = get_client()

    contents = []
    for turn in history:
        contents.append(
            types.Content(
                role=turn["role"],
                parts=[types.Part(text=p) for p in turn["parts"]],
            )
        )
    contents.append(
        types.Content(role="user", parts=[types.Part(text=message)])
    )

    response = client.models.generate_content(model=MODEL, contents=contents)
    return response.text.strip()

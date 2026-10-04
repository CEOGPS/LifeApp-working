"""xAI Grok model for Erebus."""
import os
from .chat import post_chat

NAME = "grok"


async def complete(messages: list, key: str = "", model: str = "grok-3-mini") -> str:
    token = key or os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY") or ""
    return await post_chat("https://api.x.ai/v1/chat/completions", token, model, messages)

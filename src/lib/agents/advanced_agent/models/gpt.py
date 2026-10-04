"""OpenAI model for Erebus."""
import os
from .chat import post_chat

NAME = "gpt"


async def complete(messages: list, key: str = "", model: str = "gpt-4o-mini") -> str:
    token = key or os.getenv("OPENAI_API_KEY") or ""
    return await post_chat("https://api.openai.com/v1/chat/completions", token, model, messages)

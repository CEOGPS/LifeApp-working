"""Perplexity search model for Erebus."""
import os
from .chat import post_chat

NAME = "perplexity"


async def complete(messages: list, key: str = "", model: str = "sonar") -> str:
    token = key or os.getenv("PERPLEXITY_API_KEY") or ""
    return await post_chat("https://api.perplexity.ai/chat/completions", token, model, messages)

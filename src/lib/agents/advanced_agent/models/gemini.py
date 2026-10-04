"""Google Gemini model for Erebus."""
import os
import httpx

NAME = "gemini"


async def complete(messages: list, key: str = "", model: str = "gemini-2.0-flash") -> str:
    token = key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    if not token:
        raise RuntimeError("GEMINI_API_KEY is not set")
    contents = [{"role": "user" if m.get("role") != "assistant" else "model", "parts": [{"text": m.get("content", "")}]} for m in messages if m.get("role") != "system"]
    async with httpx.AsyncClient(timeout=40) as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={"key": token},
            json={"contents": contents},
        )
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]

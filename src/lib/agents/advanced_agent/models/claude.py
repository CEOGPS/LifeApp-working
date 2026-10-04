"""Anthropic Claude model for Erebus."""
import os
import httpx

NAME = "claude"


async def complete(messages: list, key: str = "", model: str = "claude-3-5-haiku-latest") -> str:
    token = key or os.getenv("ANTHROPIC_API_KEY") or ""
    if not token:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    system = ""
    chat = []
    for m in messages:
        if m.get("role") == "system":
            system = m.get("content", "")
        else:
            chat.append({"role": m.get("role", "user"), "content": m.get("content", "")})
    async with httpx.AsyncClient(timeout=40) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": token,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={"model": model, "max_tokens": 2000, "system": system, "messages": chat or [{"role": "user", "content": ""}]},
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]

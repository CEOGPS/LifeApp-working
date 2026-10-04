"""Shared chat call used by every Erebus model module."""
import httpx


async def post_chat(url: str, key: str, model: str, messages: list, timeout: int = 40) -> str:
    if not key:
        raise RuntimeError("API key is not set")
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(
            url,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": 2000},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

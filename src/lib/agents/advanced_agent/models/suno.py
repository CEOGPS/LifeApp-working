"""Suno music hook for Erebus. Needs SUNO_API_KEY and SUNO_API_URL."""
import os
import httpx

NAME = "suno"


async def generate(prompt: str, key: str = "") -> str:
    token = key or os.getenv("SUNO_API_KEY") or ""
    url = os.getenv("SUNO_API_URL") or ""
    if not token or not url:
        return "[SUNO] SUNO_API_KEY and SUNO_API_URL are not set"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers={"Authorization": f"Bearer {token}"}, json={"prompt": prompt})
    return f"[SUNO] HTTP {r.status_code}"

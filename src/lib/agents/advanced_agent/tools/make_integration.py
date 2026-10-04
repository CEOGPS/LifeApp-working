"""Make.com webhook for Erebus. Needs MAKE_WEBHOOK_URL."""
import os
import httpx

URL = os.getenv("MAKE_WEBHOOK_URL", "")


async def trigger(payload: str) -> str:
    if not URL:
        return "[MAKE] MAKE_WEBHOOK_URL is not set"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(URL, json={"source": "erebus", "payload": payload})
    return f"[MAKE] webhook HTTP {r.status_code}"

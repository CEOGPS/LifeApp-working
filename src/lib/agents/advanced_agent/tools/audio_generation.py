"""Kokoro speech for Erebus. Uses the local Kokoro server when it is up."""
import os
import httpx

KOKORO = os.getenv("KOKORO_URL", "http://127.0.0.1:8880").rstrip("/")


async def generate(text: str, voice: str = "af_heart") -> str:
    text = (text or "").strip()
    if not text:
        return "[AUDIO] text required"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{KOKORO}/tts", json={"text": text[:2000], "voice": voice})
            if r.status_code >= 400:
                return f"[AUDIO] Kokoro HTTP {r.status_code}"
    except Exception as e:
        return f"[AUDIO] Kokoro is not running at {KOKORO}: {e}"
    return f"[AUDIO] spoke {len(text)} chars via Kokoro ({voice})"

"""Web search for Erebus. No API key. DuckDuckGo instant answers."""
import httpx


async def search(query: str) -> str:
    query = (query or "").strip()
    if not query:
        return "[SEARCH] query required"
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            headers={"User-Agent": "LifeOS-Erebus"},
        )
        r.raise_for_status()
        data = r.json()
    abstract = data.get("AbstractText") or ""
    related = [t.get("Text", "") for t in data.get("RelatedTopics", [])[:4] if isinstance(t, dict)]
    text = abstract or " | ".join(x for x in related if x) or "No instant results."
    return f"[SEARCH: {query}] {text[:800]}"

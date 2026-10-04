# api.py
from fastapi import FastAPI, Query, Depends, WebSocket
from fastapi.responses import StreamingResponse # pyright: ignore[reportMissingImports]
import asyncpg

app = FastAPI(title="Community Hub")

@app.get("/feed")
async def feed(
    services: list[str] = Query(default=[]),
    sources: list[str] = Query(default=[]),
    min_heat: float = 0,
    limit: int = 50,
    cursor: str | None = None,
):
    flt = LeadFilter(
        services=services or None,
        sources=[SourceType(s) for s in sources] or None,
        min_heat=min_heat,
    )
    where, params = flt.to_sql()
    if cursor:
        where += " AND posted_at < :cursor"
        params["cursor"] = cursor
    params["limit"] = limit
    
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT * FROM leads WHERE {where} ORDER BY heat_score DESC, posted_at DESC LIMIT :limit",
        **params,
    )
    return {"leads": [dict(r) for r in rows]}


@app.get("/leads/similar/{lead_id}")
async def similar(lead_id: str, k: int = 10):
    pool = await get_pool()
    rows = await pool.fetch("""
        SELECT id, title, body, 1 - (embedding <=> (SELECT embedding FROM leads WHERE id=$1)) AS sim
        FROM leads WHERE id != $1
        ORDER BY embedding <=> (SELECT embedding FROM leads WHERE id=$1)
        LIMIT $2
    """, lead_id, k)
    return {"similar": [dict(r) for r in rows]}


@app.websocket("/ws/feed")
async def ws_feed(ws: WebSocket):
    await ws.accept()
    spec = await ws.receive_json()   # client sends filter spec
    flt = LeadFilter(**spec)
    pubsub = redis.pubsub()
    await pubsub.subscribe("leads:new")
    async for msg in pubsub.listen():
        if msg["type"] == "message":
            lead = json.loads(msg["data"])
            if matches(lead, flt):
                await ws.send_json(lead)


@app.post("/filters")
async def save_filter(user_id: str, name
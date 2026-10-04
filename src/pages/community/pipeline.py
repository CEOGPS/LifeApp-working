# pipeline.py
import asyncio
from redis.asyncio import Redis

redis = Redis.from_url("redis://localhost:6379")

async def ingest_once(adapters: list[SourceAdapter], db):
    since = await get_cursor(db)
    raw_leads = []
    for adapter in adapters:
        try:
            raw_leads.extend(await adapter.fetch(since))
        except Exception as e:
            print(f"[{adapter.source_type}] fetch failed: {e}")
    
    # Concurrent enrichment
    sem = asyncio.Semaphore(10)
    async def _enrich(l):
        async with sem:
            return await enrich_lead(l)
    
    enriched = await asyncio.gather(*[_enrich(l) for l in raw_leads])
    kept = [l for l in enriched if should_keep(l)]
    
    for lead in kept:
        lead.embedding = await embed(f"{lead.title or ''} {lead.body}")
        await upsert_lead(db, lead)
        await fanout_notifications(lead)


async def fanout_notifications(lead):
    """Match lead against all saved filters; fire webhooks/emails."""
    filters = await load_all_filters()
    for f in filters:
        if matches(lead, LeadFilter(**f["spec"])):
            await redis.xadd("notify_stream", {
                "filter_id": f["id"],
                "lead_id": lead.id,
                "channels": ",".join(f["notify_channels"]),
            })
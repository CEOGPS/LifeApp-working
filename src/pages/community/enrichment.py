# enrichment.py
import hashlib, json, re
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

client = AsyncOpenAI()

ENRICH_PROMPT = """You analyze community posts to extract lead intelligence.
Return JSON with keys:
- intent: one of [seeking_service, offering_service, recommendation_request, general_discussion, spam]
- services: array of service categories (e.g. "plumber", "web design")
- location: city/region string or null
- budget_min, budget_max: numbers in USD or null
- urgency: 0-10 integer (10 = emergency)
- contact_hint: any email/phone/URL found or null
- heat_score: 0-100 (how strong a lead this is for a service provider)

Post:
\"\"\"{text}\"\"\"
"""

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def enrich_lead(lead: UnifiedLead) -> UnifiedLead:
    text = f"{lead.title or ''}\n{lead.body}"[:4000]
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": ENRICH_PROMPT.format(text=text)}],
        temperature=0.1,
    )
    data = json.loads(resp.choices[0].message.content)
    
    lead.intent = IntentType(data.get("intent", "general_discussion"))
    lead.services = data.get("services", []) or []
    lead.location = data.get("location")
    lead.budget_min = data.get("budget_min")
    lead.budget_max = data.get("budget_max")
    lead.urgency = int(data.get("urgency", 0))
    lead.contact_hint = data.get("contact_hint")
    lead.heat_score = float(data.get("heat_score", 0))
    
    # Deduplication hash
    lead.dedup_hash = hashlib.sha256(
        re.sub(r"\W+", "", text.lower()).encode()
    ).hexdigest()[:32]
    
    return lead


async def embed(text: str) -> list[float]:
    resp = await client.embeddings.create(
        model="text-embedding-3-small", input=text[:8000]
    )
    return resp.data[0].embedding


def should_keep(lead: UnifiedLead) -> bool:
    """Filter out noise early."""
    if lead.intent == IntentType.SPAM:
        return False
    if lead.intent == IntentType.GENERAL_DISCUSSION and lead.heat_score < 30:
        return False
    if not lead.services:
        return False
    return True
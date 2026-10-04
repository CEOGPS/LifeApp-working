from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, base64, hashlib, secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Unified Social Hub")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("social-hub")

WS = "demo"
PLATFORMS = ["facebook", "instagram", "tiktok", "reddit", "linkedin", "snapchat", "twitter"]

OAUTH_ENDPOINTS = {
    "facebook": {"auth": "https://www.facebook.com/v19.0/dialog/oauth", "token": "https://graph.facebook.com/v19.0/oauth/access_token", "scope": "public_profile,email"},
    "instagram": {"auth": "https://api.instagram.com/oauth/authorize", "token": "https://api.instagram.com/oauth/access_token", "scope": "user_profile,user_media"},
    "tiktok": {"auth": "https://www.tiktok.com/v2/auth/authorize/", "token": "https://open.tiktokapis.com/v2/oauth/token/", "scope": "user.info.basic,video.list"},
    "reddit": {"auth": "https://www.reddit.com/api/v1/authorize", "token": "https://www.reddit.com/api/v1/access_token", "scope": "identity,read,history"},
    "linkedin": {"auth": "https://www.linkedin.com/oauth/v2/authorization", "token": "https://www.linkedin.com/oauth/v2/accessToken", "scope": "r_liteprofile,r_emailaddress"},
    "snapchat": {"auth": "https://accounts.snapchat.com/login/oauth2/authorize", "token": "https://accounts.snapchat.com/login/oauth2/access_token", "scope": "snapchat-marketing-api"},
    "twitter": {"auth": "https://twitter.com/i/oauth2/authorize", "token": "https://api.twitter.com/2/oauth2/token", "scope": "tweet.read users.read follows.read offline.access"},
}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def clean(doc):
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc

async def get_settings():
    s = await db.settings.find_one({"ws": WS})
    if not s:
        s = {"ws": WS, "platforms": {}, "ai_api_key": "", "ai_base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "ai_model": "qwen3.6-plus", "instructions": "", "filters": "", "permissions": {}, "created_at": now_iso()}
        await db.settings.insert_one(dict(s))
    return clean(s)

class SettingsIn(BaseModel):
    platforms: Optional[Dict[str, Any]] = None
    ai_api_key: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_model: Optional[str] = None
    instructions: Optional[str] = None
    filters: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None

class AccountIn(BaseModel):
    platform: str
    kind: str = "profile"
    display_name: str
    handle: str
    avatar: Optional[str] = ""

class PostIn(BaseModel):
    content: str
    platforms: List[str]
    account_ids: List[str] = []
    media: List[str] = []
    schedule_at: Optional[str] = None

class AIChatIn(BaseModel):
    message: str
    context: Optional[str] = None
    history: List[Dict[str, str]] = []

class GenPostIn(BaseModel):
    prompt: str
    tone: Optional[str] = "engaging"
    platforms: List[str] = []

class ToolIn(BaseModel):
    tool: str
    params: Dict[str, Any] = {}

async def call_qwen(messages, max_tokens=900):
    s = await get_settings()
    key = s.get("ai_api_key") or os.environ.get("QWEN_API_KEY", "")
    if not key:
        raise HTTPException(400, "AI key not configured. Add your Qwen (DashScope) API key in Settings.")
    from openai import OpenAI
    cli = OpenAI(api_key=key, base_url=s.get("ai_base_url") or "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
    try:
        resp = cli.chat.completions.create(model=s.get("ai_model") or "qwen3.6-plus", messages=messages, max_tokens=max_tokens)
        return resp.choices[0].message.content
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(502, f"AI request failed: {str(e)[:200]}")

@api.get("/")
async def root():
    return {"message": "Unified Social Hub API"}

@api.get("/settings")
async def read_settings():
    return await get_settings()

@api.put("/settings")
async def update_settings(body: SettingsIn):
    await get_settings()
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.settings.update_one({"ws": WS}, {"": update})
    return await get_settings()

@api.get("/accounts")
async def list_accounts(platform: Optional[str] = None):
    q = {"ws": WS}
    if platform:
        q["platform"] = platform
    accs = await db.accounts.find(q).sort("created_at", -1).to_list(500)
    return [clean(a) for a in accs]

@api.post("/accounts")
async def add_account(body: AccountIn):
    if body.platform not in PLATFORMS:
        raise HTTPException(400, "Unknown platform")
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "ws": WS, "connected": False, "created_at": now_iso(),
    "stats": {"friends": 0, "followers": 0, "likes": 0, "comments": 0, "mentions": 0, "tags": 0, "views": 0}})
    await db.accounts.insert_one(dict(doc))
    return clean(doc)

@api.delete("/accounts/{account_id}")
async def del_account(account_id: str):
    await db.accounts.delete_one({"id": account_id, "ws": WS})
    return {"ok": True}

@api.post("/oauth/{platform}/authorize")
async def oauth_authorize(platform: str):
    if platform not in OAUTH_ENDPOINTS:
        raise HTTPException(400, "Unsupported platform")
    s = await get_settings()
    cfg = (s.get("platforms") or {}).get(platform, {})
    client_id = cfg.get("client_id")
    redirect_uri = cfg.get("redirect_uri")
    if not client_id or not redirect_uri:
        raise HTTPException(400, f"Set client_id and redirect_uri for {platform} in Settings first.")
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    state = secrets.token_urlsafe(24)
    await db.oauth_states.insert_one({"state": state, "platform": platform, "verifier": verifier, "created_at": now_iso()})
    ep = OAUTH_ENDPOINTS[platform]
    scope = cfg.get("scope") or ep["scope"]
    url = (f"{ep['auth']}?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"
    f"&scope={scope}&state={state}&code_challenge={challenge}&code_challenge_method=S256")
    return {"authorize_url": url, "state": state}

@api.get("/oauth/{platform}/callback")
async def oauth_callback(platform: str, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    front = os.environ.get("REACT_APP_BACKEND_URL", "")
    st = await db.oauth_states.find_one({"state": state}) if state else None
    if error or not code or not st:
        return RedirectResponse(f"/settings?oauth=error&platform={platform}")
    s = await get_settings()
    cfg = (s.get("platforms") or {}).get(platform, {})
    import httpx
    data = {"grant_type": "authorization_code", "code": code, "redirect_uri": cfg.get("redirect_uri"),
    "client_id": cfg.get("client_id"), "code_verifier": st["verifier"]}
    if cfg.get("client_secret"):
        data["client_secret"] = cfg["client_secret"]
    token = None
    try:
        async with httpx.AsyncClient(timeout=20) as hc:
            r = await hc.post(OAUTH_ENDPOINTS[platform]["token"], data=data)
            token = r.json().get("access_token")
    except Exception as e:
        logger.error(f"token exchange failed: {e}")
    await db.oauth_states.delete_one({"state": state})
    if token:
        await db.accounts.insert_one({"id": str(uuid.uuid4()), "ws": WS, "platform": platform, "kind": "profile",
        "display_name": f"{platform.title()} Account", "handle": "@connected", "avatar": "",
        "connected": True, "access_token": token, "created_at": now_iso(),
        "stats": {"friends": 0, "followers": 0, "likes": 0, "comments": 0, "mentions": 0, "tags": 0, "views": 0}})
        return RedirectResponse(f"/settings?oauth=success&platform={platform}")
    return RedirectResponse(f"/settings?oauth=error&platform={platform}")

@api.get("/posts")
async def list_posts(platforms: Optional[str] = None):
    q = {"ws": WS}
    if platforms:
        q["platforms"] = {"": platforms.split(",")}
    posts = await db.posts.find(q).sort("created_at", -1).to_list(500)
    return [clean(p) for p in posts]

@api.post("/posts")
async def create_post(body: PostIn):
    if not body.content.strip():
        raise HTTPException(400, "Content required")
    doc = body.model_dump()
    scheduled = bool(body.schedule_at)
    doc.update({"id": str(uuid.uuid4()), "ws": WS, "author_name": "You", "author_avatar": "",
    "status": "scheduled" if scheduled else "published",
    "created_at": body.schedule_at or now_iso(), "posted_at": None if scheduled else now_iso(),
    "engagement": {"likes": 0, "comments": 0, "shares": 0}})
    await db.posts.insert_one(dict(doc))
    return clean(doc)

@api.delete("/posts/{post_id}")
async def del_post(post_id: str):
    await db.posts.delete_one({"id": post_id, "ws": WS})
    return {"ok": True}

@api.get("/analytics")
async def analytics():
    accs = await db.accounts.find({"ws": WS}).to_list(500)
    by_platform = {}
    totals = {"friends": 0, "followers": 0, "likes": 0, "comments": 0, "mentions": 0, "tags": 0, "views": 0}
    for a in accs:
        p = a["platform"]
        st = a.get("stats", {})
        bp = by_platform.setdefault(p, {k: 0 for k in totals})
        bp["accounts"] = bp.get("accounts", 0) + 1
        for k in totals:
            bp[k] += st.get(k, 0)
            totals[k] += st.get(k, 0)
    posts_count = await db.posts.count_documents({"ws": WS})
    return {"by_platform": by_platform, "totals": totals, "posts_count": posts_count, "accounts_count": len(accs)}

@api.get("/messages")
async def messages():
    msgs = await db.messages.find({"ws": WS}).sort("created_at", -1).to_list(500)
    return [clean(m) for m in msgs]

@api.get("/notifications")
async def notifications():
    n = await db.notifications.find({"ws": WS}).sort("created_at", -1).to_list(500)
    return [clean(x) for x in n]

@api.post("/notifications/read-all")
async def read_all():
    await db.notifications.update_many({"ws": WS}, {"": {"read": True}})
    return {"ok": True}

@api.get("/connections")
async def connections(platform: Optional[str] = None):
    q = {"ws": WS}
    if platform:
        q["platform"] = platform
    c = await db.connections.find(q).to_list(1000)
    return [clean(x) for x in c]

@api.get("/media")
async def media():
    m = await db.media.find({"ws": WS}).sort("created_at", -1).to_list(500)
    return [clean(x) for x in m]

@api.post("/ai/chat")
async def ai_chat(body: AIChatIn):
    s = await get_settings()
    sys = "You are an expert AI social media manager inside the Unified Social Hub app. Help with growth, content, engagement, analytics insights and ethical lead generation. Be concise and actionable."
    if s.get("instructions"):
        sys += f"\nUser instructions: {s['instructions']}"
    msgs = [{"role": "system", "content": sys}] + body.history[-8:]
    if body.context:
        msgs.append({"role": "system", "content": f"Context: {body.context}"})
    msgs.append({"role": "user", "content": body.message})
    reply = await call_qwen(msgs)
    return {"reply": reply}

@api.post("/ai/generate-post")
async def ai_generate(body: GenPostIn):
    plats = ", ".join(body.platforms) or "all major social platforms"
    msgs = [{"role": "system", "content": "You write high-performing social media posts. Return only the post text with relevant hashtags."},
    {"role": "user", "content": f"Write a {body.tone} post for {plats} about: {body.prompt}"}]
    text = await call_qwen(msgs, max_tokens=500)
    return {"content": text}

@api.post("/ai/tool")
async def ai_tool(body: ToolIn):
    prompts = {
    "track_followers": "Analyze follower growth strategy and give 4 specific tactics to track and grow followers.",
    "follow_back_tracker": "Explain how to identify non-followers-back and a respectful follow/unfollow strategy.",
    "mass_deletion": "Provide a safe checklist for bulk-deleting old posts without harming reach.",
    "social_listening": "List trending topics and keywords to monitor for social listening in my niche.",
    "site_intelligence": "Give a competitive site-intelligence breakdown approach for analyzing competitors.",
    "win_ai_visibility": "How to optimize my brand to appear in AI search results and assistants (GEO/AEO). Give steps.",
    "seo_automations": "List 5 SEO automations I can set up to grow organic social + web traffic.",
    "journey_tracking": "Design a customer journey tracking funnel across social touchpoints.",
    "growth_strategies": "Give an automated 30-day growth strategy plan with weekly milestones.",
    "lead_scraping": "Provide an ethical, compliant approach to finding B2B leads and contact info using public data and filters.",
    }
    base = prompts.get(body.tool, "Provide helpful social media management guidance.")
    extra = body.params.get("query") or body.params.get("filters") or ""
    msgs = [{"role": "system", "content": "You are a social growth strategist. Be specific, structured, and actionable. Use short bullet points."},
    {"role": "user", "content": f"{base} {('Details: ' + extra) if extra else ''}"}]
    out = await call_qwen(msgs, max_tokens=700)
    return {"result": out}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
